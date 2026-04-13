import type { MerchantProduct } from "./schemas.js";

export type CatalogProductEntry = {
  product: MerchantProduct;
  storeUrl: string | null;
  addToCartUrl: string | null;
};

const STORE_BASE_URL = (
  process.env.STORE_BASE_URL || "https://drippr.in"
).replace(/\/$/, "");

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

function extractNumericIdFromGid(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  const match = trimmed.match(/(\d+)$/);
  return match ? match[1] : null;
}

function dedupe(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function buildStoreSearchUrl(title: string) {
  return `${STORE_BASE_URL}/search?q=${encodeURIComponent(title)}`;
}

function buildAddToCartUrl(variantNumericId: string) {
  return `${STORE_BASE_URL}/cart/add?id=${encodeURIComponent(
    variantNumericId,
  )}&quantity=1&return_to=/cart`;
}

const SHOPIFY_PRODUCTS_QUERY = `
  query CatalogProducts($cursor: String) {
    products(first: 100, after: $cursor, query: "status:active") {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        title
        description
        handle
        vendor
        productType
        tags
        status
        onlineStoreUrl
        featuredImage {
          url
        }
        images(first: 10) {
          nodes {
            url
          }
        }
        variants(first: 50) {
          nodes {
            id
            availableForSale
            price
          }
        }
      }
    }
  }
`;

function normalizeShopifyProduct(node: any): CatalogProductEntry | null {
  const title =
    typeof node?.title === "string" && node.title.trim()
      ? node.title.trim()
      : "";
  if (!title) return null;

  const variantNodes = Array.isArray(node?.variants?.nodes)
    ? node.variants.nodes
    : [];

  const priceValues = variantNodes
    .map((variant: any) => Number(variant?.price))
    .filter((value: number) => Number.isFinite(value));

  const price = priceValues.length > 0 ? Math.min(...priceValues) : null;
  if (price === null) return null;

  const availableVariant = variantNodes.find(
    (variant: any) =>
      variant?.availableForSale && typeof variant?.id === "string",
  );

  const fallbackVariant = variantNodes.find(
    (variant: any) => typeof variant?.id === "string",
  );

  const variantNumericIds = variantNodes
    .map((variant: any) => extractNumericIdFromGid(variant?.id))
    .filter((value: string | null): value is string => Boolean(value));

  const liveVariantNumericId =
    extractNumericIdFromGid(availableVariant?.id) ??
    extractNumericIdFromGid(fallbackVariant?.id);

  const soldOut =
    variantNodes.length > 0
      ? !variantNodes.some((variant: any) => variant?.availableForSale)
      : false;

  const imageCandidates = dedupe([
    typeof node?.featuredImage?.url === "string"
      ? node.featuredImage.url.trim()
      : "",
    ...(Array.isArray(node?.images?.nodes)
      ? node.images.nodes
          .map((image: any) =>
            typeof image?.url === "string" ? image.url.trim() : "",
          )
          .filter(Boolean)
      : []),
  ]);

  let storeUrl: string | null = buildStoreSearchUrl(title);

  if (typeof node?.onlineStoreUrl === "string" && node.onlineStoreUrl.trim()) {
    storeUrl = node.onlineStoreUrl.trim();
  } else if (typeof node?.handle === "string" && node.handle.trim()) {
    storeUrl = `${STORE_BASE_URL}/products/${node.handle.trim()}`;
  }

  const product: MerchantProduct = {
    id: String(node.id),
    title,
    description: typeof node?.description === "string" ? node.description : "",
    price,
    currency: "INR",
    sku: null,
    status: soldOut ? "sold_out" : "active",
    published:
      typeof node?.onlineStoreUrl === "string" &&
      node.onlineStoreUrl.trim().length > 0,
    vendor:
      typeof node?.vendor === "string" ? node.vendor : "DRIPPR Marketplace",
    productType:
      typeof node?.productType === "string" ? node.productType : null,
    tags: Array.isArray(node?.tags) ? node.tags : [],
    imageUrls: imageCandidates,
    images: imageCandidates,
    image: imageCandidates[0] ?? null,
    inventoryQty: soldOut ? 0 : 1,
    merchantId: null,
    shopifyProductId: typeof node?.id === "string" ? node.id : null,
    shopifyVariantNumericIds: variantNumericIds,
    createdAt: null,
    updatedAt: null,
  };

  return {
    product,
    storeUrl,
    addToCartUrl:
      !soldOut && liveVariantNumericId
        ? buildAddToCartUrl(liveVariantNumericId)
        : null,
  };
}

export async function fetchShopifyCatalogProducts(): Promise<
  CatalogProductEntry[]
> {
  const results: CatalogProductEntry[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data = await shopifyGraphQL(SHOPIFY_PRODUCTS_QUERY, { cursor });
    const connection = data?.data?.products;
    const nodes = Array.isArray(connection?.nodes) ? connection.nodes : [];

    for (const node of nodes) {
      const normalized = normalizeShopifyProduct(node);
      if (normalized) {
        results.push(normalized);
      }
    }

    hasNextPage = Boolean(connection?.pageInfo?.hasNextPage);
    cursor =
      typeof connection?.pageInfo?.endCursor === "string"
        ? connection.pageInfo.endCursor
        : null;
  }

  return results;
}
