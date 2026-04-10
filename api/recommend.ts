import { adminDb } from "./_lib/firebaseAdmin";
import { analyzeStylePhoto, parseOccasionContext } from "./_lib/groq";
import { scoreProducts } from "./_lib/recommendation";
import {
  merchantProductSchema,
  recommendRequestSchema,
  recommendResponseSchema,
  type ImageSignals,
  type MerchantProduct,
} from "./_lib/schemas";

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

async function fetchCandidateProducts() {
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

    const [imageSignals, occasionContext, products] = await Promise.all([
      body.imageDataUrl
        ? analyzeStylePhoto({
            imageDataUrl: body.imageDataUrl,
            gender: body.gender,
            vibe: body.vibe,
            category: body.category,
          })
        : Promise.resolve(getDefaultImageSignals()),
      parseOccasionContext({
        occasion: body.occasion,
        gender: body.gender,
        vibe: body.vibe,
        category: body.category,
      }),
      fetchCandidateProducts(),
    ]);

    const rankedProducts = scoreProducts({
      products,
      gender: body.gender,
      vibe: body.vibe,
      category: body.category,
      priceRange: body.priceRange,
      occasionContext,
      imageSignals,
      maxResults: 12,
    });

    const response = recommendResponseSchema.parse({
      imageSignals,
      occasionContext,
      products: rankedProducts,
    });

    return res.status(200).json(response);
  } catch (error) {
    console.error("recommend error", error);
    return res.status(400).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to generate recommendations",
    });
  }
}
