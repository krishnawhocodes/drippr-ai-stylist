const CuratingLoader = ({ text = "Curating…" }: { text?: string }) => {
  return (
    <div className="flex items-center justify-center py-8 animate-fade-up" style={{ animationDuration: "0.4s" }}>
      <div className="flex items-center gap-3">
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse-soft"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
        <span className="text-sm text-muted-foreground font-medium tracking-wide shimmer-bar px-4 py-2">
          {text}
        </span>
      </div>
    </div>
  );
};

export default CuratingLoader;
