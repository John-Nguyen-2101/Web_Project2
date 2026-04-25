// ======================================================
// DOM REFERENCES
// ======================================================
let elTitle, elAuthor, elStyle, elTimeSig, elTempoHint, elBpmNow;
let elBeatBox, elSongRoot;
let btnPlay;
let bpmRange, bpmLabel;
let btnUp, btnDown, btnReset, transposeLabel;
let elNotesHint;
let btnTone, elToneOut;

// ======================================================
// SONG DATA AND GLOBAL STATE
// ======================================================
let demoSong = null;

let meter = null;
let beatsPerBar = 4;
let bpm = 80;

let tokenLineIndexes = [];
let posRef = 0;

let chordMode = "basic";
const savedChordMode = localStorage.getItem("chordMode");
if (savedChordMode === "adv" || savedChordMode === "basic") {
  chordMode = savedChordMode;
}

let isPlaying = false;
let phase = "idle";
let countIn = null;

let beat = 1;
let activeLine = 0;
let activeStep = 0;
let playback = null;
let timerId = null;

let phaseRef = "idle";
let remainingRef = 0;
let currentBeatRef = 1;

// ======================================================
// METER AND PLAYBACK CONFIG
// ======================================================
function getMeterConfig(song) {
  if (song.timeSigTop === 6 && song.timeSigBottom === 8) {
    if (song.meterMode === "sixEighth-dottedQuarter") {
      return {
        beatsPerBar: 2,
        accentStrong: [1],
        accentWeak: [2],
        timeSigLabel: "6/8 (count as 2 dotted-quarter beats ♩.)"
      };
    }

    return {
      beatsPerBar: 6,
      accentStrong: [1],
      accentWeak: [4],
      timeSigLabel: "6/8 (count as 6 eighth-note beats ♪)"
    };
  }

  return {
    beatsPerBar: song.timeSigTop,
    accentStrong: [1],
    accentWeak: [],
    timeSigLabel: `${song.timeSigTop}/${song.timeSigBottom}`
  };
}

function getPlaybackConfig(song, bpmNow) {
  const top = song?.timeSigTop;
  const bottom = song?.timeSigBottom;

  if (top === 2 && bottom === 4) {
    return {
      stepsPerBar: 4,
      stepToBeatMap: [1, 1, 2, 2],
      labelForStep: (i) => ["1", "&", "2", "&"][i] || "",
      kindForStep: (i) => {
        if (i === 0) return "strong";
        if (i === 2) return "weak";
        return "normal";
      },
      msPerStep: (60000 / bpmNow) / 2
    };
  }

  if (top === 3 && bottom === 4) {
    return {
      stepsPerBar: 3,
      stepToBeatMap: [1, 2, 3],
      labelForStep: (i) => String(i + 1),
      kindForStep: (i) => {
        if (i === 0) return "strong";
        return "normal";
      },
      msPerStep: 60000 / bpmNow
    };
  }

  if (top === 4 && bottom === 4) {
    return {
      stepsPerBar: 4,
      stepToBeatMap: [1, 2, 3, 4],
      labelForStep: (i) => String(i + 1),
      kindForStep: (i) => {
        if (i === 0) return "strong";
        return "normal";
      },
      msPerStep: 60000 / bpmNow
    };
  }

  if (top === 6 && bottom === 8) {
    return {
      stepsPerBar: 6,
      stepToBeatMap: [1, 1, 1, 2, 2, 2],
      labelForStep: (i) => ["1", "tri", "let", "2", "tri", "let"][i] || "",
      kindForStep: (i) => {
        if (i === 0) return "strong";
        if (i === 3) return "weak";
        return "normal";
      },
      msPerStep: (60000 / bpmNow) / 2
    };
  }

  return {
    stepsPerBar: top || 4,
    stepToBeatMap: Array.from({ length: top || 4 }, (_, i) => i + 1),
    labelForStep: (i) => String(i + 1),
    kindForStep: (i) => (i === 0 ? "strong" : "normal"),
    msPerStep: 60000 / bpmNow
  };
}

// ======================================================
// AUDIO
// ======================================================
let audioCtx = null;

function ensureAudioContext() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtx = new Ctx();
  }
  return audioCtx;
}

