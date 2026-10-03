import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { PRODUCTS, getProductById } from "./products";
import { z } from "zod";
import Stripe from "stripe";
import { TRPCError } from "@trpc/server";

/**
 * Built on first use, not at import time.
 *
 * This was `new Stripe(process.env.STRIPE_SECRET_KEY || "", …)` at module
 * scope. The `|| ""` could not make that safe: the Stripe constructor rejects an
 * empty key, so importing this module without the env var threw
 * "Neither apiKey nor config.authenticator provided" — a message that names
 * Stripe's internals rather than the variable an operator has to set, and which
 * took down every route in the router, including the ones that never touch
 * Stripe, plus any test that merely imports it.
 *
 * Deferring construction keeps the failure where it belongs: the checkout call
 * fails, loudly and by name, and nothing else does.
 */
let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (stripeClient) return stripeClient;

  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    throw new Error("STRIPE_SECRET_KEY is not set; checkout cannot be created.");
  }

  stripeClient = new Stripe(apiKey, { apiVersion: "2026-02-25.clover" });
  return stripeClient;
}

/**
 * Where checkout is allowed to send the customer back to.
 *
 * `success_url` and `cancel_url` used to be built from `req.headers.origin`,
 * falling back to `req.headers.referer`. Both are attacker-controlled: a request
 * carrying `Origin: https://evil.example` produced a Stripe session that
 * redirected the customer to that host after paying, with the real
 * `CHECKOUT_SESSION_ID` in the query string. Using `referer` was worse still —
 * it is a full URL including a path, so the result was a mangled URL built from
 * whatever the caller sent.
 *
 * The return URL is OUR origin, so it is read from configuration and never from
 * the request. This mirrors the allowlist `api/promotion-fix.js` already applies
 * (`PROMOTION_PUBLIC_ORIGIN` + a `VERCEL_URL` preview origin); the same env var
 * is honoured here so one deployment does not need two sources of truth.
 */
/**
 * A configured origin is only usable if it really is a bare origin.
 *
 * Stripping a trailing slash was not enough. `api/promotion-fix.js` delegates to
 * `server/promotion-fix-service.mjs`, which rejects a configured value outright
 * unless it is https with no userinfo, path, query or fragment — so claiming to
 * "mirror" that allowlist while accepting `http://evil.test` or
 * `https://a@evil.test` was a weaker control wearing the same name. Those values
 * would have become the checkout return origin, with CHECKOUT_SESSION_ID
 * attached.
 *
 * `http://localhost` is exempt from the https requirement, and only ever added
 * outside production.
 */
function normaliseConfiguredOrigin(value: string, allowHttpLocalhost = false): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const schemeOk = url.protocol === "https:" || (allowHttpLocalhost && url.protocol === "http:" && isLocalhost);

  if (!schemeOk) return null;
  if (url.username || url.password) return null;
  if (url.search || url.hash) return null;
  if (url.pathname !== "/" && url.pathname !== "") return null;

  return url.origin;
}

function allowedReturnOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const allowHttpLocalhost = env.NODE_ENV !== "production";
  const configured = [env.PUBLIC_BASE_URL, env.PROMOTION_PUBLIC_ORIGIN]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .map(value => normaliseConfiguredOrigin(value, allowHttpLocalhost))
    .filter((value): value is string => value !== null);

  // Same shape and the same hostname guard as api/promotion-fix.js.
  if (
    env.VERCEL_ENV === "preview" &&
    typeof env.VERCEL_URL === "string" &&
    /^[a-zA-Z0-9.-]+$/.test(env.VERCEL_URL)
  ) {
    configured.push(`https://${env.VERCEL_URL}`);
  }

  if (allowHttpLocalhost) configured.push("http://localhost:3000");

  // Array.from rather than [...set]: this tsconfig targets below es2015, where
  // spreading a Set needs --downlevelIteration. Loosening the project's compiler
  // settings to dedupe a three-element list would be the wrong trade.
  return Array.from(new Set(configured));
}

/**
 * Pick the return origin. The request's `Origin` can only SELECT among origins
 * we already trust — it can never introduce one. With nothing configured this
 * throws rather than guessing: a checkout that silently returns customers to the
 * wrong host is worse than a checkout that refuses to start.
 */
export function resolveReturnOrigin(
  requestOrigin: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const allowed = allowedReturnOrigins(env);
  if (allowed.length === 0) {
    throw new Error(
      "No checkout return origin is configured. Set PUBLIC_BASE_URL (or PROMOTION_PUBLIC_ORIGIN) " +
        "to this deployment's public origin.",
    );
  }
  const normalised = requestOrigin?.replace(/\/+$/, "");
  return normalised && allowed.includes(normalised) ? normalised : allowed[0];
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Product catalog — public
  products: router({
    list: publicProcedure.query(() => {
      return PRODUCTS.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        currency: p.currency,
        mode: p.mode,
        tier: p.tier,
        featured: p.featured,
        deliverables: p.deliverables,
      }));
    }),

    byId: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(({ input }) => {
        const product = getProductById(input.id);
        if (!product) return null;
        return {
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          currency: product.currency,
          mode: product.mode,
          tier: product.tier,
          featured: product.featured,
          deliverables: product.deliverables,
        };
      }),
  }),

  // Stripe checkout — requires auth
  checkout: router({
    createSession: protectedProcedure
      .input(z.object({ productId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const product = getProductById(input.productId);
        if (!product) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Unknown product." });
        }

        // The two configuration faults below — no return origin, no Stripe key —
        // must not reach the browser. tRPC does not redact error messages and no
        // errorFormatter is configured, and the client renders them directly
        // (`toast.error(error.message ...)` in Audit.tsx / Packs.tsx), so an
        // unauthenticated-looking toast would otherwise name exactly which secret
        // is missing. `server/stripe-webhook.ts` already answers the identical
        // condition with a generic "Stripe configuration unavailable", and
        // `api/promotion-fix.js` states the rule outright: only domain-safe
        // messages go back. The precise cause is logged instead.
        let origin: string;
        let stripe: Stripe;
        try {
          origin = resolveReturnOrigin(ctx.req.headers.origin);
          stripe = getStripe();
        } catch (error) {
          console.error(
            "[checkout] configuration unavailable:",
            error instanceof Error ? error.message : error,
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Checkout is temporarily unavailable. No payment was started.",
          });
        }

        const sessionParams: Stripe.Checkout.SessionCreateParams = {
          mode: product.mode === "subscription" ? "subscription" : "payment",
          customer_email: ctx.user.email || undefined,
          client_reference_id: ctx.user.id.toString(),
          metadata: {
            user_id: ctx.user.id.toString(),
            customer_email: ctx.user.email || "",
            customer_name: ctx.user.name || "",
            product_id: product.id,
          },
          line_items: [
            {
              price_data: {
                currency: product.currency,
                product_data: {
                  name: product.name,
                  description: product.description,
                },
                unit_amount: product.price,
                ...(product.mode === "subscription" ? { recurring: { interval: "month" } } : {}),
              },
              quantity: 1,
            },
          ],
          allow_promotion_codes: true,
          success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/checkout/cancel`,
        };

        const session = await stripe.checkout.sessions.create(sessionParams);
        return { url: session.url };
      }),
  }),
});

export type AppRouter = typeof appRouter;
