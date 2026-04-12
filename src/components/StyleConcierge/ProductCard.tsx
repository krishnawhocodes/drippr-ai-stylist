import { ExternalLink, ShoppingBag } from "lucide-react";
import type { RecommendedProduct } from "@/types/recommendation";
import { openAddToCart } from "@/lib/storeLinks";

interface ProductCardProps {
  product: RecommendedProduct;
  index: number;
  onAddToBag: (product: RecommendedProduct) => void;
}

const ProductCard = ({ product, index, onAddToBag }: ProductCardProps) => {
  return (
    <div
      className="glass-card rounded-2xl overflow-hidden group animate-stagger-in h-full flex flex-col"
      style={{ animationDelay: `${index * 80}ms`, animationFillMode: "both" }}
    >
      <div className="aspect-[4/5] overflow-hidden bg-secondary relative shrink-0">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
            No image available
          </div>
        )}

        {product.soldOut && (
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-background/85 border border-border text-[11px] font-semibold text-foreground backdrop-blur">
            Sold Out
          </div>
        )}
      </div>

      <div className="p-4 flex flex-1 flex-col">
        <div>
          <h4 className="font-medium text-sm text-foreground leading-tight min-h-[4.5rem]">
            {product.title}
          </h4>
          <p className="text-primary font-semibold text-base mt-2">
            {product.currency} {product.price}
          </p>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed mt-3 min-h-[3.5rem]">
          {product.reason}
        </p>

        <div className="mt-auto pt-4 flex flex-col gap-2">
          {product.storeUrl && (
            <a
              href={product.storeUrl}
              target="_blank"
              rel="noreferrer"
              className="chip-base w-full min-h-[48px] text-sm px-4 py-3 flex items-center justify-center gap-2 opacity-90 hover:opacity-100 text-center"
            >
              <ExternalLink size={14} />
              View in store
            </a>
          )}

          <button
            onClick={() => {
              if (product.soldOut) return;
              onAddToBag(product);
              if (product.addToCartUrl) {
                openAddToCart(product.addToCartUrl);
              } else if (product.storeUrl) {
                openAddToCart(product.storeUrl);
              }
            }}
            disabled={product.soldOut}
            className={`chip-base w-full min-h-[48px] text-sm px-4 py-3 flex items-center justify-center gap-2 ${
              product.soldOut
                ? "opacity-50 cursor-not-allowed"
                : "chip-selected"
            }`}
          >
            <ShoppingBag size={14} />
            {product.soldOut ? "Sold out" : "Bag"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
