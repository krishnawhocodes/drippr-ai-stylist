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
    "cargo",
    "bomber",
    "hoodie",
    "utility",
    "graphic",
  ],
  Minimal: ["minimal", "clean", "solid", "plain", "tailored", "classic"],
  Daily: ["daily", "everyday", "casual", "basic", "regular", "easy", "comfort"],
  Thrift: [
    "vintage",
    "retro",
    "washed",
    "distressed",
    "denim",
    "corduroy",
    "thrift",
  ],
  Fusion: [
    "fusion",
    "kurta",
    "ethnic",
    "indo",
    "traditional",
    "embroidered",
    "block print",
  ],
  Athleisure: [
    "athleisure",
    "active",
    "sport",
    "sports",
    "track",
    "jogger",
    "running",
    "performance",
  ],
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Tops & Dresses": [
    "top",
    "dress",
    "blouse",
    "shirt",
    "kurta",
    "crop top",
    "tank",
  ],
  "Cargo & Pants": [
    "cargo",
    "pant",
    "pants",
    "trouser",
    "trousers",
    "jogger",
    "jeans",
    "chino",
  ],
  Tees: ["tee", "t-shirt", "tshirt", "polo"],
  "Shorts & Skirts": ["short", "shorts", "skirt", "mini", "midi"],
  "Sweatshirts & Hoodies": ["hoodie", "sweatshirt", "pullover", "hood"],
  Jackets: ["jacket", "overshirt", "windbreaker", "bomber", "trucker", "coat"],
  "Cord Set": ["set", "co-ord", "coord", "co ord", "cord set", "kurta set"],
  Athleisure: ["athleisure", "sports", "track", "active", "gym", "running"],
};

const COLOR_WORDS = [
  "black",
  "white",
  "grey",
  "gray",
  "navy",
  "blue",
  "beige",
  "brown",
  "olive",
  "green",
  "pink",
  "red",
  "maroon",
  "burgundy",
  "cream",
  "ivory",
  "yellow",
  "mustard",
  "purple",
  "lavender",
  "orange",
  "teal",
  "gold",
  "silver",
];

const FORMALITY_KEYWORDS: Record<OccasionContext["formality"], string[]> = {
  casual: [
    "tee",
    "t-shirt",
    "tshirt",
    "shorts",
    "casual",
    "everyday",
    "oversized",
    "cargo",
  ],
  smart_casual: [
    "shirt",
    "polo",
    "trouser",
    "trousers",
    "blouse",
    "linen",
    "chino",
    "dress",
  ],
  semi_formal: [
    "dress",
    "tailored",
    "blazer",
    "wrap",
    "midi",
    "kurta set",
    "party",
    "elegant",
  ],
  formal: ["formal", "tailored", "blazer", "shirt", "trouser", "classic"],
  festive: [
    "embroidered",
    "kurta",
    "ethnic",
    "block print",
    "festive",
    "traditional",
  ],
  unknown: [],
};

const SEASON_KEYWORDS: Record<OccasionContext["season"], string[]> = {
  summer: ["linen", "lightweight", "cotton", "breathable", "tank", "shorts"],
  winter: ["hoodie", "sweatshirt", "jacket", "coat", "heavyweight", "knit"],
  monsoon: ["quick dry", "tech", "lightweight", "track"],
  spring: ["floral", "light", "cotton", "airy"],
  autumn: ["earth", "olive", "brown", "layer"],
  all_season: [],
  unknown: [],
};

const TIME_KEYWORDS: Record<OccasionContext["timeOfDay"], string[]> = {
  day: ["cotton", "linen", "light", "casual"],
  evening: ["dress", "smart", "tailored"],
  night: ["black", "navy", "statement", "dress", "bomber", "elegant", "party"],
  unknown: [],
};

