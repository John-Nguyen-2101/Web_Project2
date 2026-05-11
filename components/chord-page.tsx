"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { ParsedSong, SongLineToken } from "@/lib/song-data";

const NOTE_SHARPS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

const FLAT_TO_SHARP: Record<string, string> = {
  Db: "C#",
  Eb: "D#",
  Gb: "F#",
  Ab: "G#",
  Bb: "A#",
};

const VIDEO_LIST = [
  { tone: "C / Am", embed: "https://www.youtube.com/embed/Vw5d4uKVT-4?rel=0" },
  { tone: "C# / A#m", embed: "https://www.youtube.com/embed/X66oNOiy5sQ?si=0" },
  { tone: "D / Bm", embed: "https://www.youtube.com/embed/7SuX6oHttMk?rel=0" },
  { tone: "D# / Cm", embed: "https://www.youtube.com/embed/xDVMBaj623w?si=0" },
  { tone: "E / C#m", embed: "https://www.youtube.com/embed/DGNO83LTPxU?si=0" },
  { tone: "F / Dm", embed: "https://www.youtube.com/embed/f90ZNZVth6c?rel=0" },
  { tone: "F# / D#m", embed: "https://www.youtube.com/embed/MSVkxAddqNs?si=0" },
  { tone: "G / Em", embed: "https://www.youtube.com/embed/XgYDU24xea8?rel=0" },
  { tone: "G# / Fm", embed: "https://www.youtube.com/embed/J5UI0DIMuSk?si=0" },
  { tone: "A / F#m", embed: "https://www.youtube.com/embed/HcCfr9c8o2o?si=0" },
  { tone: "A# / Gm", embed: "https://www.youtube.com/embed/J1gfcPFrc5s?si=0" },
  { tone: "B / G#m", embed: "https://www.youtube.com/embed/k_HoyvBWFjs?si=0" },
] as const;

type ChordMode = "basic" | "adv";

type PlaybackConfig = {
  stepsPerBar: number;
  stepToBeatMap: number[];
  labelForStep: (index: number) => string;
  kindForStep: (index: number) => "strong" | "weak" | "normal";
  msPerStep: number;
};

type MeterConfig = {
  beatsPerBar: number;
  accentStrong: number[];
  accentWeak: number[];
  timeSigLabel: string;
};

function mod(n: number, m: number) {
  return ((n % m) + m) % m;
}

function getMeterConfig(song: ParsedSong): MeterConfig {
  if (song.timeSigTop === 6 && song.timeSigBottom === 8) {
    if (song.meterMode === "sixEighth-dottedQuarter") {
      return {
        beatsPerBar: 2,
        accentStrong: [1],
        accentWeak: [2],
        timeSigLabel: "6/8 (count as 2 dotted-quarter beats ♩.)",
      };
    }

    return {
      beatsPerBar: 6,
      accentStrong: [1],
      accentWeak: [4],
      timeSigLabel: "6/8 (count as 6 eighth-note beats ♪)",
    };
  }

  return {
    beatsPerBar: song.timeSigTop,
    accentStrong: [1],
    accentWeak: [],
    timeSigLabel: `${song.timeSigTop}/${song.timeSigBottom}`,
  };
}

function getLayoutStrongCells(song: ParsedSong) {
  const layout = song.layout as
    | (NonNullable<ParsedSong["layout"]> & { strong_cells?: number[] })
    | undefined;

  return (layout?.strongCells || layout?.strong_cells || []).filter(
    (cellNumber) => Number.isInteger(cellNumber) && cellNumber > 0,
  );
}

