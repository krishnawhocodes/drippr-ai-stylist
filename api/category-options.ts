import { getAdminDb } from "./_lib/firebaseAdmin.js";
import { getAvailableCategories } from "./_lib/recommendation.js";
import { merchantProductSchema, genderSchema } from "./_lib/schemas.js";

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

function normalizeMerchantProduct(id: string, raw: Record<string, unknown>) {
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
    published: typeof raw.published === "boolean" ? raw.published : null,
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
      toNumberOrNull(raw.quantity) ??
      toNumberOrNull(raw.stock),
    merchantId: toStringOrNull(raw.merchantId),
    shopifyProductId: toStringOrNull(raw.shopifyProductId),
    shopifyVariantNumericIds: Array.isArray(raw.shopifyVariantNumericIds)
      ? raw.shopifyVariantNumericIds
      : Array.isArray(raw.shopifyVariantIds)
        ? raw.shopifyVariantIds
        : null,
    createdAt: toNumberOrNull(raw.createdAt),
    updatedAt: toNumberOrNull(raw.updatedAt),
  };

  const parsed = merchantProductSchema.safeParse(normalized);
  return parsed.success ? parsed.data : null;
}

async function fetchProducts() {
  const adminDb = getAdminDb();
  const snapshot = await adminDb.collection("merchantProducts").get();

  const products: any[] = [];

  snapshot.forEach((doc: any) => {
    const raw = doc.data() as Record<string, unknown>;
    const normalized = normalizeMerchantProduct(doc.id, raw);

    if (normalized) {
      products.push(normalized);
    }
  });

  return products;
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
    const body = getBody(req);
    const gender = genderSchema.parse(body.gender);
    const vibe =
      typeof body.vibe === "string" && body.vibe.trim() ? body.vibe.trim() : "";

    const products = await fetchProducts();
    const categories = getAvailableCategories({
      products,
      gender,
      vibe,
    });

    return res.status(200).json({ categories });
  } catch (error) {
    return res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to load categories",
    });
  }
}
