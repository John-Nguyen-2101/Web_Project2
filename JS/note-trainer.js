(function () {
  const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const WHITE_NOTES = ["C", "D", "E", "F", "G", "A", "B"];
  const BLACK_NOTES = ["C#", "D#", "F#", "G#", "A#"];

  const listenBtn = document.getElementById("listenBtn");
  const showBtn = document.getElementById("showBtn");
  const hideBtn = document.getElementById("hideBtn");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const resetBtn = document.getElementById("resetBtn");
  const noteDisplay = document.getElementById("noteDisplay");
  const guessArea = document.getElementById("guessArea");
  const scoreHint = document.getElementById("scoreHint");

  let audioCtx = null;

  let currentNote = null;
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

  function noteToFreq(note) {
    const index = NOTES.indexOf(note);
    const midi = 60 + index; // C4 = 60
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function playNote(note) {
    const ctx = ensureAudio();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.value = noteToFreq(note);

    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.28, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 1);
  }

  function randomNote() {
    let next;
    do {
      next = NOTES[Math.floor(Math.random() * NOTES.length)];
    } while (next === currentNote);
    return next;
  }

  function clearKeyStates() {
    const keys = guessArea.querySelectorAll(".pianoKey");
    keys.forEach((key) => {
      key.classList.remove("selected", "correct", "wrong", "answer");
    });
  }

  function updateScore() {
    scoreHint.textContent = `Score: ${correct} / ${total}`;
  }

  function setDisplayedHidden() {
    noteDisplay.textContent = "???";
  }

  function setDisplayedShown() {
    noteDisplay.textContent = currentNote;
  }

  function setCurrentNote(note, pushHistory = true) {
    currentNote = note;
    setDisplayedHidden();
    clearKeyStates();

    if (pushHistory) {
      history = history.slice(0, historyIndex + 1);
      history.push(note);
      historyIndex = history.length - 1;
    }
  }

  function setNewNote(){
    const note = randomNote();
    setCurrentNote(note, true);
  
    setTimeout(()=>{
      playNote(note);
    },200);
  }

  function resetTrainer() {
    correct = 0;
    total = 0;
    history = [];
    historyIndex = -1;
    updateScore();
    setNewNote();
  }

  function highlightAnswer() {
    const answerKey = guessArea.querySelector(`.pianoKey[data-note="${currentNote}"]`);
    if (answerKey) answerKey.classList.add("answer");
  }

  function handleGuess(note, btn) {
    total++;
    clearKeyStates();
    btn.classList.add("selected");
  
    if (note === currentNote) {
      correct++;
      btn.classList.add("correct");
  
      updateScore();
  
      // transfer to new row 0.5s
      setTimeout(() => {
        setNewNote();
      }, 500);
  
    } else {
      btn.classList.add("wrong");
      highlightAnswer();
      updateScore();
    }
  }

  function createWhiteKey(note, left, width) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pianoKey white";
    btn.dataset.note = note;
    btn.style.left = `${left}px`;
    btn.style.width = `${width}px`;
    btn.innerHTML = `<span>${note}</span>`;
    btn.addEventListener("click", () => handleGuess(note, btn));
    return btn;
  }

  function createBlackKey(note, left, width) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pianoKey black";
    btn.dataset.note = note;
    btn.style.left = `${left}px`;
    btn.style.width = `${width}px`;
    btn.innerHTML = `<span>${note}</span>`;
    btn.addEventListener("click", () => handleGuess(note, btn));
    return btn;
  }

  function renderGuessButtons() {
    if (!guessArea) return;

    guessArea.innerHTML = `<div class="pianoInner"></div>`;
    const pianoInner = guessArea.querySelector(".pianoInner");

    const isMobile = window.innerWidth <= 768;
    const whiteWidth = isMobile ? 50 : 64;
    const blackWidth = isMobile ? 30 : 40;

    const whiteOrder = ["C", "D", "E", "F", "G", "A", "B"];
    const blackPositionMap = {
      "C#": 0,
      "D#": 1,
      "F#": 3,
      "G#": 4,
      "A#": 5,
    };

    whiteOrder.forEach((note, index) => {
      const left = index * whiteWidth;
      const key = createWhiteKey(note, left, whiteWidth);
      pianoInner.appendChild(key);
    });

    BLACK_NOTES.forEach((note) => {
      const idx = blackPositionMap[note];
      const left = (idx + 1) * whiteWidth - blackWidth / 2;
      const key = createBlackKey(note, left, blackWidth);
      pianoInner.appendChild(key);
    });

    pianoInner.style.width = `${whiteOrder.length * whiteWidth}px`;
  }

  listenBtn.onclick = () => playNote(currentNote);

  showBtn.onclick = () => {
    setDisplayedShown();
    clearKeyStates();
    highlightAnswer();
  };

  hideBtn.onclick = () => {
    setDisplayedHidden();
    clearKeyStates();
  };

  nextBtn.onclick = () => {
    setNewNote();
  };

  prevBtn.onclick = () => {
    if (historyIndex > 0) {
      historyIndex--;
      currentNote = history[historyIndex];
      setDisplayedHidden();
      clearKeyStates();
    }
  };

  resetBtn.onclick = resetTrainer;

  renderGuessButtons();
  window.addEventListener("resize", renderGuessButtons);
  resetTrainer();
})();