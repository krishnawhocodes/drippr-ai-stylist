import type {
  RecommendRequest,
  RecommendResponse,
} from "@/types/recommendation";

function getApiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
}

async function readError(response: Response) {
  try {
    const data = await response.json();
    return (
      data?.error ||
      data?.message ||
      `Request failed with status ${response.status}`
    );
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

export async function recommendStyle(
  payload: RecommendRequest,
): Promise<RecommendResponse> {
  const response = await fetch(`${getApiBaseUrl()}/api/recommend`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readError(response));
  }

  return response.json();
}
