import { useState, useRef, useEffect } from "react";
import TypewriterText from "./TypewriterText";
import { Upload, Camera, Pencil, Send, Loader2 } from "lucide-react";

interface StepCardProps {
  stepNumber: number;
  question: string;
  helperText?: string;
  options?: string[];
  type?: "chips" | "photo" | "prompt";
  answered?: string | null;
  onAnswer: (answer: string) => void;
  onEdit?: () => void;
  isActive: boolean;
  analysisText?: string;
  onPhotoSelected?: (file: File) => Promise<string>;
  allowPhotoSkip?: boolean;
}

const StepCard = ({
  stepNumber,
  question,
  helperText,
  options,
  type = "chips",
  answered,
  onAnswer,
  onEdit,
  isActive,
  analysisText,
  onPhotoSelected,
  allowPhotoSkip = false,
}: StepCardProps) => {
  const [questionDone, setQuestionDone] = useState(false);
  const [helperDone, setHelperDone] = useState(!helperText);
  const [analysisDone, setAnalysisDone] = useState(!analysisText);
  const [promptValue, setPromptValue] = useState("");
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isActive || !cardRef.current) return;

    const frame = window.requestAnimationFrame(() => {
      const card = cardRef.current;
      if (!card) return;

      const rect = card.getBoundingClientRect();
      const topBoundary = 88;
      const bottomBoundary = window.innerHeight - 24;
      const isFullyVisible =
        rect.top >= topBoundary && rect.bottom <= bottomBoundary;

      if (!isFullyVisible) {
        card.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isActive]);

  useEffect(() => {
    if (isEditingPrompt && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [isEditingPrompt]);

  useEffect(() => {
    if (type === "prompt" && isActive && promptTextareaRef.current) {
      promptTextareaRef.current.focus();
    }
  }, [type, isActive]);

  useEffect(() => {
    if (answered) {
      setPromptValue(answered);
    }
  }, [answered]);

  if (answered !== undefined && answered !== null) {
    const isPromptType = type === "prompt";

    return (
      <div
        ref={cardRef}
        className="glass-card smooth-layer rounded-xl px-5 py-4 opacity-60 hover:opacity-80"
        style={{ transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase font-medium shrink-0">
              Step {stepNumber}
            </span>

            {isPromptType && isEditingPrompt ? (
              <form
                className="flex-1 flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (promptValue.trim()) {
                    onAnswer(promptValue.trim());
                    setIsEditingPrompt(false);
                  }
                }}
              >
                <input
                  ref={editInputRef}
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                  className="flex-1 bg-transparent border-b border-border text-sm text-foreground font-medium outline-none focus:border-primary"
                />
                <button
                  type="submit"
                  className="text-primary hover:text-primary/80 transition-colors"
                >
                  <Send size={14} />
                </button>
              </form>
            ) : (
              <span className="text-sm text-foreground font-medium truncate">
                {answered}
              </span>
            )}
          </div>

          {onEdit && !isEditingPrompt && (
            <button
              onClick={() => {
                if (isPromptType) {
                  setPromptValue(answered);
                  setIsEditingPrompt(true);
                } else {
                  onEdit();
                }
              }}
              className="text-muted-foreground hover:text-primary shrink-0 p-1 rounded-md hover:bg-secondary/50"
              style={{ transition: "all 0.2s ease" }}
            >
              <Pencil size={13} />
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!isActive) return null;

  const handlePhotoSkip = () => {
    setPhotoError(null);
    onAnswer("Skipped photo validation");
  };

  const handleFilePick = async (file: File | undefined) => {
    if (!file || !onPhotoSelected) return;

    try {
      setPhotoError(null);
      setIsProcessingPhoto(true);
      const summary = await onPhotoSelected(file);
      onAnswer(summary);
    } catch (error) {
      setPhotoError(
        error instanceof Error ? error.message : "Photo processing failed",
      );
    } finally {
      setIsProcessingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  const handlePromptSubmit = () => {
    if (promptValue.trim()) {
      onAnswer(promptValue.trim());
    }
  };

  return (
    <div
      ref={cardRef}
      className="glass-card smooth-layer rounded-2xl p-6 md:p-8 animate-fade-up"
      style={{ animationDuration: "0.5s" }}
    >
      <span className="text-[10px] tracking-[0.3em] text-primary uppercase font-semibold mb-4 block">
        Step {stepNumber}
      </span>

      {analysisText && (
        <div
          className="mb-4 px-4 py-3.5 rounded-2xl"
          style={{
            background:
              "linear-gradient(135deg, hsla(18,100%,50%,0.08), hsla(30,100%,60%,0.05))",
            border: "1px solid hsla(18,100%,50%,0.12)",
          }}
        >
          <p className="text-sm text-foreground/90 font-medium leading-relaxed">
            <TypewriterText
              text={analysisText}
              speed={20}
              onComplete={() => setAnalysisDone(true)}
            />
          </p>
        </div>
      )}

      {(analysisDone || !analysisText) && (
        <>
          <h3
            className="text-xl md:text-2xl font-display font-semibold text-foreground mb-1"
            style={{ lineHeight: "1.2" }}
          >
            <TypewriterText
              text={question}
              speed={30}
              onComplete={() => setQuestionDone(true)}
            />
          </h3>

          {helperText && questionDone && (
            <p className="text-sm text-muted-foreground mt-2 mb-4">
              <TypewriterText
                text={helperText}
                speed={25}
                onComplete={() => setHelperDone(true)}
              />
            </p>
          )}

          {questionDone && helperDone && type === "chips" && options && (
            <div
              className="flex flex-wrap gap-3 mt-5 animate-fade-up"
              style={{ animationDuration: "0.4s" }}
            >
              {options.map((opt, i) => (
                <button
                  key={opt}
                  onClick={() => onAnswer(opt)}
                  className="chip-base hover:border-primary/40 active:scale-95"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {questionDone && helperDone && type === "photo" && (
            <div
              className="mt-5 animate-fade-up"
              style={{ animationDuration: "0.4s" }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={(e) => handleFilePick(e.target.files?.[0])}
              />

              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={(e) => handleFilePick(e.target.files?.[0])}
              />

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessingPhoto}
                  className="chip-base chip-selected flex items-center gap-2 disabled:opacity-60"
                >
                  {isProcessingPhoto ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Upload size={14} />
                  )}
                  Upload photo
                </button>

                <button
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={isProcessingPhoto}
                  className="chip-base flex items-center gap-2 disabled:opacity-60"
                >
                  {isProcessingPhoto ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Camera size={14} />
                  )}
                  Open camera
                </button>

                {allowPhotoSkip && (
                  <button
                    onClick={handlePhotoSkip}
                    disabled={isProcessingPhoto}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4 disabled:opacity-50"
                  >
                    Skip
                  </button>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground mt-3 opacity-60">
                Photo is used only to verify full-body upload.
              </p>

              {photoError && (
                <p className="text-sm text-red-400 mt-3 leading-relaxed">
                  {photoError}
                </p>
              )}
            </div>
          )}

          {questionDone && helperDone && type === "prompt" && (
            <div
              className="mt-5 animate-fade-up"
              style={{ animationDuration: "0.4s" }}
            >
              <div className="space-y-3">
                <textarea
                  ref={promptTextareaRef}
                  value={promptValue}
                  onChange={(e) => setPromptValue(e.target.value)}
                  placeholder="e.g. college fest at night during summer, office lunch, wedding guest look..."
                  className="w-full min-h-[120px] bg-[hsla(0,0%,10%,0.6)] border border-[hsla(0,0%,25%,0.5)] rounded-2xl px-5 py-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 resize-none"
                  style={{
                    transition: "border-color 0.3s ease",
                    backdropFilter: "blur(8px)",
                  }}
                />

                <div className="flex justify-end">
                  <button
                    onClick={handlePromptSubmit}
                    disabled={!promptValue.trim()}
                    className="shrink-0 h-10 rounded-full bg-primary px-4 flex items-center justify-center gap-2 text-primary-foreground disabled:opacity-30 hover:bg-primary/90 active:scale-95"
                    style={{ transition: "all 0.2s ease" }}
                  >
                    <Send size={16} />
                    Continue
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default StepCard;
