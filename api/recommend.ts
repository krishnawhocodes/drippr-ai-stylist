import { getAdminDb } from "./_lib/firebaseAdmin.js";
import { analyzeStylePhoto, parseOccasionContext } from "./_lib/groq.js";
import { scoreProducts } from "./_lib/recommendation.js";
import {
  merchantProductSchema,
  recommendRequestSchema,
  recommendResponseSchema,
  type ImageSignals,
  type MerchantProduct,
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

function getDefaultImageSignals(): ImageSignals {
  return {
    dominantColors: [],
    paletteTemperature: "unknown",
    skinToneBand: "unknown",
    undertone: "unknown",
    fitCues: [],
    vibeTags: [],
    visibleGarments: [],
    confidence: 0,
  };
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message || error.name || "Unknown error";
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown non-serializable error";
  }
}

function safeErrorLog(label: string, error: unknown) {
  const message = safeErrorMessage(error);

  if (error instanceof Error) {
    console.error(label, {
      name: error.name,
      message,
      stack: error.stack,
    });
    return;
  }

  console.error(label, { message });
}

async function fetchCandidateProducts() {
  const adminDb = getAdminDb();

  const snapshot = await adminDb
    .collection("merchantProducts")
    .where("status", "in", ["active", "approved"])
    .get();

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

    if (body.photoValidation && !body.photoValidation.isValid) {
      return res.status(400).json({
        error:
          body.photoValidation.reason ||
          "Please upload a full-body photo from head to toe.",
      });
    }

    let imageSignals: ImageSignals = getDefaultImageSignals();
    let occasionContext;
    let products: MerchantProduct[] = [];

    try {
      if (body.imageDataUrl) {
        imageSignals = await analyzeStylePhoto({
          imageDataUrl: body.imageDataUrl,
          gender: body.gender,
          vibe: body.vibe,
          category: body.category,
        });
      }
    } catch (error) {
      safeErrorLog("recommend stage=image-analysis", error);
      throw new Error(`Image analysis failed: ${safeErrorMessage(error)}`);
    }

    try {
      occasionContext = await parseOccasionContext({
        occasion: body.occasion,
        gender: body.gender,
        vibe: body.vibe,
        category: body.category,
      });
    } catch (error) {
      safeErrorLog("recommend stage=occasion-parse", error);
      throw new Error(`Occasion parsing failed: ${safeErrorMessage(error)}`);
    }

    try {
      products = await fetchCandidateProducts();
    } catch (error) {
      safeErrorLog("recommend stage=firestore-fetch", error);
      throw new Error(`Inventory fetch failed: ${safeErrorMessage(error)}`);
    }

    let rankedProducts;
    try {
      rankedProducts = scoreProducts({
        products,
        gender: body.gender,
        vibe: body.vibe,
        category: body.category,
        priceRange: body.priceRange,
        occasionContext,
        imageSignals,
        maxResults: 12,
      });
    } catch (error) {
      safeErrorLog("recommend stage=scoring", error);
      throw new Error(
        `Recommendation scoring failed: ${safeErrorMessage(error)}`,
      );
    }

    const response = recommendResponseSchema.parse({
      imageSignals,
      occasionContext,
      products: rankedProducts,
    });

    return res.status(200).json(response);
  } catch (error) {
    safeErrorLog("recommend fatal", error);

    return res.status(500).json({
      error: safeErrorMessage(error),
    });
  }
}
