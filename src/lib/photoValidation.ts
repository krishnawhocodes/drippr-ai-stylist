import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { PhotoValidationResult } from "@/types/recommendation";

type PhotoStyleSnapshot = {
  skinToneLabel: string;
  bodyFrameLabel: string;
  poseLabel: string;
};

type PreparedPhotoResult = {
  imageDataUrl: string;
  photoValidation: PhotoValidationResult;
  styleSnapshot: PhotoStyleSnapshot;
};

const WASM_BASE = "https://unpkg.com/@mediapipe/tasks-vision@0.10.21/wasm";
const MODEL_PATH =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";

let poseLandmarkerPromise: Promise<PoseLandmarker> | null = null;

async function getPoseLandmarker() {
  if (!poseLandmarkerPromise) {
    poseLandmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE);

      return PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_PATH,
        },
        runningMode: "IMAGE",
        numPoses: 2,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    })();
  }

  return poseLandmarkerPromise;
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image"));

    image.src = dataUrl;
  });
}

async function compressImage(file: File, maxDimension = 1280, quality = 0.88) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const sourceImage = await new Promise<HTMLImageElement>(
      (resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () =>
          reject(new Error("Could not open selected image"));
        image.src = objectUrl;
      },
    );

    const { width, height } = sourceImage;
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas is not available");
    }

    context.drawImage(sourceImage, 0, 0, targetWidth, targetHeight);

    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function landmarkVisible(landmark?: {
  visibility?: number;
  presence?: number;
}) {
  const visibility = landmark?.visibility ?? 0;
  const presence = landmark?.presence ?? visibility;
  return Math.max(visibility, presence) >= 0.45;
}

function averagePoint(
  a?: { x: number; y: number },
  b?: { x: number; y: number },
) {
  if (!a || !b) return null;
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function buildValidationResult(
  result: Awaited<ReturnType<PoseLandmarker["detect"]>>,
): PhotoValidationResult {
  const poses = result.landmarks ?? [];
  const personCount = poses.length;

  if (personCount !== 1) {
    return {
      isValid: false,
      reason:
        personCount === 0
          ? "No clear person was detected. Please upload a clearer full-body photo."
          : "Please upload a photo with only one person visible.",
      summary: {
        personCount,
        visibleParts: {
          head: false,
          shoulders: false,
          hips: false,
          knees: false,
          ankles: false,
        },
        framing: "unknown",
        facing: "unknown",
        posture: "unknown",
        visibilityScore: 0,
      },
    };
  }

  const landmarks = poses[0] ?? [];

  const nose = landmarks[0];
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const leftKnee = landmarks[25];
  const rightKnee = landmarks[26];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];

  const head = landmarkVisible(nose);
  const shoulders =
    landmarkVisible(leftShoulder) && landmarkVisible(rightShoulder);
  const hips = landmarkVisible(leftHip) && landmarkVisible(rightHip);
  const knees = landmarkVisible(leftKnee) && landmarkVisible(rightKnee);
  const ankles = landmarkVisible(leftAnkle) && landmarkVisible(rightAnkle);

  const visiblePoints = landmarks.filter((point) => landmarkVisible(point));
  const yValues = visiblePoints.map((point) => point.y);
  const minY = yValues.length ? Math.min(...yValues) : 0;
  const maxY = yValues.length ? Math.max(...yValues) : 0;
  const bodyCoverage = maxY - minY;

  const shoulderWidth =
    landmarkVisible(leftShoulder) && landmarkVisible(rightShoulder)
      ? Math.abs((leftShoulder?.x ?? 0) - (rightShoulder?.x ?? 0))
      : 0;

  const hipWidth =
    landmarkVisible(leftHip) && landmarkVisible(rightHip)
      ? Math.abs((leftHip?.x ?? 0) - (rightHip?.x ?? 0))
      : 0;

  const averageWidth = (shoulderWidth + hipWidth) / 2;

  let facing: "front" | "three_quarter" | "side" | "unknown" = "unknown";
  if (averageWidth >= 0.18) facing = "front";
  else if (averageWidth >= 0.11) facing = "three_quarter";
  else if (averageWidth > 0) facing = "side";

  const shoulderMid = averagePoint(leftShoulder, rightShoulder);
  const hipMid = averagePoint(leftHip, rightHip);

  let posture: "upright" | "slightly_angled" | "dynamic" | "unknown" =
    "unknown";
  if (shoulderMid && hipMid) {
    const torsoDrift = Math.abs(shoulderMid.x - hipMid.x);
    if (torsoDrift < 0.05) posture = "upright";
    else if (torsoDrift < 0.12) posture = "slightly_angled";
    else posture = "dynamic";
  }

  const visibilityScore = clamp01(
    ([head, shoulders, hips, knees, ankles].filter(Boolean).length / 5) * 0.7 +
      clamp01((bodyCoverage - 0.45) / 0.4) * 0.3,
  );

  const isFullBody =
    head && shoulders && hips && knees && ankles && bodyCoverage >= 0.65;

  return {
    isValid: isFullBody,
    reason: isFullBody
      ? null
      : !head
        ? "Please upload a full-body photo with your head clearly visible."
        : !ankles
          ? "Please upload a head-to-toe photo with your feet visible."
          : !knees
            ? "Your lower body is not fully visible. Please upload a full-body photo."
            : bodyCoverage < 0.65
              ? "The person is too cropped. Please upload a full-body photo from head to toe."
              : "Please upload a clear full-body photo from head to toe.",
    summary: {
      personCount,
      visibleParts: {
        head,
        shoulders,
        hips,
        knees,
        ankles,
      },
      framing: isFullBody ? "full_body" : "partial_body",
      facing,
      posture,
      visibilityScore,
    },
  };
}

