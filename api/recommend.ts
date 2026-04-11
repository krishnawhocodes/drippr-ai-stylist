import { getAdminDb } from "./_lib/firebaseAdmin.js";
import { buildCandidatePool, scoreProducts } from "./_lib/recommendation.js";
import {
  merchantProductSchema,
  recommendRequestSchema,
  recommendResponseSchema,
  type MerchantProduct,
  type RecommendedProduct,
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

async function fetchProducts() {
  const adminDb = getAdminDb();
  const snapshot = await adminDb.collection("merchantProducts").get();

  const products: MerchantProduct[] = [];

  snapshot.forEach((doc: any) => {
    const parsed = merchantProductSchema.safeParse({
      id: doc.id,
      ...doc.data(),
    });

    if (parsed.success) {
      products.push(parsed.data);
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

const PRODUCT_URL_QUERY = `
  query ProductUrl($id: ID!) {
    product(id: $id) {
      id
      handle
      onlineStoreUrl
    }
  }
`;

function buildStoreSearchUrl(title: string) {
  return `https://drippr.in/search?q=${encodeURIComponent(title)}`;
}

async function fetchStoreUrl(
  shopifyProductId: string,
  title: string,
): Promise<string | null> {
  try {
    const result = await shopifyGraphQL(PRODUCT_URL_QUERY, {
      id: shopifyProductId,
    });
    const product = result?.data?.product;

    if (
      typeof product?.onlineStoreUrl === "string" &&
      product.onlineStoreUrl.trim()
    ) {
      return product.onlineStoreUrl.trim();
    }

    if (typeof product?.handle === "string" && product.handle.trim()) {
      return `https://drippr.in/products/${product.handle.trim()}`;
    }

    return buildStoreSearchUrl(title);
  } catch {
    return buildStoreSearchUrl(title);
  }
}

async function hydrateStoreUrls(products: RecommendedProduct[]) {
  return Promise.all(
    products.map(async (product) => {
      if (!product.shopifyProductId) {
        return {
          ...product,
          storeUrl: buildStoreSearchUrl(product.title),
        };
      }

      const storeUrl = await fetchStoreUrl(
        product.shopifyProductId,
        product.title,
      );

      return {
        ...product,
        storeUrl,
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

    const finalProducts = await hydrateStoreUrls(rankedProducts);

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
      products: finalProducts,
    });

    return res.status(200).json({
      ...response,
      debugApplied: {
        engineVersion: "store-link-v11",
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