function getPlaybackConfig(song: ParsedSong, bpm: number): PlaybackConfig {
  const top = song.timeSigTop;
  const bottom = song.timeSigBottom;

  if (top === 2 && bottom === 4) {
    return {
      stepsPerBar: 4,
      stepToBeatMap: [1, 1, 2, 2],
      labelForStep: (index) => ["1", "&", "2", "&"][index] || "",
      kindForStep: (index) => {
        if (index === 0) return "strong";
        if (index === 2) return "weak";
        return "normal";
      },
      msPerStep: (60000 / bpm) / 2,
    };
  }

  if (top === 3 && bottom === 4) {
    return {
      stepsPerBar: 3,
      stepToBeatMap: [1, 2, 3],
      labelForStep: (index) => String(index + 1),
      kindForStep: (index) => (index === 0 ? "strong" : "normal"),
      msPerStep: 60000 / bpm,
    };
  }

  if (top === 4 && bottom === 4) {
    return {
      stepsPerBar: 4,
      stepToBeatMap: [1, 2, 3, 4],
      labelForStep: (index) => String(index + 1),
      kindForStep: (index) => (index === 0 ? "strong" : "normal"),
      msPerStep: 60000 / bpm,
    };
  }

  if (top === 6 && bottom === 8) {
    return {
      stepsPerBar: 6,
      stepToBeatMap: [1, 1, 1, 2, 2, 2],
      labelForStep: (index) => ["1", "tri", "let", "2", "tri", "let"][index] || "",
      kindForStep: (index) => {
        if (index === 0) return "strong";
        if (index === 3) return "weak";
        return "normal";
      },
      msPerStep: (60000 / bpm) / 2,
    };
  }

  return {
    stepsPerBar: top || 4,
    stepToBeatMap: Array.from({ length: top || 4 }, (_, index) => index + 1),
    labelForStep: (index) => String(index + 1),
    kindForStep: (index) => (index === 0 ? "strong" : "normal"),
    msPerStep: 60000 / bpm,
  };
}

function transposeRoot(root: string, semitones: number) {
  const normalizedRoot = FLAT_TO_SHARP[root] || root;
  const index = NOTE_SHARPS.indexOf(normalizedRoot as (typeof NOTE_SHARPS)[number]);

  if (index === -1) {
    return root;
  }

  const nextIndex = mod(index + semitones, 12);
  return NOTE_SHARPS[nextIndex];
}

