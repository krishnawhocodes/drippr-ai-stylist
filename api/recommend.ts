import { buildCandidatePool, scoreProducts } from "./_lib/recommendation.js";
import { fetchShopifyCatalogProducts } from "./_lib/shopifyCatalog.js";
import {
  recommendRequestSchema,
  recommendResponseSchema,
} from "./_lib/schemas.js";

export const config = {
  maxDuration: 60,
};

function setCors(res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function getBody(req: any) {
  if (typeof req.body === "string") {
    return JSON.parse(req.body);
  }
  return req.body ?? {};
}

export default async function handler(req: any, res: any) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = recommendRequestSchema.parse(getBody(req));

    const catalogEntries = await fetchShopifyCatalogProducts();
    const products = catalogEntries.map((entry) => entry.product);

    const pool = buildCandidatePool({
      products,
      gender: body.gender,
      category: body.category,
      priceRange: body.priceRange,
    });

    const rankedProducts = scoreProducts({
      products: pool.products,
      gender: body.gender,
      vibe: body.vibe,
      category: body.category,
      priceRange: body.priceRange,
      occasionContext: {
        eventType: "unknown",
        timeOfDay: "unknown",
        season: "unknown",
        formality: "unknown",
        comfortPriority: "medium",
        styleDirection: [],
        preferredKeywords: [],
        avoidKeywords: [],
        preferredProductTypes: [],
        confidence: 0,
      },
      imageSignals: {
        dominantColors: [],
        paletteTemperature: "unknown",
        skinToneBand: "unknown",
        undertone: "unknown",
        fitCues: [],
        vibeTags: [],
        visibleGarments: [],
        confidence: 0,
      },
      maxResults: 100,
    });

    const byId = new Map(
      catalogEntries.map((entry) => [entry.product.id, entry] as const),
    );

    const finalProducts = rankedProducts.map((product) => {
      const source = byId.get(product.id);

      return {
        ...product,
        imageUrl: product.imageUrl ?? source?.product.image ?? null,
        storeUrl: source?.storeUrl ?? null,
        addToCartUrl: product.soldOut ? null : (source?.addToCartUrl ?? null),
      };
    });

    const response = recommendResponseSchema.parse({
      occasionContext: {
        eventType: "unknown",
        timeOfDay: "unknown",
        season: "unknown",
        formality: "unknown",
        comfortPriority: "medium",
        styleDirection: [],
        preferredKeywords: [],
        avoidKeywords: [],
        preferredProductTypes: [],
        confidence: 0,
      },
      products: finalProducts,
    });

    return res.status(200).json({
      ...response,
      debugApplied: {
        engineVersion: "shopify-first-v14",
        category: body.category,
        vibe: body.vibe,
        priceRange: body.priceRange,
        totalCatalogCount: products.length,
        poolStage: pool.stage,
        baseEligibleCount: pool.counts.baseEligible,
        strictProductTypeCount: pool.counts.strictProductType,
        titleTagMatchCount: pool.counts.titleTagMatch,
        curatedPoolCount: pool.products.length,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to generate recommendations",
    });
  }
}
