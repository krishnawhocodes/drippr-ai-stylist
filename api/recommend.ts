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

const STORE_BASE_URL = (
  process.env.STORE_BASE_URL || "https://drippr.in"
).replace(/\/$/, "");

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

  const products: MerchantProduct[] = [];

  snapshot.forEach((doc: any) => {
    const raw = doc.data() as Record<string, unknown>;
    const normalized = normalizeMerchantProduct(doc.id, raw);

    if (normalized) {
      products.push(normalized);
    }
  });

  return products;
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing ${name}`);
  }
  return value.trim();
}

async function shopifyGraphQL(
  query: string,
  variables: Record<string, unknown>,
) {
  const domain = requireEnv("SHOPIFY_STORE_DOMAIN");
  const token = requireEnv("SHOPIFY_ADMIN_TOKEN");
  const apiVersion = process.env.SHOPIFY_API_VERSION?.trim() || "2025-01";

  const res = await fetch(
    `https://${domain}/admin/api/${apiVersion}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({ query, variables }),
    },
  );

  const json = await res.json();

  if (!res.ok || json.errors) {
    throw new Error(JSON.stringify(json));
  }

  return json;
}

const PRODUCT_META_QUERY = `
  query ProductMeta($id: ID!) {
    product(id: $id) {
      id
      handle
      onlineStoreUrl
      featuredImage {
        url
      }
      images(first: 10) {
        nodes {
          url
        }
      }
      variants(first: 20) {
        nodes {
          id
          availableForSale
        }
      }
    }
  }
`;

function buildStoreSearchUrl(title: string) {
  return `${STORE_BASE_URL}/search?q=${encodeURIComponent(title)}`;
}

function extractNumericIdFromGid(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  const match = trimmed.match(/(\d+)$/);
  return match ? match[1] : null;
}

function getPrimaryVariantNumericId(product: MerchantProduct): string | null {
  const values = product.shopifyVariantNumericIds ?? [];

  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }

    if (typeof value === "string" && value.trim()) {
      const numeric = extractNumericIdFromGid(value);
      if (numeric) return numeric;
    }
  }

  return null;
}

function buildAddToCartUrl(variantNumericId: string) {
  return `${STORE_BASE_URL}/cart/add?id=${encodeURIComponent(
    variantNumericId,
  )}&quantity=1&return_to=/cart`;
}

async function fetchShopifyMeta(shopifyProductId: string, title: string) {
  try {
    const result = await shopifyGraphQL(PRODUCT_META_QUERY, {
      id: shopifyProductId,
    });
    const product = result?.data?.product;

    const imageCandidates = [
      typeof product?.featuredImage?.url === "string"
        ? product.featuredImage.url.trim()
        : "",
      ...(Array.isArray(product?.images?.nodes)
        ? product.images.nodes
            .map((node: any) =>
              typeof node?.url === "string" ? node.url.trim() : "",
            )
            .filter(Boolean)
        : []),
    ].filter(Boolean);

    let storeUrl = buildStoreSearchUrl(title);

    if (
      typeof product?.onlineStoreUrl === "string" &&
      product.onlineStoreUrl.trim()
    ) {
      storeUrl = product.onlineStoreUrl.trim();
    } else if (typeof product?.handle === "string" && product.handle.trim()) {
      storeUrl = `${STORE_BASE_URL}/products/${product.handle.trim()}`;
    }

    const variantNodes = Array.isArray(product?.variants?.nodes)
      ? product.variants.nodes
      : [];

    const availableVariant = variantNodes.find(
      (node: any) => node?.availableForSale && typeof node?.id === "string",
    );

    const fallbackVariant = variantNodes.find(
      (node: any) => typeof node?.id === "string",
    );

    const liveVariantNumericId =
      extractNumericIdFromGid(availableVariant?.id) ??
      extractNumericIdFromGid(fallbackVariant?.id);

    const liveSoldOut =
      variantNodes.length > 0
        ? !variantNodes.some((node: any) => node?.availableForSale)
        : false;

    return {
      storeUrl,
      imageUrl: imageCandidates[0] || null,
      allImages: imageCandidates,
      liveVariantNumericId,
      liveSoldOut,
    };
  } catch {
    return {
      storeUrl: buildStoreSearchUrl(title),
      imageUrl: null,
      allImages: [],
      liveVariantNumericId: null,
      liveSoldOut: false,
    };
  }
}


async function hydrateStoreLinksAndImages(
  products: ReturnType<typeof scoreProducts>,
  sourceProducts: MerchantProduct[],
) {
  const adminDb = getAdminDb();
  const sourceById = new Map(sourceProducts.map((p) => [p.id, p] as const));

  return Promise.all(
    products.map(async (product) => {
      const source = sourceById.get(product.id);

      let storeUrl = buildStoreSearchUrl(product.title);
      let imageUrl = product.imageUrl;
      let variantNumericId: string | null = source
        ? getPrimaryVariantNumericId(source)
        : null;
      let soldOut = product.soldOut;

      if (product.shopifyProductId) {
        const meta = await fetchShopifyMeta(
          product.shopifyProductId,
          product.title,
        );

        storeUrl = meta.storeUrl;

        if (!imageUrl && meta.imageUrl) {
          imageUrl = meta.imageUrl;

          await adminDb.collection("merchantProducts").doc(product.id).set(
            {
              image: meta.imageUrl,
              images: meta.allImages,
              imageUrls: meta.allImages,
              updatedAt: Date.now(),
            },
            { merge: true },
          );
        }

        // Prefer live Shopify variant over Firestore mirror
        if (meta.liveVariantNumericId) {
          variantNumericId = meta.liveVariantNumericId;
        }

        // Prefer live Shopify sold-out state over Firestore guess
        soldOut = meta.liveSoldOut;
      }

      return {
        ...product,
        imageUrl,
        storeUrl,
        soldOut,
        reason: soldOut
          ? product.reason.includes("Currently sold out.")
            ? product.reason
            : `${product.reason} Currently sold out.`
          : product.reason.replace(/\s*Currently sold out\.\s*/g, "").trim(),
        addToCartUrl:
          !soldOut && variantNumericId
            ? `${STORE_BASE_URL}/cart/add?id=${encodeURIComponent(
                variantNumericId,
              )}&quantity=1&return_to=/cart`
            : null,
      };
    }),
  );
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
    const products = await fetchProducts();

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

    const finalProducts = await hydrateStoreLinksAndImages(
      rankedProducts,
      pool.products,
    );

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
        engineVersion: "category-fix-image-hydrate-v13",
        category: body.category,
        vibe: body.vibe,
        priceRange: body.priceRange,
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
