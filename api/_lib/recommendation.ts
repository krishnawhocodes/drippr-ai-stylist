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
  "Sweatshirts & Hoodies": [
    "hoodie",
    "sweatshirt",
    "pullover",
    "hood",
    "sweatshirts",
  ],
  Jackets: [
    "jacket",
    "overshirt",
    "windbreaker",
    "bomber",
    "trucker",
    "coat",
    "blazer",
  ],
  "Cord Set": ["set", "co-ord", "coord", "co ord", "cord set", "kurta set"],
  Athleisure: ["athleisure", "sports", "track", "active", "gym", "running"],
};

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "your",
  "you",
  "our",
  "are",
  "was",
  "will",
  "its",
  "their",
  "them",
  "have",
  "has",
  "had",
  "all",
  "only",
  "into",
  "over",
  "look",
  "looks",
  "wear",
  "wearing",
  "merchant",
  "marketplace",
  "drippr",
  "women",
  "womens",
  "men",
  "mens",
  "woman",
  "man",
  "product",
  "premium",
  "casual",
  "style",
  "fashion",
  "design",
  "solid",
  "color",
  "colour",
  "wear",
  "top",
  "tops",
]);

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

function buildReason(parts: string[]) {
  const filtered = [...new Set(parts.filter(Boolean))];
  return filtered.length > 0
    ? filtered.join(" ")
    : "Good match for your selected vibe and category.";
}

export function filterCuratedPool(args: {
  products: MerchantProduct[];
  gender: "Women" | "Men";
  vibe: string;
  category: string;
  priceRange: PriceRange;
}) {
  const { products, gender, vibe, category, priceRange } = args;

  const vibeWords = VIBE_KEYWORDS[vibe] ?? [normalizeText(vibe)];
  const categoryWords = CATEGORY_KEYWORDS[category] ?? [
    normalizeText(category),
  ];
  const genderWords =
    gender === "Women"
      ? ["women", "woman", "womens", "ladies", "female", "girls", "girl"]
      : ["men", "man", "mens", "male", "boys", "boy"];

  return products.filter((product) => {
    if (!inventoryAllowed(product)) return false;
    if (
      typeof product.price !== "number" ||
      !priceMatches(priceRange, product.price)
    )
      return false;
    if (!getPrimaryImage(product)) return false;

    const text = joinProductText(product);
    const categoryHits = countMatches(text, categoryWords);
    const vibeHits = countMatches(text, vibeWords);
    const genderHits = countMatches(text, genderWords);
    const genderConflict = includesMenWomenConflict(text, gender);

    return (
      categoryHits > 0 && vibeHits > 0 && (genderHits > 0 || !genderConflict)
    );
  });
}

export function extractKeywordUniverse(products: MerchantProduct[]) {
  const frequency = new Map<string, number>();
  const productTypes = new Set<string>();

  for (const product of products) {
    const text = joinProductText(product);
    const words = text.split(" ");

    for (const word of words) {
      if (word.length < 4) continue;
      if (STOPWORDS.has(word)) continue;
      frequency.set(word, (frequency.get(word) ?? 0) + 1);
    }

    if (product.productType) {
      productTypes.add(normalizeText(product.productType));
    }
  }

  const availableKeywords = [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([word]) => word);

  const availableProductTypes = [...productTypes].slice(0, 20);

  return { availableKeywords, availableProductTypes };
}

function occasionBoost(text: string, occasionContext: OccasionContext) {
  let boost = 0;

  boost += countMatches(text, occasionContext.preferredKeywords) * 6;
  boost -= countMatches(text, occasionContext.avoidKeywords) * 8;
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
      ]) * 3;
  }

  if (occasionContext.season === "summer") {
    boost +=
      countMatches(text, [
        "summer",
        "lightweight",
        "breathable",
        "cotton",
        "linen",
      ]) * 3;
  }

  if (occasionContext.formality === "semi_formal") {
    boost +=
      countMatches(text, ["elegant", "party", "structured", "refined"]) * 3;
    boost -=
      countMatches(text, ["loungewear", "gym", "workout", "airport look"]) * 5;
  }

  if (occasionContext.formality === "festive") {
    boost +=
      countMatches(text, ["festive", "traditional", "ethnic", "embroidered"]) *
      4;
  }

  return boost;
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
  const curatedPool = filterCuratedPool({
    products: args.products,
    gender: args.gender,
    vibe: args.vibe,
    category: args.category,
    priceRange: args.priceRange,
  });

  const vibeWords = VIBE_KEYWORDS[args.vibe] ?? [normalizeText(args.vibe)];
  const categoryWords = CATEGORY_KEYWORDS[args.category] ?? [
    normalizeText(args.category),
  ];
  const maxResults = args.maxResults ?? 12;

  return curatedPool
    .map((product) => {
      const text = joinProductText(product);
      const imageUrl = getPrimaryImage(product);

      let score = 0;
      const reasons: string[] = [];

      const categoryHits = countMatches(text, categoryWords);
      const vibeHits = countMatches(text, vibeWords);

      score += 35 + categoryHits * 5;
      reasons.push("Strong category fit.");

      score += 30 + vibeHits * 4;
      reasons.push("Matches your selected vibe.");

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
