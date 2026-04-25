(function () {
    const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  
    const CHORD_TYPES = {
      maj: { label: "Major", intervals: [0, 4, 7] },
      min: { label: "Minor", intervals: [0, 3, 7] },
      dim: { label: "Diminished", intervals: [0, 3, 6] },
      aug: { label: "Augmented", intervals: [0, 4, 8] }
    };
  
    const TYPE_KEYS = Object.keys(CHORD_TYPES);
  
    const listenBtn = document.getElementById("chordListenBtn");
    const showBtn = document.getElementById("chordShowBtn");
    const hideBtn = document.getElementById("chordHideBtn");
    const prevBtn = document.getElementById("chordPrevBtn");
    const nextBtn = document.getElementById("chordNextBtn");
    const resetBtn = document.getElementById("chordResetBtn");
    const chordDisplay = document.getElementById("chordDisplay");
    const guessArea = document.getElementById("chordGuessArea");
    const scoreHint = document.getElementById("chordScoreHint");
  
    if (
      !listenBtn || !showBtn || !hideBtn ||
      !prevBtn || !nextBtn || !resetBtn ||
      !chordDisplay || !guessArea || !scoreHint
    ) {
      return;
    }
  
    let audioCtx = null;
  
    let currentQuestion = null;
    let history = [];
    let historyIndex = -1;
  
    let correct = 0;
    let total = 0;
  
    function ensureAudio() {
      if (!audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        audioCtx = new Ctx();
      }
      return audioCtx;
    }
  
    function midiToFreq(midi) {
      return 440 * Math.pow(2, (midi - 69) / 12);
    }
  
    function noteIndex(name) {
      return NOTES.indexOf(name);
    }
  
    function randomInt(max) {
      return Math.floor(Math.random() * max);
    }
  
    function randomRoot() {
      return NOTES[randomInt(NOTES.length)];
    }
  
    function randomTypeKey() {
      return TYPE_KEYS[randomInt(TYPE_KEYS.length)];
    }
  
    function makeQuestion() {
      const root = randomRoot();
      const typeKey = randomTypeKey();
      return { root, typeKey };
    }
  
    function sameQuestion(a, b) {
      return !!a && !!b && a.root === b.root && a.typeKey === b.typeKey;
    }
  
    function setDisplayHidden() {
      chordDisplay.textContent = "???";
    }
  
    function setDisplayShown() {
      if (!currentQuestion) return;
      const label = CHORD_TYPES[currentQuestion.typeKey].label;
      chordDisplay.textContent = `${currentQuestion.root} ${label}`;
    }
  
    function updateScore() {
      scoreHint.textContent = `Score: ${correct} / ${total}`;
    }
  
    function clearOptionStates() {
      guessArea.querySelectorAll(".chordOption").forEach((btn) => {
        btn.classList.remove("correct", "wrong", "answer");
      });
    }
  
    function highlightAnswer() {
      if (!currentQuestion) return;
      const answerBtn = guessArea.querySelector(`[data-type="${currentQuestion.typeKey}"]`);
      if (answerBtn) answerBtn.classList.add("answer");
    }
  
    function playChord(question) {
      if (!question) return;
  
      const ctx = ensureAudio();
      const now = ctx.currentTime;
      const rootMidi = 60 + noteIndex(question.root); // C4 ~ B4
      const intervals = CHORD_TYPES[question.typeKey].intervals;
  
      intervals.forEach((interval) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
  
        osc.type = "triangle";
        osc.frequency.value = midiToFreq(rootMidi + interval);
  
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
  
        osc.connect(gain);
        gain.connect(ctx.destination);
  
        osc.start(now);
        osc.stop(now + 1.25);
      });
    }
  
    function setQuestion(question, pushHistory = true) {
      currentQuestion = question;
      setDisplayHidden();
      clearOptionStates();
  
      if (pushHistory) {
        history = history.slice(0, historyIndex + 1);
        history.push(question);
        historyIndex = history.length - 1;
      }
    }
  
    function nextRandomQuestion() {
      let q;
      do {
        q = makeQuestion();
      } while (sameQuestion(q, currentQuestion));
      setQuestion(q, true);
    }
  
    function resetTrainer() {
      correct = 0;
      total = 0;
      history = [];
      historyIndex = -1;
      updateScore();
      nextRandomQuestion();
    }
  
    function handleGuess(typeKey, btn) {
      if (!currentQuestion) return;
  
      total++;
      clearOptionStates();
  
      if (typeKey === currentQuestion.typeKey) {
        correct++;
        btn.classList.add("correct");
        updateScore();
  
        setTimeout(() => {
          nextRandomQuestion();
          playChord(currentQuestion);
        }, 500);
      } else {
        btn.classList.add("wrong");
        highlightAnswer();
        updateScore();
      }
    }
  
    function renderOptions() {
      guessArea.innerHTML = "";
  
      TYPE_KEYS.forEach((typeKey) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn2 btnGhost chordOption";
        btn.dataset.type = typeKey;
        btn.textContent = CHORD_TYPES[typeKey].label;
        btn.addEventListener("click", () => handleGuess(typeKey, btn));
        guessArea.appendChild(btn);
      });
    }
  
    listenBtn.addEventListener("click", () => {
      playChord(currentQuestion);
    });
  
    showBtn.addEventListener("click", () => {
      setDisplayShown();
      clearOptionStates();
      highlightAnswer();
    });
  
    hideBtn.addEventListener("click", () => {
      setDisplayHidden();
      clearOptionStates();
    });
  
    nextBtn.addEventListener("click", () => {
      nextRandomQuestion();
    });
  
    prevBtn.addEventListener("click", () => {
      if (historyIndex > 0) {
        historyIndex--;
        currentQuestion = history[historyIndex];
        setDisplayHidden();
        clearOptionStates();
      }
    });
  
    resetBtn.addEventListener("click", resetTrainer);
  
    renderOptions();
    resetTrainer();
  })();