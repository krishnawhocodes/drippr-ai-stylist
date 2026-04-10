import { useState, useCallback, useRef, useEffect } from "react";
import TopBar from "@/components/StyleConcierge/TopBar";
import Hero from "@/components/StyleConcierge/Hero";
import StepCard from "@/components/StyleConcierge/StepCard";
import CuratingLoader from "@/components/StyleConcierge/CuratingLoader";
import ResultsSection from "@/components/StyleConcierge/ResultsSection";
import { prepareValidatedPhoto } from "@/lib/photoValidation";
import { recommendStyle } from "@/lib/api";
import type {
  Gender,
  ImageSignals,
  OccasionContext,
  PhotoValidationResult,
  PriceRange,
  RecommendedProduct,
} from "@/types/recommendation";

interface Answers {
  gender: Gender | null;
  photo: string | null;
  vibe: string | null;
  category: string | null;
  occasion: string | null;
  priceRange: PriceRange | null;
}

interface PreparedPhotoState {
  imageDataUrl: string;
  photoValidation: PhotoValidationResult;
}

const INITIAL: Answers = {
  gender: null,
  photo: null,
  vibe: null,
  category: null,
  occasion: null,
  priceRange: null,
};

const STEPS = [
  {
    key: "gender" as const,
    stepNumber: 1,
    question: "Who are we styling for?",
    options: ["Women", "Men"],
    type: "chips" as const,
  },
  {
    key: "photo" as const,
    stepNumber: 2,
    question: "Want a sharper match?",
    helperText:
      "Upload a full-body photo from head to toe for posture, palette, and fit cues.",
    type: "photo" as const,
  },
  {
    key: "vibe" as const,
    stepNumber: 3,
    question: "Pick your vibe",
    options: ["Streetwear", "Minimal", "Daily", "Thrift", "Fusion"],
    type: "chips" as const,
  },
  {
    key: "category" as const,
    stepNumber: 4,
    question: "Choose a category",
    options: [
      "Tops & Dresses",
      "Cargo & Pants",
      "Tees",
      "Shorts & Skirts",
      "Sweatshirts & Hoodies",
      "Jackets",
      "Cord Set",
      "Athleisure",
    ],
    type: "chips" as const,
  },
  {
    key: "occasion" as const,
    stepNumber: 5,
    question: "Tell us more about the occasion",
    helperText:
      "You can describe the event, season, time, vibe, comfort, or anything else that matters.",
    type: "prompt" as const,
  },
  {
    key: "priceRange" as const,
    stepNumber: 6,
    question: "Choose your range",
    options: ["Under ₹300", "₹300–₹500", "₹500+"],
    type: "chips" as const,
  },
];

