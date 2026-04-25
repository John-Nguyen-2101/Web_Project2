"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
const WHITE_NOTES = ["C", "D", "E", "F", "G", "A", "B"] as const;
const BLACK_NOTES = ["C#", "D#", "F#", "G#", "A#"] as const;

type TimeSignature = "2/4" | "3/4" | "4/4" | "6/8";
type AccentMode = "classic" | "soft" | "none";
type NoteName = (typeof NOTE_NAMES)[number];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function noteToFrequency(note: NoteName) {
  const noteIndex = NOTE_NAMES.indexOf(note);
  const midi = 60 + noteIndex;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function getMetronomeConfig(signature: TimeSignature, bpm: number) {
  if (signature === "6/8") {
    return {
      sigPill: "6/8",
      mode: "Dotted-quarter beats (2)",
      subdivision: "Triplet subdivision (3/beat)",
      stepsPerBar: 6,
      msPerStep: (60000 / bpm) / 2,
      labelForStep: (index: number) => ["1", "tri", "let", "2", "tri", "let"][index] || String(index + 1),
      kindForStep: (index: number, accentMode: AccentMode) => {
        if (accentMode === "none") return "normal" as const;
        if (accentMode === "soft") return index === 0 ? ("strong" as const) : "normal";
        if (index === 0) return "strong" as const;
        if (index === 3) return "weak" as const;
        return "normal" as const;
      },
      tempoNote: "BPM đang tính theo ♩. (dotted quarter) cho 6/8",
    };
  }

  const top = Number(signature.split("/")[0]) || 4;

  return {
    sigPill: signature,
    mode: "Quarter notes",
    subdivision: "—",
    stepsPerBar: top,
    msPerStep: 60000 / bpm,
    labelForStep: (index: number) => String(index + 1),
    kindForStep: (index: number, accentMode: AccentMode) => {
      if (accentMode === "none") return "normal" as const;
      if (accentMode === "soft") return index === 0 ? ("weak" as const) : "normal";
      return index === 0 ? ("strong" as const) : "normal";
    },
    tempoNote: "",
  };
}

function useMetronome() {
  const [timeSignature, setTimeSignature] = useState<TimeSignature>("4/4");
  const [accentMode, setAccentMode] = useState<AccentMode>("classic");
  const [bpm, setBpm] = useState(80);
  const [volume, setVolume] = useState(70);
  const [isPlaying, setIsPlaying] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const timerRef = useRef<number | null>(null);
  const stepIndexRef = useRef(0);

  const config = useMemo(
    () => getMetronomeConfig(timeSignature, bpm),
    [timeSignature, bpm],
  );

  const ensureAudio = () => {
    if (!audioContextRef.current) {
      const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      const context = new Ctx();
      const gain = context.createGain();
      gain.gain.value = volume / 100;
      gain.connect(context.destination);

      audioContextRef.current = context;
      masterGainRef.current = gain;
    }

    return audioContextRef.current;
  };

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const click = (kind: "strong" | "weak" | "normal") => {
    const context = ensureAudio();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    const frequency = kind === "strong" ? 1300 : kind === "weak" ? 950 : 820;
    const amplitude = kind === "strong" ? 0.28 : kind === "weak" ? 0.16 : 0.2;

    oscillator.type = "square";
    oscillator.frequency.value = frequency;

    const now = context.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(amplitude, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

    oscillator.connect(gain);
    gain.connect(masterGainRef.current!);

    oscillator.start(now);
    oscillator.stop(now + 0.04);
  };

  const tick = () => {
    const currentIndex = stepIndexRef.current;
    const kind = config.kindForStep(currentIndex, accentMode);
    click(kind);
    setStepIndex(currentIndex);

    const nextIndex = (currentIndex + 1) % config.stepsPerBar;
    stepIndexRef.current = nextIndex;
  };

  const start = async () => {
    const context = ensureAudio();
    if (context.state === "suspended") {
      await context.resume();
    }

    clearTimer();
    stepIndexRef.current = 0;
    setStepIndex(0);
    setIsPlaying(true);
    tick();
    timerRef.current = window.setInterval(tick, config.msPerStep);
  };

  const stop = () => {
    clearTimer();
    stepIndexRef.current = 0;
    setStepIndex(0);
    setIsPlaying(false);
  };

  useEffect(() => {
    if (masterGainRef.current && audioContextRef.current) {
      const context = audioContextRef.current;
      const now = context.currentTime;
      masterGainRef.current.gain.cancelScheduledValues(now);
      masterGainRef.current.gain.setTargetAtTime(volume / 100, now, 0.015);
    }
  }, [volume]);

  useEffect(() => {
    if (!isPlaying) {
      stepIndexRef.current = 0;
      setStepIndex(0);
      return;
    }

    clearTimer();
    timerRef.current = window.setInterval(tick, config.msPerStep);

    return clearTimer;
  }, [isPlaying, config.msPerStep, accentMode, timeSignature]);

  useEffect(() => {
    return () => {
      clearTimer();
      if (audioContextRef.current) {
        void audioContextRef.current.close();
      }
    };
  }, []);

  return {
    timeSignature,
    setTimeSignature,
    accentMode,
    setAccentMode,
    bpm,
    setBpm,
    volume,
    setVolume,
    isPlaying,
    start,
    stop,
    stepIndex,
    config,
  };
}

function MetronomeCard() {
  const {
    timeSignature,
    setTimeSignature,
    accentMode,
    setAccentMode,
    bpm,
    setBpm,
    volume,
    setVolume,
    isPlaying,
    start,
    stop,
    stepIndex,
    config,
  } = useMetronome();

  return (
    <section className="toolCard">
      <div className="row rowWrap">
        <div className="control">
          <label className="label">Time Signature</label>
          <select
            className="select"
            value={timeSignature}
            onChange={(event) => setTimeSignature(event.target.value as TimeSignature)}
          >
            <option value="2/4">2/4</option>
            <option value="3/4">3/4</option>
            <option value="4/4">4/4</option>
            <option value="6/8">6/8</option>
          </select>
        </div>

        <div className="control">
          <label className="label">Accent</label>
          <select
            className="select"
            value={accentMode}
            onChange={(event) => setAccentMode(event.target.value as AccentMode)}
          >
            <option value="classic">Mạnh ở phách 1</option>
            <option value="soft">Mềm hơn</option>
            <option value="none">Không accent</option>
          </select>
        </div>

        <div className="control">
          <label className="label">Volume</label>
          <input
            className="range"
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(event) => setVolume(clamp(Number(event.target.value), 0, 100))}
          />
          <div className="hint">{volume}%</div>
        </div>
      </div>

      <div className="row rowWrap">
        <div className="control wide">
          <label className="label">
            Tempo: <b>{bpm} BPM</b>
            <span className="smallNote">{config.tempoNote ? ` • ${config.tempoNote}` : ""}</span>
          </label>
          <input
            className="range"
            type="range"
            min="30"
            max="240"
            value={bpm}
            onChange={(event) => setBpm(clamp(Number(event.target.value), 30, 240))}
          />
          <div className="hint">Tip: tập chậm - tăng dần.</div>
        </div>
      </div>

      <div className="row rowWrap actions">
        <button
          className={`btn2 ${isPlaying ? "btnDanger" : "btnPrimary"}`}
          onClick={() => {
            if (isPlaying) {
              stop();
            } else {
              void start();
            }
          }}
          type="button"
        >
          <i className={`fa-solid ${isPlaying ? "fa-stop" : "fa-play"}`}></i>{" "}
          {isPlaying ? "Stop" : "Start"}
        </button>

        <div className="status">
          <div className="statusLine">
            <span className="pill">{config.sigPill}</span>
            <span className="pill">{config.mode}</span>
            <span className="pill">{config.subdivision}</span>
          </div>
          <div className="chips">
            {Array.from({ length: config.stepsPerBar }, (_, index) => (
              <div
                key={`${timeSignature}-${index}`}
                className={`chipBeat${index === stepIndex ? " active" : ""}`}
              >
                {config.labelForStep(index)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function NoteTrainerCard() {
  const [currentNote, setCurrentNote] = useState<NoteName>("C");
  const [history, setHistory] = useState<NoteName[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [correct, setCorrect] = useState(0);
  const [total, setTotal] = useState(0);
  const [isAnswerShown, setIsAnswerShown] = useState(false);
  const [selectedNote, setSelectedNote] = useState<NoteName | null>(null);
  const [guessResult, setGuessResult] = useState<"correct" | "wrong" | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const ensureAudio = () => {
    if (!audioContextRef.current) {
      const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      audioContextRef.current = new Ctx();
    }

    return audioContextRef.current;
  };

  const playNote = async (note: NoteName) => {
    const context = ensureAudio();
    if (context.state === "suspended") {
      await context.resume();
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.value = noteToFrequency(note);

    const now = context.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.28, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1);

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start(now);
    oscillator.stop(now + 1);
  };

  const getRandomNote = (exclude?: NoteName) => {
    let next = NOTE_NAMES[Math.floor(Math.random() * NOTE_NAMES.length)];

    while (NOTE_NAMES.length > 1 && next === exclude) {
      next = NOTE_NAMES[Math.floor(Math.random() * NOTE_NAMES.length)];
    }

    return next;
  };

  const setQuestion = (note: NoteName, pushHistory = true) => {
    setCurrentNote(note);
    setIsAnswerShown(false);
    setSelectedNote(null);
    setGuessResult(null);

    if (pushHistory) {
      setHistory((currentHistory) => {
        const nextHistory = currentHistory.slice(0, historyIndex + 1);
        nextHistory.push(note);
        setHistoryIndex(nextHistory.length - 1);
        return nextHistory;
      });
    }
  };

  const setNewNote = () => {
    const nextNote = getRandomNote(currentNote);
    setQuestion(nextNote, true);
    window.setTimeout(() => {
      void playNote(nextNote);
    }, 200);
  };

  const resetTrainer = () => {
    setCorrect(0);
    setTotal(0);
    setHistory([]);
    setHistoryIndex(-1);

    const nextNote = getRandomNote();
    setCurrentNote(nextNote);
    setIsAnswerShown(false);
    setSelectedNote(null);
    setGuessResult(null);
    setHistory([nextNote]);
    setHistoryIndex(0);

    window.setTimeout(() => {
      void playNote(nextNote);
    }, 200);
  };

  useEffect(() => {
    resetTrainer();

    return () => {
      if (audioContextRef.current) {
        void audioContextRef.current.close();
      }
    };
  }, []);

  const handleGuess = (note: NoteName) => {
    setTotal((value) => value + 1);
    setSelectedNote(note);
    setIsAnswerShown(false);

    if (note === currentNote) {
      setCorrect((value) => value + 1);
      setGuessResult("correct");
      window.setTimeout(() => {
        setNewNote();
      }, 500);
      return;
    }

    setGuessResult("wrong");
  };

  const goToPrevious = () => {
    if (historyIndex <= 0) {
      return;
    }

    const nextIndex = historyIndex - 1;
    const previousNote = history[nextIndex];

    setHistoryIndex(nextIndex);
    setCurrentNote(previousNote);
    setIsAnswerShown(false);
    setSelectedNote(null);
    setGuessResult(null);
  };

  const blackKeyOffsets: Record<(typeof BLACK_NOTES)[number], number> = {
    "C#": 0,
    "D#": 1,
    "F#": 3,
    "G#": 4,
    "A#": 5,
  };

  return (
    <section className="toolCard">
      <h2 className="h2">Note Ear Training</h2>

      <div className="row actions">
        <button className="btn2 btnPrimary" onClick={() => void playNote(currentNote)} type="button">
          🔊 Listen
        </button>
        <button
          className="btn2 btnGhost"
          onClick={() => {
            setIsAnswerShown(true);
            setSelectedNote(null);
            setGuessResult(null);
          }}
          type="button"
        >
          Show
        </button>
        <button
          className="btn2 btnGhost"
          onClick={() => {
            setIsAnswerShown(false);
            setSelectedNote(null);
            setGuessResult(null);
          }}
          type="button"
        >
          Hide
        </button>
      </div>

      <div className="row" style={{ marginTop: "15px" }}>
        <span className="pill" id="noteDisplay">
          {isAnswerShown ? currentNote : "???"}
        </span>
      </div>

      <div className="row actions" style={{ marginTop: "15px" }}>
        <button className="btn2 btnGhost" onClick={goToPrevious} type="button">
          ⬅ Prev
        </button>
        <button className="btn2 btnGhost" onClick={setNewNote} type="button">
          Next ➡
        </button>
        <button className="btn2 btnGhost" onClick={resetTrainer} type="button">
          Reset
        </button>
      </div>

      <div className="row" style={{ marginTop: "20px" }}>
        <div id="guessArea">
          <div className="pianoInner" style={{ width: `${WHITE_NOTES.length * 64}px` }}>
            {WHITE_NOTES.map((note, index) => {
              const isSelected = selectedNote === note;
              const isCorrect = guessResult === "correct" && selectedNote === note;
              const isWrong = guessResult === "wrong" && selectedNote === note;
              const isAnswer = (guessResult === "wrong" || isAnswerShown) && currentNote === note;

              return (
                <button
                  key={note}
                  type="button"
                  className={[
                    "pianoKey",
                    "white",
                    isSelected ? "selected" : "",
                    isCorrect ? "correct" : "",
                    isWrong ? "wrong" : "",
                    isAnswer ? "answer" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{ left: `${index * 64}px`, width: "64px" }}
                  onClick={() => handleGuess(note)}
                >
                  <span>{note}</span>
                </button>
              );
            })}

            {BLACK_NOTES.map((note) => {
              const isSelected = selectedNote === note;
              const isCorrect = guessResult === "correct" && selectedNote === note;
              const isWrong = guessResult === "wrong" && selectedNote === note;
              const isAnswer = (guessResult === "wrong" || isAnswerShown) && currentNote === note;

              return (
                <button
                  key={note}
                  type="button"
                  className={[
                    "pianoKey",
                    "black",
                    isSelected ? "selected" : "",
                    isCorrect ? "correct" : "",
                    isWrong ? "wrong" : "",
                    isAnswer ? "answer" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={{
                    left: `${(blackKeyOffsets[note] + 1) * 64 - 20}px`,
                    width: "40px",
                  }}
                  onClick={() => handleGuess(note)}
                >
                  <span>{note}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="hint" id="scoreHint">
        Score: {correct} / {total}
      </div>
    </section>
  );
}

export function ToolsPage() {
  return (
    <main className="page">
      <header className="toolHeader">
        <h1 className="h1">Metronome</h1>
        <p className="toolSub">
          Hỗ trợ nhịp <b>2/4, 3/4, 4/4</b> và <b>6/8</b>.
        </p>
      </header>

      <MetronomeCard />

      <section className="toolCard">
        <h2 className="h2">Cách đếm</h2>
        <ul className="ul">
          <li>
            <b>2/4</b>: 1 - 2
          </li>
          <li>
            <b>3/4</b>: 1 - 2 - 3
          </li>
          <li>
            <b>4/4</b>: 1 - 2 - 3 - 4
          </li>
          <li>
            <b>6/8</b> (đếm 2 phách): <b>1-trip-let | 2-trip-let</b>
            <br />
            <span className="smallNote">
              Tổng 6 click mỗi bar: (1, trip, let, 2, trip, let)
            </span>
          </li>
        </ul>
      </section>

      <NoteTrainerCard />
    </main>
  );
}
