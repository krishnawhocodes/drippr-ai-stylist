import { getAdminDb } from "./_lib/firebaseAdmin.js";
import { analyzeStylePhoto, parseOccasionContext } from "./_lib/groq.js";
import { debugScoreProducts } from "./_lib/recommendation.js";
import {
  merchantProductSchema,
  recommendRequestSchema,
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

    const debug = debugScoreProducts({
      products,
      gender: body.gender,
      vibe: body.vibe,
      category: body.category,
      priceRange: body.priceRange,
      occasionContext,
      imageSignals,
    });

    return res.status(200).json({
      filters: {
        gender: body.gender,
        vibe: body.vibe,
        category: body.category,
        priceRange: body.priceRange,
        occasion: body.occasion,
      },
      imageSignals,
      occasionContext,
      totalProductsChecked: debug.length,
      selectedCount: debug.filter((item) => item.selected).length,
      selected: debug.filter((item) => item.selected).slice(0, 20),
      rejected: debug.filter((item) => !item.selected).slice(0, 50),
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Debug recommend failed",
    });
  }
}
