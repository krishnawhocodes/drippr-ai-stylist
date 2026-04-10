import { ShoppingBag, Tag } from "lucide-react";
import type { RecommendedProduct } from "@/types/recommendation";

interface ProductCardProps {
  product: RecommendedProduct;
  index: number;
  onAddToBag: (id: string) => void;
}

const ProductCard = ({ product, index, onAddToBag }: ProductCardProps) => {
  return (
    <div
      className="glass-card rounded-2xl overflow-hidden group animate-stagger-in"
      style={{ animationDelay: `${index * 80}ms`, animationFillMode: "both" }}
    >
      <div className="aspect-[4/5] overflow-hidden bg-secondary relative">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
            No image
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div>
          <h4 className="font-medium text-sm text-foreground leading-tight">
            {product.title}
          </h4>
          <p className="text-primary font-semibold text-base mt-1">
            {product.currency} {product.price}
          </p>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          {product.reason}
        </p>

        <div className="flex flex-wrap gap-2 pt-1">
          <span className="chip-base text-xs px-3 py-2 flex items-center gap-1.5 opacity-80">
            <Tag size={12} /> {product.sku || "No SKU"}
          </span>
          <button
            onClick={() => onAddToBag(product.id)}
            className="chip-base chip-selected text-xs px-3 py-2 flex items-center gap-1.5"
          >
            <ShoppingBag size={12} /> Bag
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
