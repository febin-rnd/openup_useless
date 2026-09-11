/* =========================================================
   OPEN UP 😮 - app.js
   Wires camera.js + mouth.js to the interface: live percentage,
   progress bar, motivational messages, achievements, celebration,
   and the Try Again / Stop / Restart controls.
   ========================================================= */

(function () {
  "use strict";

  const video = document.getElementById("camera");

  /* This script also loads on the landing page, so only do work on camera.html. */
  if (!video) return;

  const els = {
    status: document.getElementById("camera-status"),
    percent: document.getElementById("mouth-percent"),
    message: document.getElementById("mouth-message"),
    achievement: document.getElementById("mouth-achievement"),
    progress: document.querySelector(".progress"),
    progressFill: document.getElementById("progress-fill"),
    maxBanner: document.getElementById("max-banner"),
    confetti: document.getElementById("confetti"),
    tryAgainBtn: document.getElementById("try-again-btn"),
    stopBtn: document.getElementById("stop-btn"),
    restartBtn: document.getElementById("restart-btn"),
  };

  const STATE_MESSAGES = {
    noFace: "Where did your face go? 👀",
    multipleFaces: "One mouth at a time please 😂",
    faceTooFar: "Come a little closer 👀",
    noMouth: "I can't find your mouth! 😭",
    noModels: "Preparing the Aaaa machine... 🤖",
  };

  const MESSAGES = {
    low: [
      "Come on... open up! 😐",
      "That's barely open! 😂",
      "Is that even an Aaaa?",
    ],
    lowMid: [
      "Open a little more! 😭",
      "We need MORE mouth!",
      "You can do better! 😮",
    ],
    mid: [
      "Getting there! 👀",
      "Now we're talking!",
      "Not bad!",
    ],
    high: [
      "OPEN MORE! 🔥",
      "Come on! Wider!",
      "You're getting serious! 😮",
    ],
    veryHigh: [
      "SO CLOSE! 🚀",
      "Maximum Aaaa incoming!",
      "Don't stop now!",
    ],
    extreme: [
      "ONE MORE PUSH! 😱",
      "ALMOST THERE!",
      "OPEN UP!!! 🔥",
    ],
    max: [
      "MAXIMUM AAAA! 🎉",
      "YOU DID IT! 😮",
      "THE MOUTH HAS PEAKED! 👑",
    ],
  };

  const RANGES = [
    { min: 0, max: 20, key: "low" },
    { min: 21, max: 40, key: "lowMid" },
    { min: 41, max: 60, key: "mid" },
    { min: 61, max: 80, key: "high" },
    { min: 81, max: 95, key: "veryHigh" },
    { min: 96, max: 99, key: "extreme" },
    { min: 100, max: 100, key: "max" },
  ];

  const ACHIEVEMENTS = [
    { min: 0, icon: "🥉", label: "Tiny Aaaa" },
    { min: 31, icon: "🥈", label: "Medium Aaaa" },
    { min: 61, icon: "🥇", label: "Big Aaaa" },
    { min: 81, icon: "🔥", label: "Mega Aaaa" },
    { min: 96, icon: "👑", label: "AAAA MASTER" },
  ];

  const CONFETTI_COLORS = ["#F48FB1", "#CE93D8", "#9FA8DA", "#FFAB91", "#A5D6A7"];
  const CONFETTI_EMOJIS = ["😮", "🎉", "👑", "🔥", "😱"];

  let loopId = null;
  let running = false;
  let modelReady = false;

  let displayPercent = 0;
  let lastRangeKey = "";
  let lastMessageChange = 0;
  let currentAchievement = 0;
  let wasMax = false;
  let lastPillText = "";

  /* ---------- Small helpers ---------- */

  function setStatus(text, state) {
    els.status.textContent = text;
    els.status.classList.remove("good", "bad");
    if (state === "good") els.status.classList.add("good");
    if (state === "bad") els.status.classList.add("bad");
  }

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function achievementFor(percent) {
    let level = 0;
    for (let i = 0; i < ACHIEVEMENTS.length; i += 1) {
      if (percent >= ACHIEVEMENTS[i].min) level = i;
    }
    return ACHIEVEMENTS[level];
  }

  /* ---------- Score + motivation ---------- */

  function rangeFor(percent) {
    for (let i = 0; i < RANGES.length; i += 1) {
      if (percent >= RANGES[i].min && percent <= RANGES[i].max) return RANGES[i];
    }
    return RANGES[0];
  }

  function refreshMotivation(percent) {
    const range = rangeFor(percent);

    if (range.key !== lastRangeKey) {
      lastRangeKey = range.key;
      lastMessageChange = Date.now();
      els.message.textContent = pick(MESSAGES[range.key]);
      return;
    }

    // Swap to a random sibling message every few seconds so it feels alive.
    if (Date.now() - lastMessageChange > 3000) {
      lastMessageChange = Date.now();
      els.message.textContent = pick(MESSAGES[range.key]);
    }
  }

  function refreshAchievement(percent) {
    const level = achievementFor(percent);
    const index = ACHIEVEMENTS.indexOf(level);

    if (index !== currentAchievement) {
      currentAchievement = index;
      els.achievement.textContent = level.icon + " " + level.label;
      els.achievement.classList.remove("rarity-up");
      void els.achievement.offsetWidth; // restart the CSS animation
      els.achievement.classList.add("rarity-up");
    }
  }

  function refreshExcitement(percent) {
    els.percent.classList.toggle("hot", percent >= 80 && percent < 96);
    els.percent.classList.toggle("extreme", percent >= 96);
  }

  /* ---------- Celebration ---------- */

  function makePiece(container, useEmoji) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";

    if (useEmoji) {
      piece.textContent = pick(CONFETTI_EMOJIS);
      piece.style.fontSize = (14 + Math.random() * 18) + "px";
      piece.style.background = "transparent";
    } else {
      piece.style.background = pick(CONFETTI_COLORS);
    }

    piece.style.left = Math.random() * 100 + "%";
    piece.style.setProperty("--sway", (Math.random() * 160 - 80) + "px");
    piece.style.setProperty("--dur", (1.8 + Math.random() * 1.6) + "s");
    piece.style.setProperty("--delay", Math.random() * 0.4 + "s");
    container.appendChild(piece);
  }

  function spawnConfetti() {
    els.confetti.innerHTML = "";
    for (let i = 0; i < 34; i += 1) makePiece(els.confetti, false);
    for (let i = 0; i < 12; i += 1) makePiece(els.confetti, true);

    setTimeout(function () {
      els.confetti.innerHTML = "";
    }, 4200);
  }

  /* ---------- Detection loop ---------- */

  function updatePill(result) {
    let text;
    let state;

    switch (result.status) {
      case "ok":
        text = "Face locked on! Open up! 😮";
        state = "good";
        break;
      case "multipleFaces":
        text = "One mouth at a time please 😂";
        state = null;
        break;
      case "noFace":
        text = "Where did your face go? 👀";
        state = null;
        break;
      case "faceTooFar":
        text = "Come a little closer 👀";
        state = null;
        break;
      case "noMouth":
        text = "I can't find your mouth! 😭";
        state = null;
        break;
      default:
        text = "Preparing the Aaaa machine... 🤖";
        state = null;
    }

    if (text !== lastPillText) {
      lastPillText = text;
      setStatus(text, state);
    }
  }

  function updateUI(result) {
    const measuringOk =
      result.status === "ok" || result.status === "multipleFaces";

    const target = measuringOk ? result.percent : 0;

    // Ease the big number towards the target so it glides smoothly.
    displayPercent += (target - displayPercent) * 0.35;
    displayPercent = Math.max(0, Math.min(100, displayPercent));

    const shown = Math.round(displayPercent);
    els.percent.textContent = shown + "%";
    els.progressFill.style.width = shown + "%";
    els.progress.setAttribute("aria-valuenow", String(shown));

    if (measuringOk) {
      refreshMotivation(result.percent);
      refreshAchievement(result.percent);
      refreshExcitement(result.percent);
    } else if (STATE_MESSAGES[result.status]) {
      els.message.textContent = STATE_MESSAGES[result.status];
      refreshExcitement(0);
    }

    updatePill(result);

    // Maximum Aaaa celebration.
    if (shown >= 100) {
      els.maxBanner.hidden = false;
      if (!wasMax) {
        wasMax = true;
        spawnConfetti();
      }
    } else {
      els.maxBanner.hidden = true;
    }
  }

  function loop() {
    if (!running) return;
    loopId = requestAnimationFrame(loop);
    const result = Mouth.processFrame(video);
    updateUI(result);
  }

  function stopLoop() {
    running = false;
    if (loopId) {
      cancelAnimationFrame(loopId);
      loopId = null;
    }
  }

  /* ---------- Start / stop / restart ---------- */

  function resetScore() {
    stopLoop();
    displayPercent = 0;
    shownReset();
    lastRangeKey = "";
    wasMax = false;
    els.maxBanner.hidden = true;
    els.confetti.innerHTML = "";

    els.percent.classList.remove("hot", "extreme");
    currentAchievement = 0;
    els.achievement.textContent = ACHIEVEMENTS[0].icon + " " + ACHIEVEMENTS[0].label;
  }

  function shownReset() {
    els.percent.textContent = "0%";
    els.progressFill.style.width = "0%";
    els.message.textContent = "SAY AAAA! 😮";
  }

  function setCameraBusy(busy) {
    els.tryAgainBtn.disabled = busy;
    els.stopBtn.disabled = busy;
    els.restartBtn.disabled = busy;
  }

  async function startExperience() {
    resetScore();
    setCameraBusy(true);
    els.restartBtn.hidden = true;
    lastPillText = "";

    if (!window.isSecureContext) {
      setStatus(
        "Camera needs localhost or HTTPS to work. Open it through a server. 🌐",
        "bad"
      );
      setCameraBusy(false);
      els.restartBtn.hidden = false;
      return;
    }

    setStatus("Turning on the camera... 📷");

    try {
      await Camera.start();
    } catch (error) {
      setStatus(Camera.describeError(error), "bad");
      els.message.textContent = "Camera permission is needed to OPEN UP 😮";
      els.restartBtn.hidden = false;
      setCameraBusy(false);
      return;
    }

    if (!modelReady) {
      setStatus("Preparing the Aaaa machine... 🤖");
      try {
        await Mouth.init();
        modelReady = true;
      } catch (modelError) {
        setStatus(
          "The Aaaa machine couldn't start. Check your internet connection.",
          "bad"
        );
        els.restartBtn.hidden = false;
        setCameraBusy(false);
        return;
      }
    }

    setCameraBusy(false);

    running = true;
    loop();
  }

  function stopCamera() {
    stopLoop();
    Camera.stop();
    Mouth.reset();
    lastPillText = "";

    displayPercent = 0;
    shownReset();
    lastRangeKey = "";
    wasMax = false;
    els.maxBanner.hidden = true;
    els.confetti.innerHTML = "";
    els.percent.classList.remove("hot", "extreme");
    currentAchievement = 0;
    els.achievement.textContent = ACHIEVEMENTS[0].icon + " " + ACHIEVEMENTS[0].label;

    setStatus("Camera stopped.", "bad");
    els.restartBtn.hidden = false;
  }

  function handleTryAgain() {
    if (Camera.running) {
      // Reset the score and keep the live experience going.
      resetScore();
      els.message.textContent = "SAY AAAA! 😮";
      setStatus("Open up! 😮", "good");
      plotAgain();
    } else {
      startExperience();
    }
  }

  function plotAgain() {
    stopLoop();
    running = true;
    loop();
  }

  /* ---------- Wire up the buttons ---------- */

  els.tryAgainBtn.addEventListener("click", handleTryAgain);
  els.stopBtn.addEventListener("click", stopCamera);
  els.restartBtn.addEventListener("click", startExperience);

  /* ---------- Go! ---------- */
  startExperience();
})();