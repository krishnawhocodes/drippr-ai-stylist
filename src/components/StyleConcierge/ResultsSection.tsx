import { useRef, useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import ProductCard from "./ProductCard";
import type {
  OccasionContext,
  RecommendedProduct,
} from "@/types/recommendation";

interface ResultsSectionProps {
  products: RecommendedProduct[];
  occasionContext: OccasionContext | null;
  error: string | null;
  onAddToBag: (id: string) => void;
  onRefine: () => void;
  onRestart: () => void;
  onChangeVibe: () => void;
  onChangeCategory: () => void;
}

function chipsFromContext(occasionContext: OccasionContext | null) {
  const chips: string[] = [];

  if (occasionContext?.eventType)
    chips.push(occasionContext.eventType.replace(/_/g, " "));
  if (occasionContext?.season && occasionContext.season !== "unknown")
    chips.push(occasionContext.season);
  if (occasionContext?.timeOfDay && occasionContext.timeOfDay !== "unknown")
    chips.push(occasionContext.timeOfDay);
  if (occasionContext?.formality && occasionContext.formality !== "unknown") {
    chips.push(occasionContext.formality.replace(/_/g, " "));
  }

  return chips.slice(0, 5);
}

const ResultsSection = ({
  products,
  occasionContext,
  error,
  onAddToBag,
  onRefine,
  onRestart,
  onChangeVibe,
  onChangeCategory,
}: ResultsSectionProps) => {
  const [showAll, setShowAll] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 300);
  }, []);

  const chips = chipsFromContext(occasionContext);
  const displayed = showAll ? products : products.slice(0, 8);

  if (error) {
    return (
      <div
        ref={ref}
        className="glass-card rounded-2xl p-8 text-center animate-fade-up"
      >
        <p className="text-lg text-foreground font-display font-semibold mb-2">
          We could not complete the edit
        </p>
        <p className="text-sm text-muted-foreground mb-6">{error}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button onClick={onRefine} className="chip-base chip-selected">
            Refine selections
          </button>
          <button onClick={onRestart} className="chip-base">
            Restart
          </button>
        </div>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div
        ref={ref}
        className="glass-card rounded-2xl p-8 text-center animate-fade-up"
      >
        <p className="text-lg text-foreground font-display font-semibold mb-2">
          No strong matches found
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          Try changing your vibe or category to widen the result set.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button onClick={onChangeVibe} className="chip-base">
            Change vibe
          </button>
          <button onClick={onChangeCategory} className="chip-base">
            Change category
          </button>
          <button onClick={onRestart} className="chip-base chip-selected">
            Restart
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="animate-fade-up"
      style={{ animationDuration: "0.7s" }}
    >
      <div className="text-center mb-8">
        <h2
          className="text-3xl md:text-4xl font-display font-bold text-foreground"
          style={{ lineHeight: "1.1" }}
        >
          Your Edit
        </h2>
        <p className="text-sm text-muted-foreground mt-2">
          Matched from live Drippr inventory
        </p>

        {chips.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {chips.map((chip) => (
              <span key={chip} className="chip-base text-xs px-3 py-1.5">
                {chip}
              </span>
            ))}
          </div>
        )}

        <button
          onClick={onRefine}
          className="inline-flex items-center gap-1.5 text-xs text-primary mt-4 hover:underline underline-offset-4 transition-colors"
        >
          <ArrowUp size={12} /> Refine selections
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5 items-stretch">
        {displayed.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            index={index}
            onAddToBag={onAddToBag}
          />
        ))}
      </div>

      {products.length > 8 && !showAll && (
        <div className="flex justify-center mt-8">
          <button
            onClick={() => setShowAll(true)}
            className="chip-base chip-selected px-8"
          >
            Show more ({products.length - 8} more)
          </button>
        </div>
      )}
    </div>
  );
};

export default ResultsSection;
