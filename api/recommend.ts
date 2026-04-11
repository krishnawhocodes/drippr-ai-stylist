import { getAdminDb } from "./_lib/firebaseAdmin.js";
import { buildCandidatePool, scoreProducts } from "./_lib/recommendation.js";
import {
  merchantProductSchema,
  recommendRequestSchema,
  recommendResponseSchema,
  type MerchantProduct,
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

function toStringOrNull(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return null;
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function extractStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const urls: string[] = [];

  for (const item of value) {
    if (typeof item === "string" && item.trim()) {
      urls.push(item.trim());
      continue;
    }

    if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      const candidates = [
        obj.url,
        obj.src,
        obj.image,
        obj.imageUrl,
        obj.originalSrc,
      ];

      for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim()) {
          urls.push(candidate.trim());
          break;
        }
      }
    }
  }

  return [...new Set(urls)];
}

function extractTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => toStringOrNull(item))
      .filter((item): item is string => Boolean(item));
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeMerchantProduct(
  id: string,
  raw: Record<string, unknown>,
): MerchantProduct | null {
  const image =
    toStringOrNull(raw.image) ??
    toStringOrNull(raw.featuredImage) ??
    toStringOrNull(raw.imageSrc);

  const images = [
    ...extractStringArray(raw.images),
    ...extractStringArray(raw.media),
  ];

  const imageUrls = [
    ...extractStringArray(raw.imageUrls),
    ...extractStringArray(raw.photos),
  ];

  const normalized = {
    id,
    title: toStringOrNull(raw.title) ?? "",
    description: toStringOrNull(raw.description),
    price:
      toNumberOrNull(raw.price) ??
      toNumberOrNull(raw.salePrice) ??
      toNumberOrNull(raw.compareAtPrice),
    currency: toStringOrNull(raw.currency) ?? "INR",
    sku: toStringOrNull(raw.sku),
    status: toStringOrNull(raw.status),
    vendor: toStringOrNull(raw.vendor),
    productType:
      toStringOrNull(raw.productType) ??
      toStringOrNull(raw.type) ??
      toStringOrNull(raw.category),
    tags: extractTags(raw.tags),
    imageUrls,
    images,
    image,
    inventoryQty:
      toNumberOrNull(raw.inventoryQty) ??
      toNumberOrNull(raw.inventory) ??
      toNumberOrNull(raw.quantity),
    merchantId: toStringOrNull(raw.merchantId),
    shopifyProductId: toStringOrNull(raw.shopifyProductId),
    createdAt: toNumberOrNull(raw.createdAt),
    updatedAt: toNumberOrNull(raw.updatedAt),
  };

  const parsed = merchantProductSchema.safeParse(normalized);
  return parsed.success ? parsed.data : null;
}

async function fetchProducts() {
  const adminDb = getAdminDb();
  const snapshot = await adminDb.collection("merchantProducts").get();

  const products: MerchantProduct[] = [];
  let totalDocs = 0;
  let normalizedDocs = 0;

  snapshot.forEach((doc: any) => {
    totalDocs += 1;
    const raw = doc.data() as Record<string, unknown>;
    const normalized = normalizeMerchantProduct(doc.id, raw);

    if (normalized) {
      normalizedDocs += 1;
      products.push(normalized);
    }
  });

  return {
    products,
    totalDocs,
    normalizedDocs,
  };
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
    const fetched = await fetchProducts();

    const pool = buildCandidatePool({
      products: fetched.products,
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
        eventType: "ignored",
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

    const response = recommendResponseSchema.parse({
      occasionContext: {
        eventType: "ignored",
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
      products: rankedProducts,
    });

    return res.status(200).json({
      ...response,
      debugApplied: {
        engineVersion: "normalized-inventory-v7",
        category: body.category,
        vibe: body.vibe,
        priceRange: body.priceRange,
        firestoreDocCount: fetched.totalDocs,
        normalizedDocCount: fetched.normalizedDocs,
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
