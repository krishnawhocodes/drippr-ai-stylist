import type {
  ImageSignals,
  MerchantProduct,
  OccasionContext,
  PriceRange,
  RecommendedProduct,
} from "./schemas.js";

const VIBE_KEYWORDS: Record<string, string[]> = {
  Streetwear: [
    "streetwear",
    "oversized",
    "graphic",
    "utility",
    "bomber",
    "cargo",
  ],
  Minimal: ["minimal", "clean", "plain", "solid", "tailored", "classic"],
  Daily: ["daily", "everyday", "casual", "basic", "comfortable", "easy"],
  Thrift: ["vintage", "retro", "washed", "distressed", "denim", "corduroy"],
  Fusion: ["fusion", "ethnic", "indo", "traditional", "kurta", "embroidered"],
  Athleisure: [
    "athleisure",
    "sport",
    "sports",
    "gym",
    "track",
    "active",
    "running",
  ],
};

const CATEGORY_PRODUCT_TYPE_ALIASES: Record<string, string[]> = {
  "Tops & Dresses": [
    "top",
    "tops",
    "dress",
    "dresses",
    "blouse",
    "shirt",
    "shirts",
    "kurta",
    "tank",
  ],
  "Cargo & Pants": [
    "cargo",
    "pant",
    "pants",
    "trouser",
    "trousers",
    "jogger",
    "joggers",
    "jeans",
    "denim",
  ],
  Tees: ["tee", "tees", "t shirt", "tshirt", "polo"],
  "Shorts & Skirts": ["short", "shorts", "skirt", "skirts"],
  "Sweatshirts & Hoodies": [
    "sweatshirt",
    "sweatshirts",
    "hoodie",
    "hoodies",
    "pullover",
  ],
  Jackets: [
    "jacket",
    "jackets",
    "coat",
    "blazer",
    "overshirt",
    "windbreaker",
    "bomber",
  ],
  "Cord Set": ["cord set", "co ord", "coord", "set", "sets", "kurta set"],
  Athleisure: [
    "athleisure",
    "sportswear",
    "activewear",
    "gymwear",
    "trackwear",
  ],
};

const CATEGORY_TITLE_TAG_ALIASES: Record<string, string[]> = {
  "Tops & Dresses": [
    "top",
    "dress",
    "blouse",
    "shirt",
    "kurta",
    "tank",
    "crop top",
  ],
  "Cargo & Pants": [
    "cargo",
    "pants",
    "pant",
    "trouser",
    "jogger",
    "jeans",
    "denim",
  ],
  Tees: ["tee", "t shirt", "tshirt", "polo"],
  "Shorts & Skirts": ["short", "shorts", "skirt"],
  "Sweatshirts & Hoodies": ["sweatshirt", "hoodie", "pullover"],
  Jackets: ["jacket", "coat", "blazer", "overshirt", "windbreaker", "bomber"],
  "Cord Set": ["co ord", "coord", "cord set", "set", "kurta set"],
  Athleisure: [
    "athleisure",
    "sport",
    "sports",
    "gym",
    "running",
    "track",
    "activewear",
  ],
};

const CATEGORY_CONFLICT_ALIASES: Record<string, string[]> = {
  "Tops & Dresses": [
    "pant",
    "pants",
    "trouser",
    "trousers",
    "jogger",
    "joggers",
    "jeans",
    "cargo",
  ],
  "Cargo & Pants": [
    "top",
    "tops",
    "tank",
    "tee",
    "t shirt",
    "tshirt",
    "shirt",
    "blouse",
    "dress",
    "dresses",
    "kurta",
  ],
  Tees: [
    "pant",
    "pants",
    "jogger",
    "joggers",
    "jeans",
    "cargo",
    "dress",
    "jacket",
    "hoodie",
    "sweatshirt",
  ],
  "Shorts & Skirts": [
    "pant",
    "pants",
    "jogger",
    "joggers",
    "jeans",
    "hoodie",
    "jacket",
    "dress",
  ],
  "Sweatshirts & Hoodies": [
    "tank",
    "tee",
    "t shirt",
    "tshirt",
    "dress",
    "pants",
    "jeans",
    "skirt",
    "jacket",
  ],
  Jackets: [
    "tank",
    "tee",
    "t shirt",
    "tshirt",
    "dress",
    "pants",
    "jeans",
    "skirt",
    "hoodie",
    "sweatshirt",
  ],
  "Cord Set": [
    "tank",
    "tee",
    "t shirt",
    "tshirt",
    "pants",
    "jeans",
    "hoodie",
    "jacket",
  ],
  Athleisure: ["dress", "blazer", "kurta"],
};

