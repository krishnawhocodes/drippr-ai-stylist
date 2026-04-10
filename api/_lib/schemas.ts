import { z } from "zod";

export const genderSchema = z.enum(["Women", "Men"]);

export const priceRangeSchema = z.enum(["Under ₹300", "₹300–₹500", "₹500+"]);

export const base64ImageSchema = z
  .string()
  .min(50, "Image is required")
  .regex(
    /^data:image\/(png|jpeg|jpg|webp);base64,/i,
    "Image must be a base64 data URL",
  );

export const photoValidationSummarySchema = z.object({
  personCount: z.number().int().min(0),
  visibleParts: z.object({
    head: z.boolean(),
    shoulders: z.boolean(),
    hips: z.boolean(),
    knees: z.boolean(),
    ankles: z.boolean(),
  }),
  framing: z.enum(["full_body", "partial_body", "unknown"]),
  facing: z.enum(["front", "three_quarter", "side", "unknown"]),
  posture: z.enum(["upright", "slightly_angled", "dynamic", "unknown"]),
  visibilityScore: z.number().min(0).max(1),
});

export const photoValidationResultSchema = z.object({
  isValid: z.boolean(),
  reason: z.string().nullable(),
  summary: photoValidationSummarySchema,
});

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
  avoidKeywords: z.array(z.string()).max(10),
  confidence: z.number().min(0).max(1),
});

export const photoAnalyzeRequestSchema = z.object({
  imageDataUrl: base64ImageSchema,
  gender: genderSchema.optional(),
  vibe: z.string().min(1).max(80).optional(),
  category: z.string().min(1).max(120).optional(),
});

export const occasionParseRequestSchema = z.object({
  occasion: z.string().trim().min(2).max(800),
  gender: genderSchema.optional(),
  vibe: z.string().min(1).max(80).optional(),
  category: z.string().min(1).max(120).optional(),
});

export const recommendRequestSchema = z.object({
  gender: genderSchema,
  vibe: z.string().min(1).max(80),
  category: z.string().min(1).max(120),
  occasion: z.string().trim().min(2).max(800),
  priceRange: priceRangeSchema,
  imageDataUrl: base64ImageSchema.nullable().optional().default(null),
  photoValidation: photoValidationResultSchema
    .nullable()
    .optional()
    .default(null),
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
  imageSignals: imageSignalsSchema,
  occasionContext: occasionContextSchema,
  products: z.array(recommendedProductSchema),
});

export type Gender = z.infer<typeof genderSchema>;
export type PriceRange = z.infer<typeof priceRangeSchema>;
export type PhotoValidationResult = z.infer<typeof photoValidationResultSchema>;
export type ImageSignals = z.infer<typeof imageSignalsSchema>;
export type OccasionContext = z.infer<typeof occasionContextSchema>;
export type RecommendRequest = z.infer<typeof recommendRequestSchema>;
export type MerchantProduct = z.infer<typeof merchantProductSchema>;
export type RecommendedProduct = z.infer<typeof recommendedProductSchema>;
export type RecommendResponse = z.infer<typeof recommendResponseSchema>;
