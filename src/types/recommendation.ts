export type Gender = "Women" | "Men";
export type PriceRange =
  | "₹0 - ₹499"
  | "₹500 - ₹999"
  | "₹1,000 - ₹1,499"
  | "₹1,500 - ₹1,999"
  | "₹2,000 - ₹2,499"
  | "₹2,500 & above";

export interface PhotoValidationSummary {
  personCount: number;
  visibleParts: {
    head: boolean;
    shoulders: boolean;
    hips: boolean;
    knees: boolean;
    ankles: boolean;
  };
  framing: "full_body" | "partial_body" | "unknown";
  facing: "front" | "three_quarter" | "side" | "unknown";
  posture: "upright" | "slightly_angled" | "dynamic" | "unknown";
  visibilityScore: number;
}

export interface PhotoValidationResult {
  isValid: boolean;
  reason: string | null;
  summary: PhotoValidationSummary;
}

export interface ImageSignals {
  dominantColors: string[];
  paletteTemperature: "warm" | "cool" | "neutral" | "unknown";
  skinToneBand: "light" | "medium" | "deep" | "unknown";
  undertone: "warm" | "cool" | "neutral" | "unknown";
  fitCues: string[];
  vibeTags: string[];
  visibleGarments: string[];
  confidence: number;
}

export interface OccasionContext {
  eventType: string;
  timeOfDay: "day" | "night" | "evening" | "unknown";
  season:
    | "summer"
    | "winter"
    | "monsoon"
    | "spring"
    | "autumn"
    | "all_season"
    | "unknown";
  formality:
    | "casual"
    | "smart_casual"
    | "semi_formal"
    | "formal"
    | "festive"
    | "unknown";
  comfortPriority: "low" | "medium" | "high";
  styleDirection: string[];
  preferredKeywords: string[];
  avoidKeywords: string[];
  preferredProductTypes: string[];
  confidence: number;
}

export interface RecommendRequest {
  gender: Gender;
  vibe: string;
  category: string;
  occasion: string;
  priceRange: PriceRange;
}

export interface RecommendedProduct {
  id: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  soldOut: boolean;
  imageUrl: string | null;
  merchantId: string;
  sku: string;
  vendor: string;
  score: number;
  reason: string;
  shopifyProductId: string | null;
  storeUrl: string | null;
  addToCartUrl: string | null;
}

export interface RecommendResponse {
  occasionContext: OccasionContext;
  products: RecommendedProduct[];
}
