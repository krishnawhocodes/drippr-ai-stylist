import { useEffect, useState } from "react";

const Hero = ({ compact }: { compact?: boolean }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <section className={`relative flex flex-col items-center justify-center overflow-hidden text-center transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${compact ? "min-h-[100px] pb-2 pt-16 md:min-h-[120px] md:pt-20" : "min-h-[220px] pb-4 pt-24 md:min-h-[280px] md:pb-6 md:pt-28"}`}>
      <div
        className={`smooth-layer pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full animate-hero-glow transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${compact ? "h-[220px] w-[220px] scale-75 opacity-80 md:h-[320px] md:w-[320px]" : "h-[340px] w-[340px] scale-100 opacity-100 md:h-[500px] md:w-[500px]"}`}
        style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.12) 0%, transparent 70%)" }}
      />

      <div
        className={`smooth-layer relative z-10 flex flex-col items-center transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${compact ? "-translate-y-4 scale-[0.55] md:-translate-y-6 md:scale-[0.6]" : "translate-y-0 scale-100"}`}
      >
        <h1
          className={`smooth-layer font-display font-bold tracking-tight text-foreground text-4xl md:text-6xl lg:text-7xl transition-[transform,opacity] duration-500 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
          style={{ lineHeight: "1.1", transitionDelay: "0.1s" }}
        >
          Hey ! I am{" "}
          <span
            className="text-gradient-orange inline-block animate-dripstr-glow"
            style={{ animationDelay: "0.5s" }}
          >
            DRIPSTR
          </span>
          ,
          <br />
          <span className="text-muted-foreground font-medium" style={{ fontSize: "0.6em" }}>Your fashion stylist</span>
        </h1>

        <p
          className={`smooth-layer text-base text-muted-foreground md:text-lg mt-4 md:mt-6 transition-[transform,opacity] duration-500 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
          style={{ transitionDelay: "0.3s" }}
        >
          Curated outfit ideas, fast.
        </p>
      </div>
    </section>
  );
};

export default Hero;
