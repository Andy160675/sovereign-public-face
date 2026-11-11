import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { createStripeWebhookApp } from "../createStripeWebhookApp";
import { securityHeaders } from "./securityHeaders";
import { API_LIMIT, OAUTH_LIMIT, rateLimit } from "./rateLimit";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Webhook-first factory: raw body registered BEFORE express.json(); no listen().
  const app = createStripeWebhookApp();
  const server = createServer(app);

  // Before every route, including the static bundle and the webhook app's own
  // paths. This host serves /api/trpc and /api/oauth — the session cookie,
  // sign-in and checkout — and was sending no security headers at all; the
  // vercel.json block only covers the static deployment.
  app.use(securityHeaders());

  // Rate limiting, before the body parser: an abusive caller is rejected
  // without first being handed a 50mb parse budget.
  //
  // Note what is NOT covered, and why it is structural rather than a path
  // exclusion: createStripeWebhookApp() registered the webhook route above,
  // before this line, so a webhook delivery is answered before any of this
  // middleware runs. That is the intended shape — the webhook's control is
  // signature verification over raw bytes, and throttling it would discard
  // legitimate Stripe retries.
  //
  // Separate budgets: a burst of ordinary page loads must not be able to
  // consume the sign-in allowance.
  app.use("/api/oauth", rateLimit("oauth", OAUTH_LIMIT));
  app.use("/api/trpc", rateLimit("trpc", API_LIMIT));

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
