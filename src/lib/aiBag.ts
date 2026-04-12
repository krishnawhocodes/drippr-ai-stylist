type BagItem = {
  productId: string;
  variantId: string;
  quantity: number;
  title: string;
  imageUrl: string | null;
  price: number;
  currency: string;
};

const STORAGE_KEY = "drippr_ai_bag_v1";
const STORE_BASE_URL = (
  import.meta.env.VITE_STORE_BASE_URL || "https://drippr.in"
).replace(/\/$/, "");
const STORE_CHECKOUT_DOMAIN = (
  import.meta.env.VITE_STORE_CHECKOUT_DOMAIN || "dripprnow.myshopify.com"
).replace(/^https?:\/\//, "");

function readBag(): BagItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeBag(items: BagItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("drippr-ai-bag-updated"));
}

export function extractVariantIdFromAddToCartUrl(
  url: string | null | undefined,
) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const id = parsed.searchParams.get("id");
    return id?.trim() || null;
  } catch {
    return null;
  }
}

export function addToAiBag(product: {
  id: string;
  title: string;
  imageUrl: string | null;
  price: number;
  currency: string;
  addToCartUrl: string | null;
}) {
  const variantId = extractVariantIdFromAddToCartUrl(product.addToCartUrl);
  if (!variantId) return false;

  const items = readBag();
  const existing = items.find((item) => item.variantId === variantId);

  if (existing) {
    existing.quantity += 1;
  } else {
    items.push({
      productId: product.id,
      variantId,
      quantity: 1,
      title: product.title,
      imageUrl: product.imageUrl,
      price: product.price,
      currency: product.currency,
    });
  }

  writeBag(items);
  return true;
}

export function getAiBagItems() {
  return readBag();
}

export function getAiBagCount() {
  return readBag().reduce((sum, item) => sum + item.quantity, 0);
}

export function clearAiBag() {
  writeBag([]);
}

export function subscribeToAiBagCount(listener: (count: number) => void) {
  const handler = () => listener(getAiBagCount());

  window.addEventListener("drippr-ai-bag-updated", handler);
  window.addEventListener("storage", handler);

  handler();

  return () => {
    window.removeEventListener("drippr-ai-bag-updated", handler);
    window.removeEventListener("storage", handler);
  };
}

export function buildStoreCartPermalink() {
  const items = readBag();

  if (!items.length) {
    return `${STORE_BASE_URL}/cart`;
  }

  const merged = new Map<string, number>();

  for (const item of items) {
    merged.set(
      item.variantId,
      (merged.get(item.variantId) || 0) + item.quantity,
    );
  }

  const lineItems = [...merged.entries()]
    .map(([variantId, quantity]) => `${variantId}:${quantity}`)
    .join(",");

  return `https://${STORE_CHECKOUT_DOMAIN}/cart/${lineItems}?storefront=true`;
}

export function openAiBagInStore() {
  window.location.href = buildStoreCartPermalink();
}