function click(level) {
  const ctx = ensureAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "square";

  const freq = level === "strong" ? 1200 : level === "weak" ? 900 : 800;
  const amp = level === "strong" ? 0.25 : level === "weak" ? 0.12 : 0.18;
  osc.frequency.value = freq;

  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(amp, now + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.035);
}

// ======================================================
// TRANSPOSE AND VIDEO TONE
// ======================================================
let transpose = 0;

const NOTE_SHARPS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

let mainVideo, videoPrev, videoNext, videoToneLabel;

const videoList = [
  { tone: "C / Am", embed: "https://www.youtube.com/embed/Vw5d4uKVT-4?rel=0" },
  { tone: "C# / A#m", embed: "https://www.youtube.com/embed/X66oNOiy5sQ?si=0" },
  { tone: "D / Bm", embed: "https://www.youtube.com/embed/7SuX6oHttMk?rel=0" },
  { tone: "D# / Cm", embed: "https://www.youtube.com/embed/xDVMBaj623w?si=0" },
  { tone: "E / C#m", embed: "https://www.youtube.com/embed/DGNO83LTPxU?si=0" },
  { tone: "F / Dm", embed: "https://www.youtube.com/embed/f90ZNZVth6c?rel=0" },
  { tone: "F# / D#m", embed: "https://www.youtube.com/embed/MSVkxAddqNs?si=0" },
  { tone: "G / Em", embed: "https://www.youtube.com/embed/XgYDU24xea8?rel=0" },
  { tone: "G# / Fm", embed: "https://www.youtube.com/embed/J5UI0DIMuSk?si=0" },
  { tone: "A / F#m", embed: "https://www.youtube.com/embed/HcCfr9c8o2o?rel=0" },
  { tone: "A# / Gm", embed: "https://www.youtube.com/embed/J1gfcPFrc5s?rel=0" },
  { tone: "B / G#m", embed: "https://www.youtube.com/embed/k_HoyvBWFjs?rel=0" }
];

const FLAT_TO_SHARP = {
  Db: "C#",
  Eb: "D#",
  Gb: "F#",
  Ab: "G#",
  Bb: "A#"
};

function transposeRoot(root, semis) {
  const normalized = FLAT_TO_SHARP[root] || root;
  const idx = NOTE_SHARPS.indexOf(normalized);
  if (idx === -1) return root;

  let newIdx = (idx + semis) % 12;
  if (newIdx < 0) newIdx += 12;

  return NOTE_SHARPS[newIdx];
}