export type DebugProductResult = {
  id: string;
  title: string;
  price: number;
  currency: string;
  status: string | null | undefined;
  sku: string | null | undefined;
  merchantId: string | null | undefined;
  productType: string | null | undefined;
  imageUrl: string | null;
  imageSource: "image" | "images" | "imageUrls" | "none";
  text: string;
  budgetMatched: boolean;
  inventoryAllowed: boolean;
  categoryMatched: boolean;
  genderMatched: boolean;
  genderConflict: boolean;
  categoryHits: number;
  genderHits: number;
  vibeHits: number;
  occasionHits: number;
  formalityHits: number;
  seasonHits: number;
  timeHits: number;
  fitHits: number;
  imageVibeHits: number;
  colorHits: number;
  score: number;
  selected: boolean;
  reasons: string[];
  rejectedReasons: string[];
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

function getPrimaryImageWithSource(product: MerchantProduct): {
  imageUrl: string | null;
  imageSource: "image" | "images" | "imageUrls" | "none";
} {
  if (product.image && !isTempStagedUrl(product.image)) {
    return { imageUrl: product.image, imageSource: "image" };
  }

  const permanentFromImages = (product.images ?? []).find(
    (url) => !!url && !isTempStagedUrl(url),
  );
  if (permanentFromImages) {
    return { imageUrl: permanentFromImages, imageSource: "images" };
  }

  const permanentFromImageUrls = (product.imageUrls ?? []).find(
    (url) => !!url && !isTempStagedUrl(url),
  );
  if (permanentFromImageUrls) {
    return { imageUrl: permanentFromImageUrls, imageSource: "imageUrls" };
  }

  return { imageUrl: null, imageSource: "none" };
}

function inventoryAllowed(product: MerchantProduct) {
  const status = normalizeText(product.status);

  if (status && !["active", "approved"].includes(status)) {
    return false;
  }

  if (typeof product.inventoryQty === "number" && product.inventoryQty <= 0) {
    return false;
  }

  return typeof product.price === "number" && product.price > 0;
}

function deriveColorMatches(text: string, imageSignals: ImageSignals) {
  const productColors = COLOR_WORDS.filter((color) => hasKeyword(text, color));
  const requestedColors = imageSignals.dominantColors.map((color) =>
    normalizeText(color),
  );

  if (requestedColors.length === 0 || productColors.length === 0) {
    return 0;
  }

  return requestedColors.reduce(
    (sum, color) => sum + (productColors.includes(color) ? 1 : 0),
    0,
  );
}

function buildReason(parts: string[]) {
  const filtered = [...new Set(parts.filter(Boolean))];
  return filtered.length > 0
    ? filtered.join(" ")
    : "Strong fit for your occasion and budget.";
}

function includesMenWomenConflict(text: string, gender: "Women" | "Men") {
  const hasWomen =
    /\bwomen\b|\bwomens\b|\bladies\b|\bfemale\b|\bgirl\b|\bgirls\b/.test(text);
  const hasMen = /\bmen\b|\bmens\b|\bmale\b|\bboy\b|\bboys\b/.test(text);

  if (gender === "Women" && hasMen) return true;
  if (gender === "Men" && hasWomen) return true;

  return false;
}

function buildDebugResults(args: {
  products: MerchantProduct[];
  gender: "Women" | "Men";
  vibe: string;
  category: string;
  priceRange: PriceRange;
  occasionContext: OccasionContext;
  imageSignals: ImageSignals;
}): DebugProductResult[] {
  const {
    products,
    gender,
    vibe,
    category,
    priceRange,
    occasionContext,
    imageSignals,
  } = args;

  const vibeWords = VIBE_KEYWORDS[vibe] ?? [normalizeText(vibe)];
  const categoryWords = CATEGORY_KEYWORDS[category] ?? [
    normalizeText(category),
  ];
  const formalityWords = FORMALITY_KEYWORDS[occasionContext.formality];
  const seasonWords = SEASON_KEYWORDS[occasionContext.season];
  const timeWords = TIME_KEYWORDS[occasionContext.timeOfDay];
  const fitWords = imageSignals.fitCues.map((item) => normalizeText(item));
  const occasionWords = [
    normalizeText(occasionContext.eventType),
    ...occasionContext.styleDirection.map((item) => normalizeText(item)),
  ].filter(Boolean);

  const genderWords =
    gender === "Women"
      ? ["women", "woman", "womens", "ladies", "female", "girls", "girl"]
      : ["men", "man", "mens", "male", "boys", "boy"];

  return products.map((product) => {
    const text = joinProductText(product);
    const categoryHits = countMatches(text, categoryWords);
    const genderHits = countMatches(text, genderWords);
    const vibeHits = countMatches(text, vibeWords);
    const occasionHits = countMatches(text, occasionWords);
    const formalityHits = countMatches(text, formalityWords);
    const seasonHits = countMatches(text, seasonWords);
    const timeHits = countMatches(text, timeWords);
    const fitHits = countMatches(text, fitWords);
    const imageVibeHits = countMatches(
      text,
      imageSignals.vibeTags.map((item) => normalizeText(item)),
    );
    const colorHits = deriveColorMatches(text, imageSignals);

    const budgetMatched =
      typeof product.price === "number" &&
      priceMatches(priceRange, product.price);
    const allowed = inventoryAllowed(product);
    const categoryMatched = categoryHits > 0;
    const genderConflict = includesMenWomenConflict(text, gender);
    const genderMatched = genderHits > 0 || !genderConflict;

    const { imageUrl, imageSource } = getPrimaryImageWithSource(product);

    let score = 0;
    const reasons: string[] = [];
    const rejectedReasons: string[] = [];

    if (!allowed) rejectedReasons.push("Inventory/status not allowed");
    if (!budgetMatched) rejectedReasons.push("Outside strict budget");
    if (!categoryMatched) rejectedReasons.push("No category match");
    if (!genderMatched) rejectedReasons.push("Gender conflict");
    if (!imageUrl) rejectedReasons.push("No usable image");

    if (allowed && budgetMatched && categoryMatched && genderMatched) {
      score += 35 + categoryHits * 4;
      reasons.push("Category fit looks strong.");

      if (genderHits > 0) {
        score += 10;
        reasons.push("Matches the selected profile.");
      }

      if (vibeHits > 0) {
        score += 18 + vibeHits * 2;
        reasons.push("Matches your selected vibe.");
      }

      if (occasionHits > 0) {
        score += 16 + occasionHits * 2;
        reasons.push("Aligned with the occasion context.");
      }

      if (formalityHits > 0) {
        score += 12 + formalityHits * 2;
        reasons.push("Formality level looks right.");
      }

      if (seasonHits > 0) {
        score += 8 + seasonHits;
        reasons.push("Works for the season.");
      }

      if (timeHits > 0) {
        score += 6 + timeHits;
        reasons.push("Fits the time of day.");
      }

      if (fitHits > 0) {
        score += 8 + fitHits;
        reasons.push("Shape and fit cues are compatible.");
      }

      if (imageVibeHits > 0) {
        score += 8 + imageVibeHits;
        reasons.push("Connects well with your photo style cues.");
      }

      if (colorHits > 0) {
        score += 4 + colorHits;
        reasons.push("Color direction is compatible.");
      }

      if (
        occasionContext.formality === "semi_formal" &&
        (text.includes("loungewear") ||
          text.includes("airport look") ||
          text.includes("everyday"))
      ) {
        score -= 18;
        rejectedReasons.push("Too casual for the requested occasion.");
      }

      if (occasionContext.timeOfDay === "night" && text.includes("gym")) {
        score -= 12;
        rejectedReasons.push("Too sporty for this night occasion.");
      }

      if (imageUrl) {
        score += 3;
      } else {
        score -= 20;
      }

      if (!product.productType && !(product.tags ?? []).length) {
        score -= 6;
        rejectedReasons.push("Weak metadata");
      }
    }

    const selected =
      allowed &&
      budgetMatched &&
      categoryMatched &&
      genderMatched &&
      Boolean(imageUrl) &&
      score >= 45;

    return {
      id: product.id,
      title: product.title || "Untitled product",
      price: product.price ?? 0,
      currency: product.currency ?? "INR",
      status: product.status,
      sku: product.sku,
      merchantId: product.merchantId,
      productType: product.productType,
      imageUrl,
      imageSource,
      text,
      budgetMatched,
      inventoryAllowed: allowed,
      categoryMatched,
      genderMatched,
      genderConflict,
      categoryHits,
      genderHits,
      vibeHits,
      occasionHits,
      formalityHits,
      seasonHits,
      timeHits,
      fitHits,
      imageVibeHits,
      colorHits,
      score,
      selected,
      reasons,
      rejectedReasons,
    };
  });
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
  const debugResults = buildDebugResults(args);

  return debugResults
    .filter((item) => item.selected)
    .sort((a, b) => b.score - a.score || a.price - b.price)
    .slice(0, args.maxResults ?? 12)
    .map((item) => ({
      id: item.id,
      title: item.title,
      description: "",
      price: item.price,
      currency: item.currency,
      imageUrl: item.imageUrl,
      merchantId: item.merchantId ?? "",
      sku: item.sku ?? "",
      vendor: "DRIPPR Marketplace",
      score: item.score,
      reason: buildReason(item.reasons),
      shopifyProductId: null,
    }));
}

export function debugScoreProducts(args: {
  products: MerchantProduct[];
  gender: "Women" | "Men";
  vibe: string;
  category: string;
  priceRange: PriceRange;
  occasionContext: OccasionContext;
  imageSignals: ImageSignals;
}) {
  return buildDebugResults(args).sort(
    (a, b) => b.score - a.score || a.price - b.price,
  );
}
