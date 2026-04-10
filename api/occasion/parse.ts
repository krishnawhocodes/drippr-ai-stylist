import { parseOccasionContext } from "../_lib/groq.ts";
import { occasionParseRequestSchema } from "../_lib/schemas.ts";

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
    const body = occasionParseRequestSchema.parse(getBody(req));

    const occasionContext = await parseOccasionContext({
      occasion: body.occasion,
      gender: body.gender,
      vibe: body.vibe,
      category: body.category,
    });

    return res.status(200).json({ occasionContext });
  } catch (error) {
    console.error("occasion/parse error", error);
    return res.status(400).json({
      error:
        error instanceof Error ? error.message : "Failed to parse occasion",
    });
  }
}
