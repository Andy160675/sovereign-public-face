import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

// Execute the shipped worker against an isolated browser CacheStorage boundary.
// This catches returning stale HTML/private API data and deleting other apps' caches.
function startWorker() {
  const handlers = new Map<string, (event: any) => void>();
  const stored = new Map<string, Map<string, Response>>([
    ["sovereign-v1", new Map([
      ["https://site.example/", new Response("old HTML")],
      ["https://site.example/api/session", new Response("private account")],
    ])],
    ["another-app-v1", new Map([["public", new Response("other app")]])],
  ]);
  let claimed = false;
  let skipped = false;
  const caches = {
    keys: async () => [...stored.keys()],
    delete: async (key: string) => stored.delete(key),
    open: async (key: string) => {
      if (!stored.has(key)) stored.set(key, new Map());
      return {
        addAll: async (urls: string[]) => {
          for (const url of urls) stored.get(key)!.set(url, new Response("precache"));
        },
        put: async (request: Request, response: Response) => {
          stored.get(key)!.set(request.url, response);
        },
      };
    },
    match: async (request: Request) => {
      for (const entries of stored.values()) {
        const cached = entries.get(request.url);
        if (cached) return cached;
      }
      return undefined;
    },
  };
  runInNewContext(readFileSync("client/public/sw.js", "utf8"), {
    self: {
      addEventListener: (name: string, handler: (event: any) => void) => handlers.set(name, handler),
      skipWaiting: async () => { skipped = true; },
      clients: { claim: async () => { claimed = true; } },
    },
    caches,
    URL,
    fetch: async () => new Response("fresh network response"),
  });
  return {
    stored,
    claimed: () => claimed,
    skipped: () => skipped,
    lifecycle: async (name: string) => {
      const pending: Promise<unknown>[] = [];
      handlers.get(name)?.({ waitUntil: (task: Promise<unknown>) => pending.push(task) });
      await Promise.all(pending);
    },
    intercept: async (url: string) => {
      let intercepted = false;
      let pending: Promise<unknown> | undefined;
      handlers.get("fetch")?.({
        request: new Request(url),
        respondWith: (task: Promise<unknown>) => { intercepted = true; pending = task; },
      });
      await pending;
      return intercepted;
    },
  };
}

describe("service worker cache retirement", () => {
  it("removes its legacy cache without deleting another app's cache", async () => {
    const worker = startWorker();
    await worker.lifecycle("activate");
    expect([...worker.stored.keys()]).toEqual(["another-app-v1"]);
    expect(worker.claimed()).toBe(true);
  });

  it("does not pre-cache pages during installation", async () => {
    const worker = startWorker();
    const before = [...worker.stored.get("sovereign-v1")!.keys()];
    await worker.lifecycle("install");
    expect([...worker.stored.get("sovereign-v1")!.keys()]).toEqual(before);
    expect(worker.skipped()).toBe(true);
  });

  it.each(["https://site.example/", "https://site.example/api/session"])(
    "leaves %s to the browser network instead of returning cached data",
    async (url) => {
      const worker = startWorker();
      expect(await worker.intercept(url)).toBe(false);
    },
  );
});
