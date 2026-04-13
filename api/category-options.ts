import { getAvailableCategories } from "./_lib/recommendation.js";
import { fetchShopifyCatalogProducts } from "./_lib/shopifyCatalog.js";
import { genderSchema } from "./_lib/schemas.js";

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

export default async function handler(req: any, res: any) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = getBody(req);
    const gender = genderSchema.parse(body.gender);
    const vibe =
      typeof body.vibe === "string" && body.vibe.trim() ? body.vibe.trim() : "";

    const catalogEntries = await fetchShopifyCatalogProducts();
    const products = catalogEntries.map((entry) => entry.product);

    const categories = getAvailableCategories({
      products,
      gender,
      vibe,
    });

    return res.status(200).json({ categories });
  } catch (error) {
    return res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to load categories",
    });
  }
}