function transposeChord(chord: string | null | undefined, semitones: number) {
  if (!chord) {
    return chord || "";
  }

  const match = chord.match(/^([A-G])([#b]?)(.*)$/);
  if (!match) {
    return chord;
  }

  const root = `${match[1]}${match[2] || ""}`;
  const rest = match[3] || "";

  return `${transposeRoot(root, semitones)}${rest}`;
}

function getTokenChord(token: SongLineToken, chordMode: ChordMode) {
  const basic = token.chordBasic ?? token.chord ?? null;
  const advanced = token.chordAdv ?? null;

  return chordMode === "adv" ? advanced ?? basic : basic;
}

function isRealChord(value: string | null | undefined) {
  return Boolean(value && String(value).trim() !== "");
}

function findLastChordRaw(song: ParsedSong, chordMode: ChordMode) {
  for (let lineIndex = song.lines.length - 1; lineIndex >= 0; lineIndex -= 1) {
    const line = song.lines[lineIndex];
    if (!("tokens" in line) || !line.tokens) {
      continue;
    }

    for (let tokenIndex = line.tokens.length - 1; tokenIndex >= 0; tokenIndex -= 1) {
      const raw = getTokenChord(line.tokens[tokenIndex], chordMode);
      if (isRealChord(raw)) {
        return raw;
      }
    }
  }

  return null;
}

function chordRoot(chord: string | null | undefined) {
  const match = String(chord || "")
    .trim()
    .match(/^([A-G])([#b]?)/);

  return match ? `${match[1]}${match[2] || ""}` : null;
}

function shouldHighlightFallbackBeat(song: ParsedSong, beatNumber: number) {
  const top = song.timeSigTop;
  const bottom = song.timeSigBottom;

  if (top === 2 && bottom === 4) return beatNumber === 1 || beatNumber === 2;
  if (top === 3 && bottom === 4) return beatNumber === 1;
  if (top === 4 && bottom === 4) return beatNumber === 1 || beatNumber === 3;
  if (top === 6 && bottom === 8) return beatNumber === 1 || beatNumber === 2;

  return beatNumber === 1;
}

function getCountInDisplay(playback: PlaybackConfig, stepIndex: number) {
  const beatNumber = playback.stepToBeatMap[stepIndex] ?? 1;
  const previousBeat = stepIndex > 0 ? playback.stepToBeatMap[stepIndex - 1] : null;
  const isFirstStepOfBeat = stepIndex === 0 || beatNumber !== previousBeat;

  return isFirstStepOfBeat ? String(beatNumber) : "";
}

export function ChordPage({ song }: { song: ParsedSong }) {
  const [transpose, setTranspose] = useState(0);
  const [bpm, setBpm] = useState(song.bpm);
  const [chordMode, setChordMode] = useState<ChordMode>("basic");
  const [isPlaying, setIsPlaying] = useState(false);
  const [phase, setPhase] = useState<"idle" | "countin" | "countin-end" | "play">("idle");
  const [activeStep, setActiveStep] = useState(0);
  const [activeLine, setActiveLine] = useState(0);
  const [beat, setBeat] = useState(1);
  const [countIn, setCountIn] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const phaseRef = useRef<"idle" | "countin" | "countin-end" | "play">("idle");
  const activeStepRef = useRef(0);
  const posRef = useRef(0);
  const lastScrolledLineRef = useRef(-1);
  const songRootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const savedChordMode = window.localStorage.getItem("chordMode");
    if (savedChordMode === "basic" || savedChordMode === "adv") {
      setChordMode(savedChordMode);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("chordMode", chordMode);
  }, [chordMode]);

  const meter = useMemo(() => getMeterConfig(song), [song]);
  const playback = useMemo(() => getPlaybackConfig(song, bpm), [song, bpm]);
  const resolvedStrongCells = useMemo(() => getLayoutStrongCells(song), [song]);
  const strongCellSet = useMemo(() => new Set(resolvedStrongCells), [resolvedStrongCells]);

  const tokenLineIndexes = useMemo(
    () =>
      song.lines
        .map((line, index) => ("tokens" in line && line.tokens ? index : -1))
        .filter((value) => value !== -1),
    [song],
  );

  const initialLine = tokenLineIndexes[0] ?? 0;

  useEffect(() => {
    setActiveLine(initialLine);
  }, [initialLine]);

  const ensureAudioContext = () => {
    if (!audioContextRef.current) {
      const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      audioContextRef.current = new Ctx();
    }

    return audioContextRef.current;
  };

  const playClick = (level: "strong" | "weak" | "normal") => {
    const context = ensureAudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "square";

    const frequency = level === "strong" ? 1200 : level === "weak" ? 900 : 800;
    const amplitude = level === "strong" ? 0.25 : level === "weak" ? 0.12 : 0.18;

    oscillator.frequency.value = frequency;

    const now = context.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(amplitude, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.035);
  };

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopAndResetToStart = () => {
    clearTimer();
    setIsPlaying(false);
    setPhase("idle");
    phaseRef.current = "idle";
    posRef.current = 0;
    activeStepRef.current = 0;
    setActiveStep(0);
    setBeat(1);
    setCountIn(null);
    setActiveLine(initialLine);
    lastScrolledLineRef.current = -1;
  };

  const autoScrollToActiveLine = (lineIndex: number) => {
    if (!isPlaying || lineIndex === lastScrolledLineRef.current) {
      return;
    }

    const target = songRootRef.current?.querySelector<HTMLElement>(`[data-line-idx="${lineIndex}"]`);
    if (!target) {
      return;
    }

    lastScrolledLineRef.current = lineIndex;
    target.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
  };

  useEffect(() => {
    autoScrollToActiveLine(activeLine);
  }, [activeLine, isPlaying]);

  const tick = () => {
    const currentStep = activeStepRef.current;
    const currentBeat = playback.stepToBeatMap[currentStep] ?? 1;
    setBeat(currentBeat);

    if (phaseRef.current === "countin") {
      playClick(playback.kindForStep(currentStep));
      setActiveStep(currentStep);
      setCountIn(getCountInDisplay(playback, currentStep));

      const isLastCountStep = currentStep >= playback.stepsPerBar - 1;
      if (isLastCountStep) {
        setPhase("countin-end");
        phaseRef.current = "countin-end";
        return;
      }

      activeStepRef.current = currentStep + 1;
      return;
    }

    if (phaseRef.current === "countin-end") {
      setCountIn(null);
      setPhase("play");
      phaseRef.current = "play";
      activeStepRef.current = 0;
      setActiveStep(0);
      setBeat(playback.stepToBeatMap[0] ?? 1);
      posRef.current = 0;
      setActiveLine(initialLine);
      playClick(playback.kindForStep(0));
      activeStepRef.current = 1 % playback.stepsPerBar;
      return;
    }

    if (phaseRef.current === "play") {
      playClick(playback.kindForStep(currentStep));
      setActiveStep(currentStep);
      setCountIn(null);

      const isLastStepOfBar = currentStep === playback.stepsPerBar - 1;

      if (isLastStepOfBar) {
        if (posRef.current >= tokenLineIndexes.length - 1) {
          stopAndResetToStart();
          return;
        }

        posRef.current += 1;
        setActiveLine(tokenLineIndexes[posRef.current] ?? initialLine);
      }

      activeStepRef.current = (currentStep + 1) % playback.stepsPerBar;
      setBeat(playback.stepToBeatMap[activeStepRef.current] ?? 1);
    }
  };

  const start = async () => {
    const context = ensureAudioContext();
    if (context.state === "suspended") {
      await context.resume();
    }

    clearTimer();
    setIsPlaying(true);
    setPhase("countin");
    phaseRef.current = "countin";
    posRef.current = 0;
    activeStepRef.current = 0;
    lastScrolledLineRef.current = -1;
    setActiveStep(0);
    setBeat(1);
    setCountIn(null);
    setActiveLine(initialLine);

    tick();
    timerRef.current = window.setInterval(tick, playback.msPerStep);
  };

  const stop = () => {
    stopAndResetToStart();
  };

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    clearTimer();
    timerRef.current = window.setInterval(tick, playback.msPerStep);

    return clearTimer;
  }, [bpm]);

  useEffect(() => {
    return () => {
      clearTimer();
      if (audioContextRef.current) {
        void audioContextRef.current.close();
      }
    };
  }, []);

  const displayedTone = useMemo(() => {
    const toneRaw = song.tone ?? song.key ?? "—";
    const tone = toneRaw !== "—" ? transposeChord(toneRaw, transpose) : "—";
    const lastChordRaw = findLastChordRaw(song, chordMode);
    const lastChord = lastChordRaw ? transposeChord(lastChordRaw, transpose) : "—";

    return {
      tone,
      lastChord,
    };
  }, [song, chordMode, transpose]);

  const videoTone = useMemo(() => {
    const toneRaw = song.tone ?? song.key ?? "C";
    const root = chordRoot(toneRaw);
    const normalizedRoot = root ? FLAT_TO_SHARP[root] || root : "C";
    const baseIndex = NOTE_SHARPS.indexOf(normalizedRoot as (typeof NOTE_SHARPS)[number]);
    const safeIndex = baseIndex === -1 ? 0 : baseIndex;
    const videoIndex = mod(safeIndex + transpose, 12);

    return VIDEO_LIST[videoIndex];
  }, [song, transpose]);

  const notesHint = useMemo(() => {
    if (song.timeSigTop === 2 && song.timeSigBottom === 4) {
      return "Notes: Mỗi ô = 1 nốt đơn (♪)";
    }

    if (song.timeSigTop === 6 && song.timeSigBottom === 8) {
      return "Notes: Mỗi 3 ô = 1 liên ba (1-la-li / 2-la-li)";
    }

    return "Notes: Mỗi ô = 1 nốt đen (♩)";
  }, [song]);

  const groupedContent = useMemo(() => {
    const items: Array<
      | { type: "section"; key: string; section: string }
      | { type: "group"; key: string; lineIndexes: number[] }
    > = [];

    let buffer: number[] = [];

    const flushBuffer = () => {
      if (!buffer.length) return;

      items.push({
        type: "group",
        key: `group-${buffer.join("-")}`,
        lineIndexes: [...buffer],
      });

      buffer = [];
    };

    song.lines.forEach((line, index) => {
      if ("section" in line) {
        flushBuffer();
        items.push({
          type: "section",
          key: `${line.id}-${index}`,
          section: line.section,
        });
        return;
      }

      buffer.push(index);

      if (buffer.length === 3) {
        flushBuffer();
      }
    });

    flushBuffer();

    return items;
  }, [song]);

  const firstSectionKey = useMemo(
    () => groupedContent.find((item) => item.type === "section")?.key ?? null,
    [groupedContent],
  );

  return (
    <main className="page">
      <header>
        <h1 id="songTitle" className="h1">
          {song.title}
        </h1>
        <div className="metaRow">
          <span id="songAuthor" className="metaPill">
            👤 {song.author}
          </span>
          {song.uploaderProfile ? (
            <span className="metaPill">
              Uploaded by{" "}
              {song.uploaderProfile.username ? (
                <a href={`/profiles/${encodeURIComponent(song.uploaderProfile.username)}`}>
                  {song.uploaderProfile.displayName}
                </a>
              ) : (
                song.uploaderProfile.displayName
              )}
            </span>
          ) : null}
          <span id="songStyle" className="metaPill">
            🎼 {song.style}
          </span>
          <span id="songTimeSig" className="metaPill">
            🕒 Nhịp: {meter.timeSigLabel}
          </span>
          <span id="songTempoHint" className="metaPill">
            ✅ Tempo gợi ý: {song.recommendedTempo}
          </span>
          <span id="songBpmNow" className="metaPill">
            ⏱ Đang tập: {bpm} BPM
          </span>
        </div>
      </header>

      <section className="controls">
        <div className="row">
          <button
            id="btnPlay"
            className={`btnPlay${isPlaying ? " is-stop" : ""}`}
            onClick={() => {
              if (isPlaying) {
                stop();
              } else {
                void start();
              }
            }}
            type="button"
          >
            <i className={`fa-solid ${isPlaying ? "fa-stop" : "fa-play"}`}></i>
            <span>{isPlaying ? "Stop" : "Start"}</span>
          </button>
          <div id="beatBox" className="beatBox">
            {Array.from({ length: playback.stepsPerBar }, (_, index) => (
              <span key={index} className={`beatChip${activeStep === index ? " active" : ""}`}>
                {playback.labelForStep(index)}
              </span>
            ))}
          </div>
        </div>

        <div className="row toneRow">
          <div className="bnt-head">
            <button
              id="btnBasic"
              className={`btn1${chordMode === "basic" ? " is-active" : ""}`}
              onClick={() => setChordMode("basic")}
              type="button"
            >
              Cơ bản
            </button>
            <button
              id="btnAdv"
              className={`btn1${chordMode === "adv" ? " is-active" : ""}`}
              onClick={() => setChordMode("adv")}
              type="button"
            >
              Nâng cao
            </button>
          </div>

          <div className="bnt-bottom">
            <button id="btnDown" className="btn1" onClick={() => setTranspose((value) => value - 1)} type="button">
              −
            </button>
            <span id="transposeLabel" className="btn1">
              🎚 Transpose: {transpose}
            </span>
            <button id="btnUp" className="btn1" onClick={() => setTranspose((value) => value + 1)} type="button">
              +
            </button>
            <button id="btnReset" className="btn1" onClick={() => setTranspose(0)} type="button">
              Reset
            </button>
            <span id="toneOut" className="btn1">
              Tone: {displayedTone.tone}
            </span>
          </div>
        </div>

        <div className="sliderRow">
          <label className="label">
            Tempo: <b><span id="bpmLabel">{bpm}</span> BPM</b>
          </label>
          <input
            id="bpmRange"
            className="slider"
            type="range"
            min="40"
            max="220"
            value={bpm}
            onChange={(event) => setBpm(Number(event.target.value))}
          />
          <div className="sliderHint">Tip: tập chậm rồi tăng dần.</div>
        </div>
      </section>

      <section className="songBox">
        <p id="notesHint">{notesHint}</p>
        <div id="songRoot" ref={songRootRef}>
          {groupedContent.map((item) => {
            if (item.type === "section") {
              return (
                <div key={item.key} className="sectionWrapper">
                  <div className="sectionTitle">{item.section}</div>
                  {phase === "countin" && countIn && item.key === firstSectionKey ? (
                    <div className="sectionCountIn">{countIn}</div>
                  ) : null}
                </div>
              );
            }

            return (
              <div key={item.key} className="groupRow">
                {item.lineIndexes.map((lineIndex) => {
                  const line = song.lines[lineIndex];
                  if ("section" in line) {
                    return null;
                  }

                  return (
                    <div key={lineIndex} className="lineWrap" data-line-idx={lineIndex}>
                      <div
                        className="lineGrid"
                        style={{
                          gridTemplateColumns: `repeat(${line.tokens.length}, minmax(44px, 1fr))`,
                          opacity: isPlaying && lineIndex !== activeLine ? 0.9 : 1,
                        }}
                      >
                        {line.tokens.map((token, tokenIndex) => {
                          const rawChord = getTokenChord(token, chordMode);
                          const hasChord = Boolean(rawChord && String(rawChord).trim() !== "");
                          const previousBeat =
                            tokenIndex > 0 ? line.tokens[tokenIndex - 1]?.beatIndex : null;
                          const isFirstCellOfBeat =
                            tokenIndex === 0 || token.beatIndex !== previousBeat;
                          const renderedCellIndex = tokenIndex + 1;
                          const hasLayoutStrongCells = resolvedStrongCells.length > 0;
                          const isStrongCell = hasLayoutStrongCells
                            ? strongCellSet.has(renderedCellIndex)
                            : shouldHighlightFallbackBeat(song, beat);
                          const chordBeatActive =
                            hasLayoutStrongCells
                              ? isPlaying &&
                                phase !== "countin" &&
                                lineIndex === activeLine &&
                                activeStep === tokenIndex &&
                                isStrongCell
                              : isPlaying &&
                                phase !== "countin" &&
                                lineIndex === activeLine &&
                                isFirstCellOfBeat &&
                                token.beatIndex === beat &&
                                isStrongCell;

                          if (isPlaying && phase !== "countin" && lineIndex === activeLine) {
                            console.log("[ChordPage strong cell debug]", {
                              resolvedStrongCells,
                              renderedCellIndex,
                              isStrongCell,
                            });
                          }

                          return (
                            <div
                              key={`chord-${lineIndex}-${tokenIndex}`}
                              className={`gridCell chordCell${chordBeatActive ? " cellActive" : ""}`}
                            >
                              {hasChord ? transposeChord(rawChord, transpose) : "\u00A0"}
                            </div>
                          );
                        })}

                        {line.tokens.map((token, tokenIndex) => (
                          <div key={`lyric-${lineIndex}-${tokenIndex}`} className="gridCell lyricCell">
                            {token.lyric && token.lyric.length ? token.lyric : "\u00A0"}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </section>

      <section className="heroVideo">
        <div className="videoToneBar">
          <button id="videoPrev" className="btn1" onClick={() => setTranspose((value) => value - 1)} type="button">
            -
          </button>
          <span id="videoToneLabel" className="btn1">
            Video tone: {videoTone.tone}
          </span>
          <button id="videoNext" className="btn1" onClick={() => setTranspose((value) => value + 1)} type="button">
            +
          </button>
        </div>

        <div className="videoContainer">
          <iframe
            id="mainVideo"
            className="video"
            src={videoTone.embed}
            title="YouTube video player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
      </section>
    </main>
  );
}
