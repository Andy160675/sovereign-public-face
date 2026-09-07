import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Express } from "express";

const originalStripeSecretKey = process.env.STRIPE_SECRET_KEY;
const originalStripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

async function listen(app: Express): Promise<{ server: Server; url: string }> {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Expected an IPv4 server address");
  }

  return {
    server,
    url: `http://127.0.0.1:${(address as AddressInfo).port}`,
  };
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.closeAllConnections();
    server.close(error => (error ? reject(error) : resolve()));
  });
}

afterEach(() => {
  if (originalStripeSecretKey === undefined) {
    delete process.env.STRIPE_SECRET_KEY;
  } else {
    process.env.STRIPE_SECRET_KEY = originalStripeSecretKey;
  }

  if (originalStripeWebhookSecret === undefined) {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  } else {
    process.env.STRIPE_WEBHOOK_SECRET = originalStripeWebhookSecret;
  }

  vi.resetModules();
});

describe("Stripe webhook configuration isolation", () => {
  it("does not block public server startup when STRIPE_SECRET_KEY is absent", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    vi.resetModules();

    const [{ default: express }, { registerStripeWebhook }] = await Promise.all(
      [import("express"), import("./stripe-webhook")]
    );
    const app = express();
    registerStripeWebhook(app);
    app.get("/health", (_req, res) => res.json({ ok: true }));

    const { server, url } = await listen(app);
    try {
      const response = await fetch(`${url}/health`);
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ ok: true });
    } finally {
      await close(server);
    }
  });

  it("returns a safe unavailable response before processing a keyless webhook", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    vi.resetModules();

    const [{ default: express }, { registerStripeWebhook }] = await Promise.all(
      [import("express"), import("./stripe-webhook")]
    );
    const app = express();
    registerStripeWebhook(app);

    const { server, url } = await listen(app);
    try {
      const response = await fetch(`${url}/api/stripe/webhook`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "stripe-signature": "t=0,v1=invalid",
        },
        body: "{}",
        signal: AbortSignal.timeout(1_000),
      });

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        error: "Stripe webhook is temporarily unavailable.",
      });
    } finally {
      await close(server);
    }
  });
});
