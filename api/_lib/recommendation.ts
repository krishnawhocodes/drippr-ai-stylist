import type {
  ImageSignals,
  MerchantProduct,
  OccasionContext,
  PriceRange,
  RecommendedProduct,
} from "./schemas";

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
  Minimal: [
    "minimal",
    "clean",
    "solid",
    "plain",
    "tailored",
    "satin",
    "linen",
    "classic",
  ],
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
  "Sweatshirts & Hoodies": ["hoodie", "sweatshirt", "pullover"],
  Jackets: ["jacket", "overshirt", "windbreaker", "bomber", "trucker"],
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
    "satin",
    "wrap",
    "midi",
    "kurta set",
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
  winter: ["hoodie", "sweatshirt", "jacket", "heavyweight", "knit"],
  monsoon: ["quick dry", "tech", "lightweight", "track"],
  spring: ["floral", "light", "cotton", "airy"],
  autumn: ["earth", "olive", "brown", "layer"],
  all_season: [],
  unknown: [],
};

const TIME_KEYWORDS: Record<OccasionContext["timeOfDay"], string[]> = {
  day: ["cotton", "linen", "light", "casual"],
  evening: ["dress", "smart", "satin", "tailored"],
  night: ["black", "navy", "statement", "dress", "bomber", "elegant"],
  unknown: [],
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
  const imageNames = [
    ...(product.imageUrls ?? []),
    ...(product.images ?? []),
  ].join(" ");

  return normalizeText(
    [
      product.title,
      product.description ?? "",
      product.productType ?? "",
      product.vendor ?? "",
      tags,
      imageNames,
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

function getPrimaryImage(product: MerchantProduct) {
  return product.image ?? product.imageUrls?.[0] ?? product.images?.[0] ?? null;
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
  const {
    products,
    vibe,
    category,
    priceRange,
    occasionContext,
    imageSignals,
    maxResults = 12,
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

  const ranked = products
    .filter(inventoryAllowed)
    .filter(
      (product) =>
        typeof product.price === "number" &&
        priceMatches(priceRange, product.price),
    )
    .map((product) => {
      const text = joinProductText(product);

      let score = 0;
      const reasonParts: string[] = [];

      const categoryHits = countMatches(text, categoryWords);
      if (categoryHits > 0) {
        score += 26 + categoryHits * 3;
        reasonParts.push("Category fit looks strong.");
      }

      const vibeHits = countMatches(text, vibeWords);
      if (vibeHits > 0) {
        score += 18 + vibeHits * 2;
        reasonParts.push("Matches your selected vibe.");
      }

      const occasionHits = countMatches(text, occasionWords);
      if (occasionHits > 0) {
        score += 16 + occasionHits * 2;
        reasonParts.push("Aligned with the occasion context.");
      }

      const formalityHits = countMatches(text, formalityWords);
      if (formalityHits > 0) {
        score += 14 + formalityHits * 2;
        reasonParts.push("Formality level looks right.");
      }

      const seasonHits = countMatches(text, seasonWords);
      if (seasonHits > 0) {
        score += 8 + seasonHits;
        reasonParts.push("Works for the season.");
      }

      const timeHits = countMatches(text, timeWords);
      if (timeHits > 0) {
        score += 6 + timeHits;
        reasonParts.push("Fits the time of day.");
      }

      const fitHits = countMatches(text, fitWords);
      if (fitHits > 0) {
        score += 8 + fitHits;
        reasonParts.push("Shape and fit cues are compatible.");
      }

      const imageVibeHits = countMatches(
        text,
        imageSignals.vibeTags.map((item) => normalizeText(item)),
      );
      if (imageVibeHits > 0) {
        score += 10 + imageVibeHits;
        reasonParts.push("Connects well with your photo style cues.");
      }

      const colorHits = deriveColorMatches(text, imageSignals);
      if (colorHits > 0) {
        score += 4 + colorHits;
        reasonParts.push("Color direction is compatible.");
      }

      if (getPrimaryImage(product)) {
        score += 2;
      }

      if (!product.productType && !(product.tags ?? []).length) {
        score -= 4;
      }

      const recommended: RecommendedProduct = {
        id: product.id,
        title: product.title || "Untitled product",
        description: product.description ?? "",
        price: product.price ?? 0,
        currency: product.currency ?? "INR",
        imageUrl: getPrimaryImage(product),
        merchantId: product.merchantId ?? "",
        sku: product.sku ?? "",
        vendor: product.vendor ?? "DRIPPR Marketplace",
        score,
        reason: buildReason(reasonParts),
        shopifyProductId: product.shopifyProductId ?? null,
      };

      return recommended;
    })
    .filter((product) => product.score > 0)
    .sort((a, b) => b.score - a.score || a.price - b.price)
    .slice(0, maxResults);

  return ranked;
}
