import { describe, expect, it } from "vitest";
import { PRODUCTS, getProductById, getProductsByTier, getFeaturedProduct } from "./products";

describe("Product Catalog", () => {
  it("has at least 7 products defined", () => {
    expect(PRODUCTS.length).toBeGreaterThanOrEqual(7);
  });

  it("every product has required fields", () => {
    for (const product of PRODUCTS) {
      expect(product.id).toBeTruthy();
      expect(product.name).toBeTruthy();
      expect(product.description).toBeTruthy();
      expect(product.price).toBeGreaterThan(0);
      expect(product.currency).toBe("gbp");
      expect(["payment", "subscription"]).toContain(product.mode);
      expect(["entry", "professional", "enterprise"]).toContain(product.tier);
      expect(product.deliverables.length).toBeGreaterThan(0);
    }
  });

  it("has exactly one featured product", () => {
    const featured = PRODUCTS.filter((p) => p.featured);
    expect(featured.length).toBe(1);
    expect(featured[0].id).toBe("ai-compliance-audit");
  });

  it("getProductById returns correct product", () => {
    const audit = getProductById("ai-compliance-audit");
    expect(audit).toBeDefined();
    expect(audit!.name).toBe("Emergency AI Compliance Audit");
    expect(audit!.price).toBe(9900);
  });

  it("getProductById returns undefined for unknown id", () => {
    const unknown = getProductById("nonexistent-product");
    expect(unknown).toBeUndefined();
  });

  it("getProductsByTier returns correct products", () => {
    const entry = getProductsByTier("entry");
    expect(entry.length).toBe(3);
    entry.forEach((p) => expect(p.tier).toBe("entry"));

    const professional = getProductsByTier("professional");
    expect(professional.length).toBe(2);
    professional.forEach((p) => expect(p.tier).toBe("professional"));

    const enterprise = getProductsByTier("enterprise");
    expect(enterprise.length).toBe(2);
    enterprise.forEach((p) => expect(p.tier).toBe("enterprise"));
  });

  it("getFeaturedProduct returns the AI compliance audit", () => {
    const featured = getFeaturedProduct();
    expect(featured).toBeDefined();
    expect(featured!.id).toBe("ai-compliance-audit");
    expect(featured!.price).toBe(9900);
  });

  it("product prices are in pence (GBP)", () => {
    const audit = getProductById("ai-compliance-audit");
    expect(audit!.price).toBe(9900); // £99.00

    const checklist = getProductById("ai-governance-checklist");
    expect(checklist!.price).toBe(1900); // £19.00

    const promptPack = getProductById("compliance-prompt-pack");
    expect(promptPack!.price).toBe(2900); // £29.00
  });

  it("managed-fleet product is subscription mode", () => {
    const fleet = getProductById("managed-fleet");
    expect(fleet).toBeDefined();
    expect(fleet!.mode).toBe("subscription");
  });

  it("all non-subscription products are payment mode", () => {
    const paymentProducts = PRODUCTS.filter((p) => p.id !== "managed-fleet");
    paymentProducts.forEach((p) => expect(p.mode).toBe("payment"));
  });
});
