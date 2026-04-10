import { z } from "zod";

export const genderSchema = z.enum(["Women", "Men"]);
export const priceRangeSchema = z.enum(["Under ₹300", "₹300–₹500", "₹500+"]);

export const imageSignalsSchema = z.object({
  dominantColors: z.array(z.string()).max(8),
  paletteTemperature: z.enum(["warm", "cool", "neutral", "unknown"]),
  skinToneBand: z.enum(["light", "medium", "deep", "unknown"]),
  undertone: z.enum(["warm", "cool", "neutral", "unknown"]),
  fitCues: z.array(z.string()).max(8),
  vibeTags: z.array(z.string()).max(8),
  visibleGarments: z.array(z.string()).max(8),
  confidence: z.number().min(0).max(1),
});

export const occasionContextSchema = z.object({
  eventType: z.string(),
  timeOfDay: z.enum(["day", "night", "evening", "unknown"]),
  season: z.enum([
    "summer",
    "winter",
    "monsoon",
    "spring",
    "autumn",
    "all_season",
    "unknown",
  ]),
  formality: z.enum([
    "casual",
    "smart_casual",
    "semi_formal",
    "formal",
    "festive",
    "unknown",
  ]),
  comfortPriority: z.enum(["low", "medium", "high"]),
  styleDirection: z.array(z.string()).max(10),
  preferredKeywords: z.array(z.string()).max(20),
  avoidKeywords: z.array(z.string()).max(20),
  preferredProductTypes: z.array(z.string()).max(10),
  confidence: z.number().min(0).max(1),
});

export const recommendRequestSchema = z.object({
  gender: genderSchema,
  vibe: z.string().min(1).max(80),
  category: z.string().min(1).max(120),
  occasion: z.string().trim().min(2).max(800),
  priceRange: priceRangeSchema,
});

export const merchantProductSchema = z.object({
  id: z.string(),
  title: z.string().default(""),
  description: z.string().nullable().optional(),
  price: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  vendor: z.string().nullable().optional(),
  productType: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  imageUrls: z.array(z.string()).nullable().optional(),
  images: z.array(z.string()).nullable().optional(),
  image: z.string().nullable().optional(),
  inventoryQty: z.number().nullable().optional(),
  merchantId: z.string().nullable().optional(),
  shopifyProductId: z.string().nullable().optional(),
  createdAt: z.number().nullable().optional(),
  updatedAt: z.number().nullable().optional(),
});

export const recommendedProductSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  price: z.number(),
  currency: z.string(),
  imageUrl: z.string().nullable(),
  merchantId: z.string(),
  sku: z.string(),
  vendor: z.string(),
  score: z.number(),
  reason: z.string(),
  shopifyProductId: z.string().nullable(),
});

export const recommendResponseSchema = z.object({
  occasionContext: occasionContextSchema,
  products: z.array(recommendedProductSchema),
});

export type Gender = z.infer<typeof genderSchema>;
export type PriceRange = z.infer<typeof priceRangeSchema>;
export type ImageSignals = z.infer<typeof imageSignalsSchema>;
export type OccasionContext = z.infer<typeof occasionContextSchema>;
export type RecommendRequest = z.infer<typeof recommendRequestSchema>;
export type MerchantProduct = z.infer<typeof merchantProductSchema>;
export type RecommendedProduct = z.infer<typeof recommendedProductSchema>;
export type RecommendResponse = z.infer<typeof recommendResponseSchema>;
