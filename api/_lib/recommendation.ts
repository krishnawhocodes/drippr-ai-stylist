import type {
  ImageSignals,
  MerchantProduct,
  OccasionContext,
  PriceRange,
  RecommendedProduct,
} from "./schemas.js";

const VIBE_KEYWORDS: Record<string, string[]> = {
  Streetwear: [
    "street",
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

const CATEGORY_PRODUCT_TYPES: Record<string, string[]> = {
  "Tops & Dresses": [
    "tops",
    "top",
    "dress",
    "dresses",
    "blouse",
    "shirt",
    "shirts",
    "kurta",
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
  ],
  Tees: ["tee", "tees", "t-shirt", "tshirt", "t shirts", "polo"],
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
  "Cord Set": [
    "cord set",
    "co-ord",
    "coord",
    "co ord",
    "set",
    "sets",
    "kurta set",
  ],
  Athleisure: [
    "athleisure",
    "sportswear",
    "activewear",
    "gymwear",
    "trackwear",
  ],
};

const CATEGORY_TEXT_FALLBACK: Record<string, string[]> = {
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
    "pant",
    "pants",
    "trouser",
    "jogger",
    "jeans",
    "denim",
  ],
  Tees: ["tee", "t-shirt", "tshirt", "polo"],
  "Shorts & Skirts": ["short", "shorts", "skirt"],
  "Sweatshirts & Hoodies": ["sweatshirt", "hoodie", "pullover"],
  Jackets: ["jacket", "coat", "blazer", "overshirt", "windbreaker", "bomber"],
  "Cord Set": ["co-ord", "coord", "cord set", "set", "kurta set"],
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
  | "soft_text_match"
  | "fallback_base_pool";

export type CandidatePoolResult = {
  products: MerchantProduct[];
  stage: CandidatePoolStage;
  counts: {
    baseEligible: number;
    strictProductType: number;
    softTextMatch: number;
  };
};

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function joinProductText(product: MerchantProduct) {
  const tags = (product.tags ?? []).join(" ");
  return normalizeText(
    [
      product.title,
      product.description ?? "",
      product.productType ?? "",
      product.vendor ?? "",
      tags,
    ].join(" "),
  );
}

function hasKeyword(text: string, keyword: string) {
  return text.includes(normalizeText(keyword));
}

function countMatches(text: string, keywords: string[]) {
  return keywords.reduce(
    (count, keyword) => count + (hasKeyword(text, keyword) ? 1 : 0),
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
  const status = normalizeText(product.status);

  if (status && !["active", "approved"].includes(status)) return false;
  if (typeof product.inventoryQty === "number" && product.inventoryQty <= 0)
    return false;

  return typeof product.price === "number" && product.price > 0;
}

function includesMenWomenConflict(text: string, gender: "Women" | "Men") {
  const hasWomen =
    /\bwomen\b|\bwomens\b|\bladies\b|\bfemale\b|\bgirl\b|\bgirls\b/.test(text);
  const hasMen = /\bmen\b|\bmens\b|\bmale\b|\bboy\b|\bboys\b/.test(text);

  if (gender === "Women" && hasMen) return true;
  if (gender === "Men" && hasWomen) return true;

  return false;
}

function isJunkProduct(product: MerchantProduct) {
  const title = normalizeText(product.title);
  const sku = normalizeText(product.sku);
  const text = joinProductText(product);

  return JUNK_PATTERNS.some(
    (pattern) =>
      title.includes(pattern) ||
      sku.includes(pattern) ||
      text.includes(pattern),
  );
}

function categorySignals(product: MerchantProduct, selectedCategory: string) {
  const productTypeText = normalizeText(product.productType);
  const fullText = joinProductText(product);

  const productTypeKeywords = CATEGORY_PRODUCT_TYPES[selectedCategory] ?? [];
  const fallbackKeywords = CATEGORY_TEXT_FALLBACK[selectedCategory] ?? [];

  const productTypeHits = countMatches(productTypeText, productTypeKeywords);
  const textHits = countMatches(fullText, fallbackKeywords);
  const totalScore = productTypeHits * 10 + textHits * 4;

  return {
    productTypeHits,
    textHits,
    totalScore,
  };
}

function buildReason(parts: string[]) {
  const filtered = [...new Set(parts.filter(Boolean))];
  return filtered.length > 0
    ? filtered.join(" ")
    : "Good match for your selected category and occasion.";
}

function occasionBoost(text: string, occasionContext: OccasionContext) {
  let boost = 0;

  boost += countMatches(text, occasionContext.preferredKeywords) * 5;
  boost -= countMatches(text, occasionContext.avoidKeywords) * 7;
  boost += countMatches(text, occasionContext.preferredProductTypes) * 5;

  if (occasionContext.timeOfDay === "night") {
    boost +=
      countMatches(text, [
        "night",
        "evening",
        "party",
        "statement",
        "black",
        "navy",
      ]) * 2;
  }

  if (occasionContext.season === "summer") {
    boost +=
      countMatches(text, [
        "summer",
        "lightweight",
        "breathable",
        "cotton",
        "linen",
      ]) * 2;
  }

  if (occasionContext.formality === "semi_formal") {
    boost +=
      countMatches(text, ["elegant", "structured", "refined", "party"]) * 2;
    boost -=
      countMatches(text, ["loungewear", "gym", "workout", "airport look"]) * 4;
  }

  if (occasionContext.formality === "festive") {
    boost +=
      countMatches(text, ["festive", "ethnic", "traditional", "embroidered"]) *
      3;
  }

  return boost;
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
    if (!getPrimaryImage(product)) return false;

    const text = joinProductText(product);
    return !includesMenWomenConflict(text, args.gender);
  });

  const strict = baseEligible.filter(
    (product) => categorySignals(product, args.category).productTypeHits > 0,
  );
  const soft = baseEligible.filter(
    (product) => categorySignals(product, args.category).totalScore > 0,
  );

  if (strict.length > 0) {
    return {
      products: strict,
      stage: "strict_product_type",
      counts: {
        baseEligible: baseEligible.length,
        strictProductType: strict.length,
        softTextMatch: soft.length,
      },
    };
  }

  if (soft.length > 0) {
    return {
      products: soft,
      stage: "soft_text_match",
      counts: {
        baseEligible: baseEligible.length,
        strictProductType: strict.length,
        softTextMatch: soft.length,
      },
    };
  }

  return {
    products: baseEligible,
    stage: "fallback_base_pool",
    counts: {
      baseEligible: baseEligible.length,
      strictProductType: strict.length,
      softTextMatch: soft.length,
    },
  };
}

export function extractKeywordUniverse(products: MerchantProduct[]) {
  const keywordCounts = new Map<string, number>();
  const productTypes = new Set<string>();

  for (const product of products) {
    const text = joinProductText(product);
    const words = text.split(" ").filter((word) => word.length >= 4);

    for (const word of words) {
      keywordCounts.set(word, (keywordCounts.get(word) ?? 0) + 1);
    }

    if (product.productType) {
      productTypes.add(normalizeText(product.productType));
    }
  }

  const availableKeywords = [...keywordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([word]) => word);

  const availableProductTypes = [...productTypes].slice(0, 20);

  return { availableKeywords, availableProductTypes };
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
  const vibeWords = VIBE_KEYWORDS[args.vibe] ?? [normalizeText(args.vibe)];
  const maxResults = args.maxResults ?? 12;

  return args.products
    .map((product) => {
      const text = joinProductText(product);
      const imageUrl = getPrimaryImage(product);
      const cat = categorySignals(product, args.category);

      let score = 0;
      const reasons: string[] = [];

      score += 20 + cat.totalScore * 3;
      if (cat.totalScore > 0) {
        reasons.push("Strong category fit.");
      }

      const vibeHits = countMatches(text, vibeWords);
      score += vibeHits * 8;
      if (vibeHits > 0) {
        reasons.push("Matches your selected vibe.");
      }

      const rerank = occasionBoost(text, args.occasionContext);
      score += rerank;
      if (rerank > 0) {
        reasons.push("Works well for your occasion.");
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
      };
    })
    .sort((a, b) => b.score - a.score || a.price - b.price)
    .slice(0, maxResults);
}