function deriveBodyFrameLabel(summary: PhotoValidationResult["summary"]) {
  if (summary.facing === "side") return "Lean frame";
  if (summary.posture === "dynamic") return "Defined frame";
  if (summary.facing === "three_quarter") return "Balanced frame";
  return "Balanced frame";
}

function derivePoseLabel(summary: PhotoValidationResult["summary"]) {
  if (summary.posture === "dynamic") return "Dynamic pose";
  if (summary.facing === "three_quarter") return "Angled pose";
  if (summary.facing === "side") return "Side pose";
  return "Front-facing pose";
}

function deriveSkinToneLabel(image: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(image.width * 0.3));
  canvas.height = Math.max(1, Math.floor(image.height * 0.18));

  const context = canvas.getContext("2d");
  if (!context) return "Natural tone";

  const sampleX = Math.floor(image.width * 0.35);
  const sampleY = Math.floor(image.height * 0.12);
  const sampleW = Math.max(1, Math.floor(image.width * 0.3));
  const sampleH = Math.max(1, Math.floor(image.height * 0.18));

  context.drawImage(
    image,
    sampleX,
    sampleY,
    sampleW,
    sampleH,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;

  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < 10) continue;

    totalR += data[i];
    totalG += data[i + 1];
    totalB += data[i + 2];
    count += 1;
  }

  if (count === 0) return "Natural tone";

  const avgR = totalR / count;
  const avgG = totalG / count;
  const avgB = totalB / count;
  const luminance = 0.2126 * avgR + 0.7152 * avgG + 0.0722 * avgB;

  if (luminance >= 185) return "Light tone";
  if (luminance >= 130) return "Medium tone";
  return "Deep tone";
}

export async function prepareValidatedPhoto(
  file: File,
): Promise<PreparedPhotoResult> {
  const imageDataUrl = await compressImage(file);
  const image = await loadImage(imageDataUrl);
  const poseLandmarker = await getPoseLandmarker();
  const result = poseLandmarker.detect(image);
  const photoValidation = buildValidationResult(result);

  return {
    imageDataUrl,
    photoValidation,
    styleSnapshot: {
      skinToneLabel: deriveSkinToneLabel(image),
      bodyFrameLabel: deriveBodyFrameLabel(photoValidation.summary),
      poseLabel: derivePoseLabel(photoValidation.summary),
    },
  };
}
