import { useState, useRef, useCallback } from "react";

export type TrackingStatus =
  | "idle"
  | "loading"
  | "ready"
  | "tracking"
  | "stopped"
  | "error";

export interface TrackingResult {
  estimatedFret: number | null;
  medianX: number | null;
  sampleCount: number;
  totalFrames: number;
}

interface FretZone {
  label: string;
  fret: number;
  center: number;
}

const FRET_ZONES: FretZone[] = [
  { label: "Open", fret: 0, center: 0.10 },
  { label: "Pos I", fret: 1, center: 0.23 },
  { label: "Pos III", fret: 3, center: 0.37 },
  { label: "Pos V", fret: 5, center: 0.50 },
  { label: "Pos VII", fret: 7, center: 0.63 },
  { label: "Pos IX", fret: 9, center: 0.77 },
  { label: "Pos XII", fret: 12, center: 0.90 },
];

const DETECTION_INTERVAL_MS = 67; // ~15fps
const CONFIDENCE_THRESHOLD = 0.7;
const MIN_DETECTION_RATIO = 0.1;

const CDN_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

function mapToFretZone(normalizedX: number): FretZone {
  let best = FRET_ZONES[0];
  let bestDist = Math.abs(normalizedX - best.center);
  for (let i = 1; i < FRET_ZONES.length; i++) {
    const dist = Math.abs(normalizedX - FRET_ZONES[i].center);
    if (dist < bestDist) {
      best = FRET_ZONES[i];
      bestDist = dist;
    }
  }
  return best;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function useHandTracking() {
  const [status, setStatus] = useState<TrackingStatus>("idle");
  const [liveZone, setLiveZone] = useState<string | null>(null);
  const [result, setResult] = useState<TrackingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const handLandmarkerRef = useRef<any>(null);
  const handLandmarkerClassRef = useRef<any>(null);
  const drawingUtilsRef = useRef<any>(null);
  const animFrameRef = useRef<number>(0);
  const wristXSamplesRef = useRef<number[]>([]);
  const totalFramesRef = useRef<number>(0);
  const lastDetectTimeRef = useRef<number>(0);

  // Phase 1: Request camera + load model (called when checkbox enabled)
  const initialize = useCallback(async () => {
    try {
      setStatus("loading");
      setError(null);
      setResult(null);
      setLiveZone(null);

      // Request camera first — fail fast if permission denied
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) throw new Error("Video element not mounted");
      video.srcObject = stream;
      await video.play();

      // Dynamic import for code splitting
      const vision = await import("@mediapipe/tasks-vision");
      const { FilesetResolver, HandLandmarker, DrawingUtils } = vision;
      handLandmarkerClassRef.current = HandLandmarker;

      const wasmFileset = await FilesetResolver.forVisionTasks(CDN_BASE);

      const handLandmarker = await HandLandmarker.createFromOptions(wasmFileset, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
      });
      handLandmarkerRef.current = handLandmarker;

      // Set up drawing utils
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          drawingUtilsRef.current = new DrawingUtils(ctx);
        }
      }

      setStatus("ready");
    } catch (err) {
      let msg: string;
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        msg = "Camera permission denied. Check browser and system settings.";
      } else if (err instanceof DOMException && err.name === "NotFoundError") {
        msg = "No camera found.";
      } else {
        msg = err instanceof Error ? err.message : "Hand tracking initialization failed";
      }
      setError(msg);
      setStatus("error");
    }
  }, []);

  // Phase 2: Start detection loop (called when recording starts)
  const startDetection = useCallback(() => {
    if (!handLandmarkerRef.current || !videoRef.current) return;

    wristXSamplesRef.current = [];
    totalFramesRef.current = 0;
    lastDetectTimeRef.current = 0;
    setResult(null);
    setLiveZone(null);
    setStatus("tracking");

    const HandLandmarker = handLandmarkerClassRef.current;

    const detect = () => {
      if (!videoRef.current || !handLandmarkerRef.current) return;

      const now = performance.now();
      if (now - lastDetectTimeRef.current >= DETECTION_INTERVAL_MS) {
        lastDetectTimeRef.current = now;
        totalFramesRef.current++;

        try {
          const results = handLandmarkerRef.current.detectForVideo(
            videoRef.current,
            now
          );

          // Draw landmarks on canvas
          const canvas = canvasRef.current;
          const drawUtils = drawingUtilsRef.current;
          if (canvas && drawUtils) {
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);

              if (results.landmarks) {
                for (const landmarks of results.landmarks) {
                  drawUtils.drawConnectors(
                    landmarks,
                    HandLandmarker.HAND_CONNECTIONS,
                    { color: "#00FF00", lineWidth: 2 }
                  );
                  drawUtils.drawLandmarks(landmarks, {
                    color: "#FF0000",
                    lineWidth: 1,
                    radius: 3,
                  });
                }
              }
            }
          }

          // Find fretting hand
          // MediaPipe selfie cam: "Right" label = user's left hand = fretting hand
          if (results.landmarks && results.handednesses) {
            for (let i = 0; i < results.handednesses.length; i++) {
              const handedness = results.handednesses[i];
              if (!handedness || handedness.length === 0) continue;

              const label = handedness[0].categoryName;
              const confidence = handedness[0].score;

              if (label === "Right" && confidence > CONFIDENCE_THRESHOLD) {
                const wristX = results.landmarks[i][0].x;
                wristXSamplesRef.current.push(wristX);

                // Update live zone (inverted for selfie mirror)
                const zone = mapToFretZone(1 - wristX);
                setLiveZone(zone.label);
              }
            }
          }
        } catch {
          // Detection can fail on some frames, just skip
        }
      }

      animFrameRef.current = requestAnimationFrame(detect);
    };

    animFrameRef.current = requestAnimationFrame(detect);
  }, []);

  // Phase 2b: Stop detection loop, compute result (called when recording stops)
  const stopDetection = useCallback((): TrackingResult => {
    // Stop animation loop
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }

    // Clear canvas
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }

    const samples = wristXSamplesRef.current;
    const totalFrames = totalFramesRef.current;
    const detectionRatio = totalFrames > 0 ? samples.length / totalFrames : 0;

    let trackingResult: TrackingResult;

    if (samples.length === 0 || detectionRatio < MIN_DETECTION_RATIO) {
      trackingResult = {
        estimatedFret: null,
        medianX: null,
        sampleCount: samples.length,
        totalFrames,
      };
    } else {
      const medX = median(samples);
      const zone = mapToFretZone(1 - medX); // Invert for selfie mirror
      trackingResult = {
        estimatedFret: zone.fret,
        medianX: medX,
        sampleCount: samples.length,
        totalFrames,
      };
    }

    setResult(trackingResult);
    setStatus("ready"); // Back to ready — camera stays on for next recording
    setLiveZone(null);
    return trackingResult;
  }, []);

  // Full cleanup (called when checkbox disabled or unmount)
  const resetTracking = useCallback(() => {
    // Stop animation loop
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }

    // Stop video stream
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    // Close hand landmarker
    try {
      handLandmarkerRef.current?.close();
    } catch {
      // ignore cleanup errors
    }
    handLandmarkerRef.current = null;
    handLandmarkerClassRef.current = null;
    drawingUtilsRef.current = null;

    wristXSamplesRef.current = [];
    totalFramesRef.current = 0;
    lastDetectTimeRef.current = 0;

    setStatus("idle");
    setLiveZone(null);
    setResult(null);
    setError(null);
  }, []);

  return {
    status,
    liveZone,
    result,
    error,
    videoRef,
    canvasRef,
    initialize,
    startDetection,
    stopDetection,
    resetTracking,
  };
}
