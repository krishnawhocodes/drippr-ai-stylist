export const STORE_BASE_URL = (
  import.meta.env.VITE_STORE_BASE_URL || "https://drippr.in"
).replace(/\/$/, "");

export function openStoreCart() {
  window.location.href = `${STORE_BASE_URL}/cart`;
}

export function openAddToCart(url: string) {
  const popup = window.open(url, "_blank", "noopener,noreferrer");
  if (!popup) {
    window.location.href = url;
  }
}
