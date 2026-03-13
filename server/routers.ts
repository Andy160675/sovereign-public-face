import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { PRODUCTS, getProductById } from "./products";
import { z } from "zod";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2026-02-25.clover",
});

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
          throw new Error(`Product not found: ${input.productId}`);
        }

        const origin = ctx.req.headers.origin || ctx.req.headers.referer || "http://localhost:3000";

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
