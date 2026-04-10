import { useEffect, useMemo, useRef, useState } from "react";

interface TypewriterTextProps {
  text: string;
  className?: string;
  speed?: number;
  onComplete?: () => void;
}

const TypewriterText = ({ text, className = "", speed = 38, onComplete }: TypewriterTextProps) => {
  const [visibleWordCount, setVisibleWordCount] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const words = useMemo(() => text.split(" "), [text]);
  const displayedText = useMemo(() => words.slice(0, visibleWordCount).join(" "), [visibleWordCount, words]);

  useEffect(() => {
    setVisibleWordCount(0);

    if (words.length === 0) {
      onCompleteRef.current?.();
      return;
    }

    let nextCount = 0;
    const interval = window.setInterval(() => {
      nextCount += 1;

      if (nextCount < words.length) {
        setVisibleWordCount(nextCount);
        return;
      }

      setVisibleWordCount(words.length);
      window.clearInterval(interval);
      onCompleteRef.current?.();
    }, speed);

    return () => window.clearInterval(interval);
  }, [words, speed]);

  return (
    <span className={className}>
      {displayedText}
      {visibleWordCount < words.length && (
        <span className="inline-block w-[2px] h-[1em] bg-primary ml-1 align-middle" style={{ animation: "typewriter-cursor 0.8s step-end infinite" }} />
      )}
    </span>
  );
};

export default TypewriterText;
