/* =========================================================
   OPEN UP 😮 - camera.js
   Handles the webcam: permission, front camera, start, stop.
   No video is recorded or uploaded. It stays on your screen.
   ========================================================= */

(function (global) {
  "use strict";

  const video = document.getElementById("camera");

  const Camera = {
    stream: null,
    running: false,

    /* Ask the browser for the front camera and display it. */
    async start() {
      if (this.running) return true;

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw Object.assign(new Error("Your browser does not support camera access."), {
          code: "NO_API",
        });
      }

      const constraints = {
        audio: false,
        video: {
          facingMode: { ideal: "user" }, // front camera when available
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      this.stream = stream;
      video.srcObject = stream;

      try {
        await video.play();
      } catch (playError) {
        // Some browsers need a tap before autoplay starts. The stream is
        // already granted, so we can still mark the camera as running.
      }

      this.running = true;
      return true;
    },

    /* Free the camera and clear the preview. */
    stop() {
      if (this.stream) {
        this.stream.getTracks().forEach(function (track) {
          track.stop();
        });
        this.stream = null;
      }
      video.srcObject = null;
      this.running = false;
    },

    /* Human-friendly message for any camera error. */
    describeError(error) {
      const name = error ? error.name : "";
      const message = error ? String(error.message || "") : "";

      if (name === "NotAllowedError" || name === "SecurityError") {
        return "Camera permission is needed to OPEN UP 😮";
      }

      if (name === "NotFoundError" || name === "OverconstrainedError") {
        return "No camera found 📷";
      }

      if (name === "NotReadableError" || name === "AbortError") {
        return "Your camera isn't available right now.";
      }

      if (name === "NO_API") {
        return "Your browser doesn't support camera access.";
      }

      if (/denied|permission/i.test(message)) {
        return "Camera permission is needed to OPEN UP 😮";
      }

      return "The camera had a problem. Please try again.";
    },
  };

  global.Camera = Camera;
})(window);