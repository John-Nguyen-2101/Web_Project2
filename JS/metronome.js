// ======================================================
// METRONOME MODULE
// ======================================================
(function () {
  // ======================================================
  // DOM REFERENCES
  // ======================================================
  const timeSig = document.getElementById("timeSig");
  const accentMode = document.getElementById("accentMode");

  const bpmRange = document.getElementById("bpmRange");
  const bpmLabel = document.getElementById("bpmLabel");

  const volRange = document.getElementById("volRange");
  const volLabel = document.getElementById("volLabel");

  const toggleBtn = document.getElementById("toggleBtn");

  const chips = document.getElementById("chips");
  const sigPill = document.getElementById("sigPill");
  const modePill = document.getElementById("modePill");
  const subPill = document.getElementById("subPill");
  const tempoNote = document.getElementById("tempoNote");

  /// ======================================================
// AUDIO
// ======================================================
let audioCtx = null;
let masterGain = null;

function ensureAudio() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtx = new Ctx();

    masterGain = audioCtx.createGain();
    masterGain.gain.value = volume01;
    masterGain.connect(audioCtx.destination);
  }
  return audioCtx;
}

// Play one metronome click based on accent type
function click(kind) {
  const ctx = ensureAudio();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  const freq =
    kind === "strong" ? 1300 : kind === "weak" ? 950 : 820;

  const base =
    kind === "strong" ? 0.28 : kind === "weak" ? 0.16 : 0.20;

  osc.type = "square";
  osc.frequency.value = freq;

  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(base, now + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

  osc.connect(gain);
  gain.connect(masterGain);

  osc.start(now);
  osc.stop(now + 0.04);
}

  

  // ======================================================
  // STATE
  // ======================================================
  let bpm = 80;
  let volume01 = 0.7;

  let timerId = null;
  let isPlaying = false;

  let sig = "4/4";
  let stepsPerBar = 4;
  let stepIndex = 0;

  // ======================================================
  // CONFIGURATION
  // ======================================================
  function getConfig(signature) {
    if (signature === "6/8") {
      return {
        sigPill: "6/8",
        mode: "Dotted-quarter beats (2)",
        sub: "Triplet subdivision (3/beat)",
        stepsPerBar: 6,
        msPerStep: (bpmNow) => (60000 / bpmNow) / 2,
        labelForStep: (i) => {
          const map = ["1", "tri", "let", "2", "tri", "let"];
          return map[i] || String(i + 1);
        },
        kindForStep: (i, accent) => {
          if (accent === "none") return "normal";

          if (accent === "soft") {
            if (i === 0) return "strong";
            if (i === 3) return "normal";
            return "normal";
          }

          if (i === 0) return "strong";
          if (i === 3) return "weak";
          return "normal";
        },
        tempoNote: "BPM đang tính theo ♩. (dotted quarter) cho 6/8",
      };
    }

    const top = Number(String(signature).split("/")[0]) || 4;

    return {
      sigPill: signature,
      mode: "Quarter notes",
      sub: "—",
      stepsPerBar: top,
      msPerStep: (bpmNow) => 60000 / bpmNow,
      labelForStep: (i) => String(i + 1),
      kindForStep: (i, accent) => {
        if (accent === "none") return "normal";
        if (accent === "soft") return i === 0 ? "weak" : "normal";
        return i === 0 ? "strong" : "normal";
      },
      tempoNote: "",
    };
  }

  // ======================================================
  // TIMER / UI HELPERS
  // ======================================================
  function clearTimer() {
    if (timerId) {
      window.clearInterval(timerId);
      timerId = null;
    }
  }

  function setUiPlaying(playing) {
    if (!toggleBtn) return;

    if (playing) {
      toggleBtn.innerHTML = `<i class="fa-solid fa-stop"></i> Stop`;
      toggleBtn.classList.remove("btnPrimary");
      toggleBtn.classList.add("btnDanger");
    } else {
      toggleBtn.innerHTML = `<i class="fa-solid fa-play"></i> Start`;
      toggleBtn.classList.remove("btnDanger");
      toggleBtn.classList.add("btnPrimary");
    }
  }

  function renderChips(cfg) {
    chips.innerHTML = "";

    for (let i = 0; i < cfg.stepsPerBar; i++) {
      const el = document.createElement("div");
      el.className = "chipBeat" + (i === stepIndex ? " active" : "");
      el.textContent = cfg.labelForStep(i);
      chips.appendChild(el);
    }
  }

  function renderMeta(cfg) {
    sigPill.textContent = cfg.sigPill;
    modePill.textContent = cfg.mode;
    subPill.textContent = cfg.sub;
    tempoNote.textContent = cfg.tempoNote ? `• ${cfg.tempoNote}` : "";
  }

  // ======================================================
  // PLAYBACK
  // ======================================================
  function tick() {
    const cfg = getConfig(sig);
    const accent = accentMode.value;

    const kind = cfg.kindForStep(stepIndex, accent);
    click(kind);

    renderMeta(cfg);
    renderChips(cfg);

    stepIndex = (stepIndex + 1) % cfg.stepsPerBar;
  }

  async function start() {
    const ctx = ensureAudio();
    if (ctx.state === "suspended") await ctx.resume();

    clearTimer();
    isPlaying = true;
    setUiPlaying(true);

    stepIndex = 0;
    tick();

    const cfg = getConfig(sig);
    timerId = window.setInterval(() => tick(), cfg.msPerStep(bpm));
  }

  function stop() {
    clearTimer();
    isPlaying = false;
    setUiPlaying(false);

    stepIndex = 0;
    const cfg = getConfig(sig);
    renderMeta(cfg);
    renderChips(cfg);
  }

  function restartIfPlaying() {
    if (!isPlaying) {
      const cfg = getConfig(sig);
      renderMeta(cfg);
      renderChips(cfg);
      return;
    }

    clearTimer();
    const cfg = getConfig(sig);
    timerId = window.setInterval(() => tick(), cfg.msPerStep(bpm));
  }

  // ======================================================
  // STATE SETTERS
  // ======================================================
  function setBpm(next) {
    const n = Math.max(30, Math.min(240, Number(next || 80)));
    bpm = n;
    bpmLabel.textContent = String(n);
    bpmRange.value = String(n);

    restartIfPlaying();
  }

  function setVolume(nextPct) {
    const p = Math.max(0, Math.min(100, Number(nextPct || 70)));
    volLabel.textContent = String(p);
    volRange.value = String(p);
    volume01 = p / 100;
  
    if (masterGain && audioCtx) {
      const now = audioCtx.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setTargetAtTime(volume01, now, 0.015);
    }
  }

  function onChangeSig(nextSig) {
    sig = nextSig;
    stepIndex = 0;
    restartIfPlaying();
  }

  // ======================================================
  // EVENT BINDING
  // ======================================================
  timeSig.addEventListener("change", (e) => onChangeSig(e.target.value));
  accentMode.addEventListener("change", () => restartIfPlaying());

  bpmRange.addEventListener("input", (e) => setBpm(e.target.value));
  volRange.addEventListener("input", (e) => setVolume(e.target.value));

  toggleBtn.addEventListener("click", async () => {
    if (isPlaying) {
      stop();
    } else {
      await start();
    }
  });

  // ======================================================
  // INITIAL RENDER
  // ======================================================
  setBpm(80);
  setVolume(70);
  onChangeSig("4/4");
  setUiPlaying(false);
})();