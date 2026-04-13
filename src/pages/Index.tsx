import { useState, useCallback, useRef, useEffect } from "react";
import TopBar from "@/components/StyleConcierge/TopBar";
import Hero from "@/components/StyleConcierge/Hero";
import StepCard from "@/components/StyleConcierge/StepCard";
import CuratingLoader from "@/components/StyleConcierge/CuratingLoader";
import ResultsSection from "@/components/StyleConcierge/ResultsSection";
import { prepareValidatedPhoto } from "@/lib/photoValidation";
import { getAvailableCategoryOptions, recommendStyle } from "@/lib/api";
import {
  addToAiBag,
  openAiBagInStore,
  subscribeToAiBagCount,
} from "@/lib/aiBag";
import type {
  Gender,
  OccasionContext,
  PriceRange,
  RecommendedProduct,
} from "@/types/recommendation";

type PhotoStyleSnapshot = {
  skinToneLabel: string;
  bodyFrameLabel: string;
  poseLabel: string;
};

interface Answers {
  gender: Gender | null;
  photo: string | null;
  vibe: string | null;
  category: string | null;
  occasion: string | null;
  priceRange: PriceRange | null;
}

const INITIAL: Answers = {
  gender: null,
  photo: null,
  vibe: null,
  category: null,
  occasion: null,
  priceRange: null,
};

const ALL_CATEGORY_OPTIONS = [
  "Tops & Dresses",
  "Cargo & Pants",
  "Tees",
  "Shorts & Skirts",
  "Sweatshirts & Hoodies",
  "Jackets",
  "Cord Set",
  "Athleisure",
];

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
    question: "Upload a full-body photo",
    helperText:
      "We’ll verify that the image is head-to-toe and show a quick style snapshot.",
    type: "photo" as const,
  },
  {
    key: "vibe" as const,
    stepNumber: 3,
    question: "Pick your vibe",
    options: [
      "Streetwear",
      "Minimal",
      "Daily Drip",
      "Thrift",
      "Fusion",
      "Athleisure",
    ],
    type: "chips" as const,
  },
  {
    key: "category" as const,
    stepNumber: 4,
    question: "Choose a category",
    options: ALL_CATEGORY_OPTIONS,
    type: "chips" as const,
  },
  {
    key: "occasion" as const,
    stepNumber: 5,
    question: "Tell us more about the occasion",
    helperText:
      "We’ll use this only to collect context while your results are filtered mainly by store inventory.",
    type: "prompt" as const,
  },
  {
    key: "priceRange" as const,
    stepNumber: 6,
    question: "Choose your budget",
    options: [
      "₹0 - ₹499",
      "₹500 - ₹999",
      "₹1,000 - ₹1,499",
      "₹1,500 - ₹1,999",
      "₹2,000 - ₹2,499",
      "₹2,500 & above",
    ],
    type: "chips" as const,
  },
];

const Index = () => {
  const [answers, setAnswers] = useState<Answers>(INITIAL);
  const [activeStep, setActiveStep] = useState(0);
  const [curating, setCurating] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [bagCount, setBagCount] = useState(0);
  const [categoryOptions, setCategoryOptions] =
    useState<string[]>(ALL_CATEGORY_OPTIONS);
  const [photoStyleSnapshot, setPhotoStyleSnapshot] =
    useState<PhotoStyleSnapshot | null>(null);

  const [recommendedProducts, setRecommendedProducts] = useState<
    RecommendedProduct[]
  >([]);
  const [occasionContext, setOccasionContext] =
    useState<OccasionContext | null>(null);
  const [recommendationError, setRecommendationError] = useState<string | null>(
    null,
  );

  const flowRef = useRef<HTMLDivElement>(null);
  const categoryOptionsCache = useRef<Record<string, string[]>>({});

  const isCompact = activeStep >= 1 || showResults;
  const shouldLockViewport = activeStep === 0 && !curating && !showResults;

  useEffect(() => {
    const unsubscribe = subscribeToAiBagCount(setBagCount);
    return unsubscribe;
  }, []);

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

  const resetRecommendationState = () => {
    setRecommendedProducts([]);
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
      });

      setOccasionContext(response.occasionContext);
      setRecommendedProducts(response.products);
      setShowResults(true);
    } catch (error) {
      setRecommendedProducts([]);
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
      const nextAnswers = {
        ...answers,
        [key]: value,
      } as Answers;

      setAnswers(nextAnswers);

      const nextStep = activeStep + 1;

      if (key === "vibe" && nextAnswers.gender) {
        const cacheKey = `${nextAnswers.gender}__${value}`;
        const cached = categoryOptionsCache.current[cacheKey];

        if (cached && cached.length > 0) {
          setCategoryOptions(cached);
        } else {
          void getAvailableCategoryOptions({
            gender: nextAnswers.gender as Gender,
            vibe: value,
          })
            .then((options) => {
              const finalOptions =
                options.length > 0 ? options : ALL_CATEGORY_OPTIONS;
              categoryOptionsCache.current[cacheKey] = finalOptions;
              setCategoryOptions(finalOptions);
            })
            .catch(() => {
              setCategoryOptions(ALL_CATEGORY_OPTIONS);
            });
        }
      }

      if (nextStep < STEPS.length) {
        const delay = key === "photo" ? 70 : 20;
        window.setTimeout(() => {
          setActiveStep(nextStep);
        }, delay);
        return;
      }

      runRecommendation(nextAnswers);
    },
    [activeStep, answers],
  );

  const handlePhotoSelected = useCallback(async (file: File) => {
    const prepared = await prepareValidatedPhoto(file);

    if (!prepared.photoValidation.isValid) {
      throw new Error(
        prepared.photoValidation.reason ||
          "Please upload a full-body photo from head to toe.",
      );
    }

    setPhotoStyleSnapshot(prepared.styleSnapshot);

    return "Full-body photo verified";
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

    if (stepIndex <= 3) {
      setCategoryOptions(ALL_CATEGORY_OPTIONS);
    }

    if (stepIndex <= 1) {
      setPhotoStyleSnapshot(null);
    }

    setActiveStep(stepIndex);
    setCurating(false);
    resetRecommendationState();
  }, []);

  const handleRestart = useCallback(() => {
    setAnswers(INITIAL);
    setActiveStep(0);
    setCurating(false);
    setCategoryOptions(ALL_CATEGORY_OPTIONS);
    setPhotoStyleSnapshot(null);
    resetRecommendationState();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleAddToBag = useCallback((product: RecommendedProduct) => {
    addToAiBag(product);
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
      className={`bg-background grain-overlay corner-glow ${
        !isCompact ? "h-screen overflow-hidden" : "min-h-screen"
      }`}
    >
      <TopBar
        bagCount={bagCount}
        onRestart={handleRestart}
        onOpenBag={openAiBagInStore}
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
                options={
                  step.key === "category" ? categoryOptions : step.options
                }
                type={step.type}
                answered={isAnswered ? answerValue : undefined}
                onAnswer={(val) => handleAnswer(step.key, val)}
                onEdit={isAnswered ? () => handleEditStep(i) : undefined}
                isActive={isActive}
                onPhotoSelected={
                  step.key === "photo" ? handlePhotoSelected : undefined
                }
                allowPhotoSkip={step.key === "photo"}
                photoStyleSnapshot={
                  step.key === "photo" ? photoStyleSnapshot : null
                }
              />
            );
          })}

          {curating && <CuratingLoader text="Curating your edit…" />}
        </div>

        {showResults && !curating && (
          <div className="pb-20">
            <ResultsSection
              products={recommendedProducts}
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