function transposeChord(chord, semis) {
  if (!chord) return chord;

  const m = chord.match(/^([A-G])([#b]?)(.*)$/);
  if (!m) return chord;

  const root = m[1] + (m[2] || "");
  const rest = m[3] || "";

  const newRoot = transposeRoot(root, semis);
  return newRoot + rest;
}

function getDisplayChord(chord) {
  return transposeChord(chord, transpose);
}

function isRealChord(ch) {
  return !!ch && String(ch).trim() !== "";
}

function findLastChordRaw(song) {
  if (!song?.lines) return null;

  for (let i = song.lines.length - 1; i >= 0; i--) {
    const line = song.lines[i];
    if (!line?.tokens) continue;

    for (let j = line.tokens.length - 1; j >= 0; j--) {
      const t = line.tokens[j];
      const raw = getTokenChord(t);
      if (isRealChord(raw)) return raw;
    }
  }

  return null;
}

function chordRoot(chord) {
  const m = String(chord).trim().match(/^([A-G])([#b]?)/);
  return m ? (m[1] + (m[2] || "")) : null;
}

function getSongToneDisplay() {
  const toneRaw = demoSong.tone ?? demoSong.key ?? "—";
  const tone = toneRaw !== "—" ? getDisplayChord(toneRaw) : "—";

  const lastRaw = findLastChordRaw(demoSong);
  const lastChord = lastRaw ? getDisplayChord(lastRaw) : "—";

  return { tone, lastChord };
}

function getTokenChord(t) {
  const basic = t.chordBasic ?? t.chord ?? null;
  const adv = t.chordAdv ?? null;

  if (chordMode === "adv") return adv ?? basic;
  return basic;
}

function mod(n, m) {
  return ((n % m) + m) % m;
}

function renderVideoByTranspose() {
  if (!mainVideo || !videoToneLabel || !demoSong) return;

  const toneRaw = demoSong.tone ?? demoSong.key ?? "C";
  const root = chordRoot(toneRaw);
  const normalizedRoot = FLAT_TO_SHARP[root] || root;

  const baseIndex = NOTE_SHARPS.indexOf(normalizedRoot);
  const safeBaseIndex = baseIndex === -1 ? 0 : baseIndex;

  const index = mod(safeBaseIndex + transpose, 12);
  const item = videoList[index];

  mainVideo.src = item.embed;
  videoToneLabel.textContent = `Video tone: ${item.tone}`;
}

// ======================================================
// RENDER HELPERS
// ======================================================
function beatClickLevel(b) {
  if (meter.accentStrong.includes(b)) return "strong";
  if (meter.accentWeak.includes(b)) return "weak";
  return "normal";
}

function nextBeat(b) {
  return b >= beatsPerBar ? 1 : b + 1;
}

function clearTimer() {
  if (timerId) {
    window.clearInterval(timerId);
    timerId = null;
  }
}

function setPlayUi(playing) {
  if (!btnPlay) return;

  if (playing) {
    btnPlay.innerHTML = `<i class="fa-solid fa-stop"></i> Stop`;
    btnPlay.classList.add("is-stop");
  } else {
    btnPlay.innerHTML = `<i class="fa-solid fa-play"></i> Start`;
    btnPlay.classList.remove("is-stop");
  }
}

function renderNotesHint() {
  if (!elNotesHint || !demoSong) return;

  const top = demoSong.timeSigTop;
  const bottom = demoSong.timeSigBottom;

  if (top === 2 && bottom === 4) {
    elNotesHint.textContent = "Notes: Mỗi ô = 1 nốt đơn (♪)";
    return;
  }

  if (top === 6 && bottom === 8) {
    elNotesHint.textContent = "Notes: Mỗi 3 ô = 1 liên ba (1-la-li / 2-la-li)";
    return;
  }

  elNotesHint.textContent = "Notes: Mỗi ô = 1 nốt đen (♩)";
}

function renderMeta() {
  elTitle.textContent = demoSong.title;
  elAuthor.textContent = `👤 ${demoSong.author}`;
  elStyle.textContent = `🎼 ${demoSong.style}`;
  elTimeSig.textContent = `🕒 Nhịp: ${meter.timeSigLabel}`;
  elTempoHint.textContent = `✅ Tempo gợi ý: ${demoSong.recommendedTempo}`;
  elBpmNow.textContent = `⏱ Đang tập: ${bpm} BPM`;

  bpmRange.value = String(bpm);
  bpmLabel.textContent = String(bpm);
}

function renderBeatChips() {
  if (!elBeatBox || !playback) return;

  elBeatBox.innerHTML = "";
  for (let i = 0; i < playback.stepsPerBar; i++) {
    const chip = document.createElement("span");
    chip.className = "beatChip" + (activeStep === i ? " active" : "");
    chip.textContent = playback.labelForStep(i);
    elBeatBox.appendChild(chip);
  }
}

let countInShown = false;

function makeSectionNode(sectionLine) {
  const wrap = document.createElement("div");
  wrap.className = "sectionWrapper";

  const title = document.createElement("div");
  title.className = "sectionTitle";
  title.textContent = sectionLine.section;

  wrap.appendChild(title);

  if (phase === "countin" && countIn && !countInShown) {
    const ci = document.createElement("div");
    ci.className = "sectionCountIn";
    ci.textContent = String(countIn);
    wrap.appendChild(ci);

    countInShown = true;
  }

  return wrap;
}

let lastScrolledLine = -1;

function autoScrollToActiveLine() {
  if (!isPlaying) return;
  if (activeLine === lastScrolledLine) return;

  const target = elSongRoot.querySelector(`[data-line-idx="${activeLine}"]`);
  if (!target) return;

  lastScrolledLine = activeLine;

  target.scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "nearest",
  });
}

function makeLineGridNode(tokens, lineIdx) {
  const grid = document.createElement("div");
  grid.className = "lineGrid";
  const cols = tokens.length;

  grid.style.gridTemplateColumns = `repeat(${cols}, minmax(44px, 1fr))`;
  if (isPlaying && lineIdx !== activeLine) grid.style.opacity = "0.9";

  tokens.forEach((t, i) => {
    const cell = document.createElement("div");
    cell.className = "gridCell chordCell";

    const rawChord = getTokenChord(t);
    const hasChord = !!rawChord && String(rawChord).trim() !== "";
    const isCurrentLine = lineIdx === activeLine;

    const prevBeatIndex = i > 0 ? tokens[i - 1].beatIndex : null;
    const isFirstCellOfBeat = i === 0 || t.beatIndex !== prevBeatIndex;

    const chordBeatActive =
      isPlaying &&
      phase !== "countin" &&
      isCurrentLine &&
      isFirstCellOfBeat &&
      t.beatIndex === beat &&
      shouldHighlightBeat(demoSong, beat);

    if (chordBeatActive) cell.classList.add("cellActive");

    cell.textContent = hasChord ? getDisplayChord(rawChord) : "\u00A0";

    grid.appendChild(cell);
  });

  tokens.forEach((t) => {
    const cell = document.createElement("div");
    cell.className = "gridCell lyricCell";
    cell.textContent = t.lyric && t.lyric.length ? t.lyric : "\u00A0";
    grid.appendChild(cell);
  });

  return grid;
}

function renderSong() {
  elSongRoot.innerHTML = "";

  countInShown = false;
  let buffer = [];
  let groupCount = 0;

  demoSong.lines.forEach((line, index) => {
    if (line.section) {
      if (buffer.length > 0) {
        const groupRow = document.createElement("div");
        groupRow.className = "groupRow";

        buffer.forEach((b) => {
          const lineWrap = document.createElement("div");
          lineWrap.className = "lineWrap";
          lineWrap.dataset.lineIdx = String(b.__lineIdx);

          lineWrap.appendChild(makeLineGridNode(b.tokens, b.__lineIdx));
          groupRow.appendChild(lineWrap);
        });

        elSongRoot.appendChild(groupRow);

        buffer = [];
        groupCount++;
      }

      elSongRoot.appendChild(makeSectionNode(line));
      return;
    }

    buffer.push({ tokens: line.tokens, __lineIdx: index });

    if (buffer.length === 3) {
      const groupRow = document.createElement("div");
      groupRow.className = "groupRow";

      buffer.forEach((b) => {
        const lineWrap = document.createElement("div");
        lineWrap.className = "lineWrap";
        lineWrap.dataset.lineIdx = String(b.__lineIdx);

        lineWrap.appendChild(makeLineGridNode(b.tokens, b.__lineIdx));
        groupRow.appendChild(lineWrap);
      });

      elSongRoot.appendChild(groupRow);

      buffer = [];
      groupCount++;
    }
  });

  if (buffer.length > 0) {
    const groupRow = document.createElement("div");
    groupRow.className = "groupRow";

    buffer.forEach((b) => {
      const lineWrap = document.createElement("div");
      lineWrap.className = "lineWrap";
      lineWrap.dataset.lineIdx = String(b.__lineIdx);

      lineWrap.appendChild(makeLineGridNode(b.tokens, b.__lineIdx));
      groupRow.appendChild(lineWrap);
    });

    elSongRoot.appendChild(groupRow);
  }
}

function shouldHighlightBeat(song, beatNum) {
  const top = song?.timeSigTop;
  const bottom = song?.timeSigBottom;

  if (top === 2 && bottom === 4) {
    return beatNum === 1 || beatNum === 2;
  }

  if (top === 3 && bottom === 4) {
    return beatNum === 1;
  }

  if (top === 4 && bottom === 4) {
    return beatNum === 1 || beatNum === 3;
  }

  if (top === 6 && bottom === 8) {
    return beatNum === 1 || beatNum === 2;
  }

  return beatNum === 1;
}

// ======================================================
// PLAYBACK TICK
// ======================================================
function tick() {
  if (!playback) return;

  beat = playback.stepToBeatMap[activeStep] ?? 1;

  if (phaseRef === "countin") {
    click(playback.kindForStep(activeStep));
    renderBeatChips();

    countIn = getCountInDisplay(playback, activeStep);
    renderSong();

    const isLastCountStep = activeStep >= playback.stepsPerBar - 1;

    if (isLastCountStep) {
      phase = "countin-end";
      phaseRef = "countin-end";
      return;
    }

    activeStep += 1;
    return;
  }

  if (phaseRef === "countin-end") {
    countIn = null;
    phase = "play";
    phaseRef = "play";

    activeStep = 0;
    beat = playback.stepToBeatMap[0] ?? 1;

    posRef = 0;
    activeLine = tokenLineIndexes[0] ?? 0;

    click(playback.kindForStep(activeStep));
    renderBeatChips();
    renderSong();
    autoScrollToActiveLine();

    activeStep = (activeStep + 1) % playback.stepsPerBar;
    beat = playback.stepToBeatMap[activeStep] ?? 1;
    return;
  }

  if (phaseRef === "play") {
    click(playback.kindForStep(activeStep));
    renderBeatChips();
    renderSong();

    const isLastStepOfBar = activeStep === playback.stepsPerBar - 1;

    if (isLastStepOfBar) {
      if (posRef >= tokenLineIndexes.length - 1) {
        stopAndResetToStart();
        return;
      }

      posRef += 1;
      activeLine = tokenLineIndexes[posRef];
      autoScrollToActiveLine();
    }

    activeStep = (activeStep + 1) % playback.stepsPerBar;
    beat = playback.stepToBeatMap[activeStep] ?? 1;
  }
}

// ======================================================
// PLAYBACK CONTROLS
// ======================================================
async function start() {
  const ctx = ensureAudioContext();
  if (ctx.state === "suspended") await ctx.resume();

  clearTimer();
  isPlaying = true;
  setPlayUi(true);

  phase = "countin";
  phaseRef = "countin";

  playback = getPlaybackConfig(demoSong, bpm);

  countIn = null;
  remainingRef = 0;

  currentBeatRef = 1;
  beat = 1;
  activeStep = 0;
  posRef = 0;
  activeLine = tokenLineIndexes[0] ?? 0;
  lastScrolledLine = -1;

  renderBeatChips();
  renderSong();
  autoScrollToActiveLine();

  tick();
  timerId = window.setInterval(tick, playback.msPerStep);
}

function getCountInDisplay(playback, stepIndex) {
  const beatNum = playback.stepToBeatMap[stepIndex] ?? 1;
  const prevBeat = stepIndex > 0 ? playback.stepToBeatMap[stepIndex - 1] : null;
  const isFirstStepOfBeat = stepIndex === 0 || beatNum !== prevBeat;

  return isFirstStepOfBeat ? String(beatNum) : "";
}

function stopAndResetToStart() {
  clearTimer();
  isPlaying = false;
  setPlayUi(false);

  phase = "idle";
  phaseRef = "idle";

  countIn = null;
  remainingRef = 0;

  beat = 1;
  currentBeatRef = 1;
  activeStep = 0;

  posRef = 0;
  activeLine = tokenLineIndexes[0] ?? 0;

  lastScrolledLine = -1;

  renderBeatChips();
  renderSong();
}

function stop() {
  clearTimer();
  isPlaying = false;
  setPlayUi(false);

  phase = "idle";
  phaseRef = "idle";

  countIn = null;
  remainingRef = 0;

  beat = 1;
  currentBeatRef = 1;
  activeStep = 0;
  posRef = 0;
  activeLine = tokenLineIndexes[0] ?? 0;
  lastScrolledLine = -1;

  renderBeatChips();
  renderSong();
}

// ======================================================
// SCROLL TO TOP
// ======================================================
const scrollTopBtn = document.getElementById("scrollTopBtn");

window.addEventListener("scroll", () => {
  if (window.scrollY > 200) {
    scrollTopBtn.classList.add("show");
  } else {
    scrollTopBtn.classList.remove("show");
  }
});

scrollTopBtn.addEventListener("click", () => {
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
});

// ======================================================
// TEMPO / TIMER UPDATE
// ======================================================
function restartInterval() {
  if (!isPlaying) return;
  clearTimer();
  playback = getPlaybackConfig(demoSong, bpm);
  timerId = window.setInterval(tick, playback.msPerStep);
}

// ======================================================
// SONG LOADING
// ======================================================
async function loadSong() {
  try {
    const params = new URLSearchParams(window.location.search);
    const songId = (params.get("song") || "").trim();

    if (!songId) {
      alert("Thiếu mã bài hát trên URL.");
      return;
    }

    demoSong = await loadSongScriptById(songId);

    if (!demoSong) {
      alert("Không tìm thấy dữ liệu bài hát: " + songId);
      return;
    }

    if (demoSong.quickText) {
      const gridConfig = getBarGridConfig(demoSong);

      demoSong.lines = parseQuickLines(demoSong.quickText, {
        cellsPerBar: gridConfig.cellsPerBar,
        cellToBeatMap: gridConfig.cellToBeatMap,
        includeSpacerChord: true
      });
    }

    meter = getMeterConfig(demoSong);
    beatsPerBar = meter.beatsPerBar;
    bpm = demoSong.bpm;
    playback = getPlaybackConfig(demoSong, bpm);

    tokenLineIndexes = demoSong.lines
      .map((l, i) => (l.tokens ? i : -1))
      .filter((i) => i !== -1);

    posRef = 0;
    activeLine = tokenLineIndexes[0] ?? 0;

    init();
  } catch (err) {
    console.error(err);
    alert("Không load được bài hát.");
  }
}

// ======================================================
// INITIALIZATION
// ======================================================
function init() {
  mainVideo = document.getElementById("mainVideo");
  videoPrev = document.getElementById("videoPrev");
  videoNext = document.getElementById("videoNext");
  videoToneLabel = document.getElementById("videoToneLabel");

  elTitle = document.getElementById("songTitle");
  elAuthor = document.getElementById("songAuthor");
  elStyle = document.getElementById("songStyle");
  elTimeSig = document.getElementById("songTimeSig");
  elTempoHint = document.getElementById("songTempoHint");
  elBpmNow = document.getElementById("songBpmNow");
  elNotesHint = document.getElementById("notesHint");
  elBeatBox = document.getElementById("beatBox");
  elSongRoot = document.getElementById("songRoot");
  btnTone = document.getElementById("btnTone");
  elToneOut = document.getElementById("toneOut");
  btnPlay = document.getElementById("btnPlay");

  bpmRange = document.getElementById("bpmRange");
  bpmLabel = document.getElementById("bpmLabel");

  btnPlay.addEventListener("click", () => {
    if (isPlaying) stop();
    else start();
  });

  renderMeta();
  renderBeatChips();
  renderNotesHint();
  setPlayUi(false);

  bpmRange.addEventListener("input", (e) => {
    bpm = Number(e.target.value);
    bpmLabel.textContent = String(bpm);
    elBpmNow.textContent = `⏱ Đang tập: ${bpm} BPM`;
    restartInterval();
  });

  function renderTone() {
    if (!elToneOut) return;
    const { tone } = getSongToneDisplay();
    elToneOut.textContent = `Tone: ${tone}`;
  }

  const btnBasic = document.getElementById("btnBasic");
  const btnAdv = document.getElementById("btnAdv");

  function setChordMode(mode) {
    chordMode = mode;
    localStorage.setItem("chordMode", mode);

    btnBasic?.classList.toggle("is-active", mode === "basic");
    btnAdv?.classList.toggle("is-active", mode === "adv");

    renderSong();
    renderTone();
  }

  btnBasic?.addEventListener("click", () => setChordMode("basic"));
  btnAdv?.addEventListener("click", () => setChordMode("adv"));
  btnTone?.addEventListener("click", renderTone);
  setChordMode(chordMode);

  btnUp = document.getElementById("btnUp");
  btnDown = document.getElementById("btnDown");
  btnReset = document.getElementById("btnReset");
  transposeLabel = document.getElementById("transposeLabel");

  function updateTransposeLabel() {
    if (transposeLabel) transposeLabel.textContent = `🎚 Transpose: ${transpose}`;
  }

  function applyTransposeUi() {
    updateTransposeLabel();
    renderSong();
    renderTone();
    renderVideoByTranspose();
  }

  btnUp?.addEventListener("click", () => {
    transpose += 1;
    applyTransposeUi();
  });

  btnDown?.addEventListener("click", () => {
    transpose -= 1;
    applyTransposeUi();
  });

  btnReset?.addEventListener("click", () => {
    transpose = 0;
    applyTransposeUi();
  });

  videoPrev?.addEventListener("click", () => {
    transpose -= 1;
    applyTransposeUi();
  });

  videoNext?.addEventListener("click", () => {
    transpose += 1;
    applyTransposeUi();
  });

  applyTransposeUi();
}

document.addEventListener("DOMContentLoaded", loadSong);