const JUNK_PATTERNS = [
  "test",
  "workflow",
  "debug",
  "sdfe",
  "sdf",
  "dummy",
  "demo",
  "sample",
  "multi image prod",
];

export type CandidatePoolStage =
  | "strict_product_type"
  | "title_tag_match"
  | "empty";

export type CandidatePoolResult = {
  products: MerchantProduct[];
  stage: CandidatePoolStage;
  counts: {
    baseEligible: number;
    strictProductType: number;
    titleTagMatch: number;
  };
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string | null | undefined) {
  const normalized = normalizeText(value);
  return new Set(normalized.split(" ").filter(Boolean));
}

function hasExactAlias(text: string, tokens: Set<string>, alias: string) {
  const normalizedAlias = normalizeText(alias);
  if (!normalizedAlias) return false;

  if (normalizedAlias.includes(" ")) {
    return ` ${text} `.includes(` ${normalizedAlias} `);
  }

  return tokens.has(normalizedAlias);
}

function countExactAliasMatches(
  text: string,
  tokens: Set<string>,
  aliases: string[],
) {
  return aliases.reduce(
    (count, alias) => count + (hasExactAlias(text, tokens, alias) ? 1 : 0),
    0,
  );
}

function priceMatches(priceRange: PriceRange, price: number) {
  if (priceRange === "Under ₹300") return price < 300;
  if (priceRange === "₹300–₹500") return price >= 300 && price <= 500;
  return price >= 500;
}

function isTempStagedUrl(url: string | null | undefined) {
  if (!url) return false;
  return (
    url.includes("shopify-staged-uploads.storage.googleapis.com") ||
    url.includes("/tmp/")
  );
}

function getPrimaryImage(product: MerchantProduct) {
  if (product.image && !isTempStagedUrl(product.image)) return product.image;

  const permanentFromImages = (product.images ?? []).find(
    (url) => !!url && !isTempStagedUrl(url),
  );
  if (permanentFromImages) return permanentFromImages;

  const permanentFromImageUrls = (product.imageUrls ?? []).find(
    (url) => !!url && !isTempStagedUrl(url),
  );
  if (permanentFromImageUrls) return permanentFromImageUrls;

  return null;
}

function inventoryAllowed(product: MerchantProduct) {
  if (typeof product.price !== "number" || product.price <= 0) {
    return false;
  }

  const status = normalizeText(product.status);

  if (status === "rejected" || status === "deleted") {
    return false;
  }

  if (product.published === true) {
    return true;
  }

  if (!status) {
    return true;
  }

  return ["active", "approved", "pending", "update_in_review"].includes(status);
}

function includesMenWomenConflict(
  product: MerchantProduct,
  gender: "Women" | "Men",
) {
  const compactText = normalizeText(
    [
      product.title,
      product.productType ?? "",
      (product.tags ?? []).join(" "),
    ].join(" "),
  );

  const hasWomen =
    /\bwomen\b|\bwomens\b|\bladies\b|\bfemale\b|\bgirl\b|\bgirls\b/.test(
      compactText,
    );
  const hasMen = /\bmen\b|\bmens\b|\bmale\b|\bboy\b|\bboys\b/.test(compactText);

  if (gender === "Women" && hasMen) return true;
  if (gender === "Men" && hasWomen) return true;

  return false;
}

function isJunkProduct(product: MerchantProduct) {
  const title = normalizeText(product.title);
  const sku = normalizeText(product.sku);
  const full = normalizeText(
    [
      product.title,
      product.description ?? "",
      product.productType ?? "",
      (product.tags ?? []).join(" "),
    ].join(" "),
  );

  return JUNK_PATTERNS.some(
    (pattern) =>
      title.includes(pattern) ||
      sku.includes(pattern) ||
      full.includes(pattern),
  );
}

function categorySignals(product: MerchantProduct, selectedCategory: string) {
  const productTypeText = normalizeText(product.productType);
  const productTypeTokens = tokenize(product.productType);

  const titleTagText = normalizeText(
    [product.title, (product.tags ?? []).join(" ")].join(" "),
  );
  const titleTagTokens = tokenize(
    [product.title, (product.tags ?? []).join(" ")].join(" "),
  );

  const allText = normalizeText(
    [product.productType, product.title, (product.tags ?? []).join(" ")].join(
      " ",
    ),
  );
  const allTokens = tokenize(
    [product.productType, product.title, (product.tags ?? []).join(" ")].join(
      " ",
    ),
  );

  const productTypeAliases =
    CATEGORY_PRODUCT_TYPE_ALIASES[selectedCategory] ?? [];
  const titleTagAliases = CATEGORY_TITLE_TAG_ALIASES[selectedCategory] ?? [];
  const conflictAliases = CATEGORY_CONFLICT_ALIASES[selectedCategory] ?? [];

  const productTypeHits = countExactAliasMatches(
    productTypeText,
    productTypeTokens,
    productTypeAliases,
  );
  const titleTagHits = countExactAliasMatches(
    titleTagText,
    titleTagTokens,
    titleTagAliases,
  );
  const conflictHits = countExactAliasMatches(
    allText,
    allTokens,
    conflictAliases,
  );

  const strictMatch = productTypeHits > 0 && conflictHits === 0;
  const titleTagMatch =
    productTypeHits === 0 && titleTagHits > 0 && conflictHits === 0;

  return {
    strictMatch,
    titleTagMatch,
    productTypeHits,
    titleTagHits,
    conflictHits,
    totalScore: productTypeHits * 10 + titleTagHits * 5 - conflictHits * 20,
  };
}

