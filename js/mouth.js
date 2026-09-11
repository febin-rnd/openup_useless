/* =========================================================
   OPEN UP 😮 - mouth.js
   Loads the MediaPipe Face Landmarker model and measures how
   OPEN the user's mouth is, using 478 facial landmarks.

   Everything runs in the browser. No video ever leaves it.
   ========================================================= */

(function (global) {
  "use strict";

  // MediaPipe Tasks Vision comes from a CDN (no install, no API key).
  const BUNDLE_URL =
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";
  const WASM_URL =
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
  const MODEL_URL =
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

  // Landmark indices used for the mouth measurement.
  // (These are the well-known MediaPipe Face Landmarker indices.)
  const LIP_TOP = 13;        // centre of the inner upper lip
  const LIP_BOTTOM = 14;     // centre of the inner lower lip
  const CORNER_A = 61;       // one outer mouth corner
  const CORNER_B = 291;      // the other outer mouth corner
  const FACE_RIGHT = 234;    // outer right side of the face (scalp/cheek area)
  const FACE_LEFT = 454;     // outer left side of the face

  // Mapping from "mouth ratio" to a 0-100 % score.
  // Most people sit around 0.15 (closed) and can pass 0.85 (wide open).
  const RATIO_AT_CLOSED_MOUTH = 0.15;
  const RATIO_AT_FULL_AAA = 0.85;

  // 1 = instant (jumpy), 0.2 = very smooth (slow). 0.4 is a good balance.
  const SMOOTHING_FACTOR = 0.4;

  // How far past the frame edge a foreshortened mouth width starts being suspicious.
  const MIN_FACE_WIDTH = 0.15;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  class MouthDetector {
    constructor() {
      this.landmarker = null;
      this.smoothedRatio = null;
      this.lastResult = null;
    }

    /* Load the model. Call once before using processFrame(). */
    async init() {
      if (this.landmarker) return;

      const vision = await import(BUNDLE_URL);
      const filesetResolver = await vision.FilesetResolver.forVisionTasks(WASM_URL);

      const baseOptions = { modelAssetPath: MODEL_URL };

      try {
        this.landmarker = await vision.FaceLandmarker.createFromOptions(
          filesetResolver,
          {
            baseOptions: Object.assign({}, baseOptions, { delegate: "GPU" }),
            runningMode: "VIDEO",
            numFaces: 3,
            outputFaceBlendshapes: false,
            outputFacialTransformationMatrixes: false,
          }
        );
      } catch (gpuError) {
        // Some devices do not support GPU. Fall back to CPU.
        this.landmarker = await vision.FaceLandmarker.createFromOptions(
          filesetResolver,
          {
            baseOptions: Object.assign({}, baseOptions, { delegate: "CPU" }),
            runningMode: "VIDEO",
            numFaces: 3,
            outputFaceBlendshapes: false,
            outputFacialTransformationMatrixes: false,
          }
        );
      }
    }

    get isReady() {
      return !!this.landmarker;
    }

    /* Measure one video frame. Returns a status + a smoothed percentage. */
    processFrame(video) {
      this.lastResult = { status: "noModels", percent: 0, numFaces: 0 };

      if (!this.isReady || !video || video.readyState < 2) {
        this.lastResult.status = "noModels";
        return this.lastResult;
      }

      const result = this.landmarker.detectForVideo(video, performance.now());
      const faces = result.faceLandmarks;

      if (!faces || faces.length === 0) {
        this.smoothedRatio = null;
        this.lastResult.status = "noFace";
        return this.lastResult;
      }

      // Pick the biggest (closest) face so the camera tracks one person.
      let bestFace = faces[0];
      let bestWidth = -1;
      for (let i = 0; i < faces.length; i += 1) {
        const w = distance(faces[i][FACE_RIGHT], faces[i][FACE_LEFT]);
        if (w > bestWidth) {
          bestWidth = w;
          bestFace = faces[i];
        }
      }

      const faceWidth = bestWidth;

      // Face too far away to measure anything useful.
      if (faceWidth < MIN_FACE_WIDTH) {
        this.smoothedRatio = null;
        this.lastResult.status = "faceTooFar";
        return this.lastResult;
      }

      const mouthHeight = distance(bestFace[LIP_TOP], bestFace[LIP_BOTTOM]);
      const mouthWidth = distance(bestFace[CORNER_A], bestFace[CORNER_B]);

      if (mouthWidth < 0.001) {
        this.lastResult.status = "noMouth";
        return this.lastResult;
      }

      const rawRatio = mouthHeight / mouthWidth;

      // Smooth the ratio so the number glides instead of jumping.
      if (this.smoothedRatio === null) {
        this.smoothedRatio = rawRatio;
      } else {
        this.smoothedRatio += SMOOTHING_FACTOR * (rawRatio - this.smoothedRatio);
      }

      const percent = clamp(
        ((this.smoothedRatio - RATIO_AT_CLOSED_MOUTH) /
          (RATIO_AT_FULL_AAA - RATIO_AT_CLOSED_MOUTH)) *
          100,
        0,
        100
      );

      this.lastResult = {
        status: faces.length > 1 ? "multipleFaces" : "ok",
        percent,
        ratio: this.smoothedRatio,
        numFaces: faces.length,
      };

      return this.lastResult;
    }

    /* Called when the camera stops so old state does not leak over. */
    reset() {
      this.smoothedRatio = null;
      this.lastResult = null;
    }
  }

  global.Mouth = new MouthDetector();
})(window);