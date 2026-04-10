import { RotateCcw, ShoppingBag } from "lucide-react";

interface TopBarProps {
  bagCount: number;
  onRestart: () => void;
  currentStep?: number;
  totalSteps?: number;
  showProgress?: boolean;
}

const TopBar = ({ bagCount, onRestart, currentStep = 0, totalSteps = 6, showProgress = false }: TopBarProps) => {
  const progress = showProgress ? Math.min(((currentStep) / totalSteps) * 100, 100) : 0;

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className="h-14 flex items-center justify-between px-5 md:px-8 border-b border-border bg-background/80 backdrop-blur-xl">
        <span className="font-display text-lg font-bold tracking-[0.2em] text-foreground">
          DRIPPR
        </span>
        {showProgress && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] tracking-[0.15em] text-muted-foreground font-medium tabular-nums">
              {currentStep}/{totalSteps}
            </span>
            <div className="w-16 md:w-24 h-1 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-primary"
                style={{
                  width: `${progress}%`,
                  transition: "width 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              />
            </div>
          </div>
        )}
        {!showProgress && (
          <span className="hidden sm:block text-[11px] tracking-[0.3em] text-muted-foreground font-medium uppercase">
            Style Concierge
          </span>
        )}
        <div className="flex items-center gap-3">
          {bagCount > 0 && (
            <div className="relative">
              <ShoppingBag size={18} className="text-muted-foreground" />
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                {bagCount}
              </span>
            </div>
          )}
          <button
            onClick={onRestart}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-200 active:scale-95"
            aria-label="Restart"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