function buildReason(parts: string[]) {
  const filtered = [...new Set(parts.filter(Boolean))];
  return filtered.length > 0
    ? filtered.join(" ")
    : "Good match for your selected filters.";
}

export function buildCandidatePool(args: {
  products: MerchantProduct[];
  gender: "Women" | "Men";
  category: string;
  priceRange: PriceRange;
}): CandidatePoolResult {
  const baseEligible = args.products.filter((product) => {
    if (!inventoryAllowed(product)) return false;
    if (isJunkProduct(product)) return false;
    if (
      typeof product.price !== "number" ||
      !priceMatches(args.priceRange, product.price)
    )
      return false;
    // Do not block products just because the Firestore mirror is missing image fields.
    // The storefront and Firestore mirror can drift, so keep the product in the pool.    if (includesMenWomenConflict(product, args.gender)) return false;
    return true;
  });

  const strict = baseEligible.filter(
    (product) => categorySignals(product, args.category).strictMatch,
  );
  const soft = baseEligible.filter(
    (product) => categorySignals(product, args.category).titleTagMatch,
  );

  if (strict.length > 0) {
    return {
      products: strict,
      stage: "strict_product_type",
      counts: {
        baseEligible: baseEligible.length,
        strictProductType: strict.length,
        titleTagMatch: soft.length,
      },
    };
  }

  if (soft.length > 0) {
    return {
      products: soft,
      stage: "title_tag_match",
      counts: {
        baseEligible: baseEligible.length,
        strictProductType: strict.length,
        titleTagMatch: soft.length,
      },
    };
  }

  return {
    products: [],
    stage: "empty",
    counts: {
      baseEligible: baseEligible.length,
      strictProductType: strict.length,
      titleTagMatch: soft.length,
    },
  };
}

export function scoreProducts(args: {
  products: MerchantProduct[];
  gender: "Women" | "Men";
  vibe: string;
  category: string;
  priceRange: PriceRange;
  occasionContext: OccasionContext;
  imageSignals: ImageSignals;
  maxResults?: number;
}): RecommendedProduct[] {
  const vibeAliases = VIBE_KEYWORDS[args.vibe] ?? [normalizeText(args.vibe)];
  const maxResults = args.maxResults ?? 100;

  return args.products
    .map((product) => {
      const fullText = normalizeText(
        [
          product.title,
          product.description ?? "",
          product.productType ?? "",
          (product.tags ?? []).join(" "),
        ].join(" "),
      );
      const fullTokens = tokenize(
        [
          product.title,
          product.description ?? "",
          product.productType ?? "",
          (product.tags ?? []).join(" "),
        ].join(" "),
      );

      const imageUrl = getPrimaryImage(product);
      const cat = categorySignals(product, args.category);
      const vibeHits = countExactAliasMatches(
        fullText,
        fullTokens,
        vibeAliases,
      );

      let score = 0;
      const reasons: string[] = [];

      score += 30 + Math.max(0, cat.totalScore) * 3;
      if (cat.totalScore > 0) {
        reasons.push("Strong category fit.");
      }

      score += vibeHits * 8;
      if (vibeHits > 0) {
        reasons.push("Matches your selected vibe.");
      }

      if (imageUrl) {
  score += 5;
}

      return {
        id: product.id,
        title: product.title || "Untitled product",
        description: product.description ?? "",
        price: product.price ?? 0,
        currency: product.currency ?? "INR",
        imageUrl,
        merchantId: product.merchantId ?? "",
        sku: product.sku ?? "",
        vendor: product.vendor ?? "DRIPPR Marketplace",
        score,
        reason: buildReason(reasons),
        shopifyProductId: product.shopifyProductId ?? null,
        storeUrl: null,
      };
    })
    .sort((a, b) => b.score - a.score || a.price - b.price)
    .slice(0, maxResults);
}