const Index = () => {
  const [answers, setAnswers] = useState<Answers>(INITIAL);
  const [activeStep, setActiveStep] = useState(0);
  const [curating, setCurating] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [bagCount, setBagCount] = useState(0);

  const [preparedPhoto, setPreparedPhoto] = useState<PreparedPhotoState | null>(
    null,
  );
  const [recommendedProducts, setRecommendedProducts] = useState<
    RecommendedProduct[]
  >([]);
  const [imageSignals, setImageSignals] = useState<ImageSignals | null>(null);
  const [occasionContext, setOccasionContext] =
    useState<OccasionContext | null>(null);
  const [recommendationError, setRecommendationError] = useState<string | null>(
    null,
  );

  const flowRef = useRef<HTMLDivElement>(null);

  const isCompact = activeStep >= 1 || showResults;
  const shouldLockViewport = activeStep === 0 && !curating && !showResults;

  useEffect(() => {
    if (shouldLockViewport) {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
    } else {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    }

    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, [shouldLockViewport]);

  const getAnalysisText = (stepKey: string): string | undefined => {
    if (stepKey === "occasion" && preparedPhoto?.photoValidation.isValid) {
      return "Nice — your full-body photo is ready. We'll combine your silhouette, palette cues, and occasion details for the final edit.";
    }
    return undefined;
  };

  const resetRecommendationState = () => {
    setRecommendedProducts([]);
    setImageSignals(null);
    setOccasionContext(null);
    setRecommendationError(null);
    setShowResults(false);
  };

  const runRecommendation = async (nextAnswers: Answers) => {
    setCurating(true);
    setRecommendationError(null);

    try {
      const response = await recommendStyle({
        gender: nextAnswers.gender as Gender,
        vibe: nextAnswers.vibe as string,
        category: nextAnswers.category as string,
        occasion: nextAnswers.occasion as string,
        priceRange: nextAnswers.priceRange as PriceRange,
        imageDataUrl: preparedPhoto?.imageDataUrl ?? null,
        photoValidation: preparedPhoto?.photoValidation ?? null,
      });

      setImageSignals(response.imageSignals);
      setOccasionContext(response.occasionContext);
      setRecommendedProducts(response.products);
      setShowResults(true);
    } catch (error) {
      setRecommendedProducts([]);
      setImageSignals(null);
      setOccasionContext(null);
      setRecommendationError(
        error instanceof Error
          ? error.message
          : "Something went wrong while creating your edit.",
      );
      setShowResults(true);
    } finally {
      setCurating(false);
    }
  };

  const handleAnswer = useCallback(
    (key: keyof Answers, value: string) => {
      if (key === "photo" && value.toLowerCase().includes("skipped")) {
        setPreparedPhoto(null);
      }

      const nextAnswers = {
        ...answers,
        [key]: value,
      } as Answers;

      setAnswers(nextAnswers);
      const nextStep = activeStep + 1;

      if (nextStep < STEPS.length) {
        const delay = key === "photo" ? 120 : 90;
        window.setTimeout(() => {
          setActiveStep(nextStep);
        }, delay);
        return;
      }

      runRecommendation(nextAnswers);
    },
    [activeStep, answers, preparedPhoto],
  );

  const handlePhotoSelected = useCallback(async (file: File) => {
    const prepared = await prepareValidatedPhoto(file);

    if (!prepared.photoValidation.isValid) {
      throw new Error(
        prepared.photoValidation.reason ||
          "Please upload a full-body photo from head to toe.",
      );
    }

    setPreparedPhoto(prepared);

    const summary = prepared.photoValidation.summary;
    const poseText =
      summary.facing === "front"
        ? "Front pose"
        : summary.facing === "three_quarter"
          ? "3/4 pose"
          : "Body pose";
    const postureText =
      summary.posture === "upright"
        ? "Upright posture"
        : summary.posture === "slightly_angled"
          ? "Natural posture"
          : "Dynamic posture";

    return `Full-body photo ready — ${poseText} · ${postureText}`;
  }, []);

  const handleEditStep = useCallback((stepIndex: number) => {
    const keysToReset = STEPS.slice(stepIndex).map((s) => s.key);

    setAnswers((prev) => {
      const updated = { ...prev } as Record<
        keyof Answers,
        Answers[keyof Answers]
      >;

      keysToReset.forEach((key) => {
        updated[key] = null;
      });

      return updated as Answers;
    });

    if (stepIndex <= 1) {
      setPreparedPhoto(null);
    }

    setActiveStep(stepIndex);
    setCurating(false);
    resetRecommendationState();
  }, []);

  const handleRestart = useCallback(() => {
    setAnswers(INITIAL);
    setPreparedPhoto(null);
    setActiveStep(0);
    setCurating(false);
    resetRecommendationState();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleAddToBag = useCallback((_id: string) => {
    setBagCount((prev) => prev + 1);
  }, []);

  const handleRefine = () => {
    flowRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleChangeVibe = () => {
    handleEditStep(2);
  };

  const handleChangeCategory = () => {
    handleEditStep(3);
  };

  return (
    <div
      className={`bg-background grain-overlay corner-glow ${!isCompact ? "h-screen overflow-hidden" : "min-h-screen"}`}
    >
      <TopBar
        bagCount={bagCount}
        onRestart={handleRestart}
        currentStep={showResults ? 6 : activeStep}
        totalSteps={6}
        showProgress={activeStep >= 1 || showResults}
      />

      <div className="relative z-10 max-w-2xl mx-auto px-4 md:px-6">
        <Hero compact={isCompact} />

        <div
          ref={flowRef}
          className={`space-y-3 pb-8 smooth-layer transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isCompact ? "-translate-y-8 md:-translate-y-10" : "translate-y-0"
          }`}
        >
          {STEPS.map((step, i) => {
            const answerValue = answers[step.key];
            const isAnswered = answerValue !== null;
            const isActive = i === activeStep && !curating;

            if (i > activeStep && !isAnswered) return null;

            return (
              <StepCard
                key={step.key}
                stepNumber={step.stepNumber}
                question={step.question}
                helperText={step.helperText}
                options={step.options}
                type={step.type}
                answered={isAnswered ? answerValue : undefined}
                onAnswer={(val) => handleAnswer(step.key, val)}
                onEdit={isAnswered ? () => handleEditStep(i) : undefined}
                isActive={isActive}
                analysisText={getAnalysisText(step.key)}
                onPhotoSelected={
                  step.key === "photo" ? handlePhotoSelected : undefined
                }
                allowPhotoSkip={step.key === "photo"}
              />
            );
          })}

          {curating && <CuratingLoader text="Curating your edit…" />}
        </div>

        {showResults && !curating && (
          <div className="pb-20">
            <ResultsSection
              products={recommendedProducts}
              imageSignals={imageSignals}
              occasionContext={occasionContext}
              error={recommendationError}
              onAddToBag={handleAddToBag}
              onRefine={handleRefine}
              onRestart={handleRestart}
              onChangeVibe={handleChangeVibe}
              onChangeCategory={handleChangeCategory}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;