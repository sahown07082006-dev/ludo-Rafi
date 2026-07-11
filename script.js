/*************************************************************
 * 1. COORDINATE MAPS & CONFIGURATION
 *************************************************************/
const TRACK = [
  [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
  [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0],
  [7, 0],
  [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
  [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6],
  [14, 7],
  [14, 8], [13, 8], [12, 8], [11, 8], [10, 8], [9, 8],
  [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14],
  [7, 14],
  [6, 14], [6, 13], [6, 12], [6, 11], [6, 10], [6, 9],
  [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  [0, 7]
];

const PLAYER_CONFIGS = {
  red: {
    startIndex: 1,
    endIndex: 0,
    homePath: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
    goal: [6, 7],
    yard: [[1.5, 1.5], [3.5, 1.5], [1.5, 3.5], [3.5, 3.5]],
    color: 'var(--color-red)',
    glow: 'var(--glow-red)',
    name: 'RED'
  },
  green: {
    startIndex: 14,
    endIndex: 13,
    homePath: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
    goal: [7, 6],
    yard: [[10.5, 1.5], [12.5, 1.5], [10.5, 3.5], [12.5, 3.5]],
    color: 'var(--color-green)',
    glow: 'var(--glow-green)',
    name: 'GREEN'
  },
  yellow: {
    startIndex: 27,
    endIndex: 26,
    homePath: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
    goal: [8, 7],
    yard: [[10.5, 10.5], [12.5, 10.5], [10.5, 12.5], [12.5, 12.5]],
    color: 'var(--color-yellow)',
    glow: 'var(--glow-yellow)',
    name: 'YELLOW'
  },
  blue: {
    startIndex: 40,
    endIndex: 39,
    homePath: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
    goal: [7, 8],
    yard: [[1.5, 10.5], [3.5, 10.5], [1.5, 12.5], [3.5, 12.5]],
    color: 'var(--color-blue)',
    glow: 'var(--glow-blue)',
    name: 'BLUE'
  }
};

const SAFE_ZONES = [
  [1, 6], [8, 1], [13, 8], [6, 13],
  [2, 8], [6, 2], [12, 6], [8, 12]
];

/*************************************************************
 * 2. AUDIO SYNTHESIZER ENGINE — PREMIUM / REALISTIC EDITION
 *
 * এই ফাইলটি পুরনো "2. AUDIO SYNTHESIZER ENGINE" সেকশনের সম্পূর্ণ
 * প্রতিস্থাপন। বাইরের কল-সিগনেচার অপরিবর্তিত:
 *   initAudio(), playSound(type), triggerHaptic(type)
 * তাই কোডবেসের বাকি অংশে কিছু বদলাতে হবে না।
 *
 * নতুন যা যোগ হয়েছে:
 *   • Master Reverb Bus — প্রতিটি শব্দে সূক্ষ্ম রুম-অ্যাম্বিয়েন্স
 *   • Noise-based texture — বাস্তবসম্মত "খড়খড়" ও "থাপ্পড়" শব্দ
 *   • Per-play humanized variation (pitch/timing/pan jitter)
 *   • Stereo panning ও filter shaping দিয়ে প্রিমিয়াম টোন
 *************************************************************/

let audioCtx = null;
let masterGain = null;
let masterCompressor = null;
let masterBus = null;
let noiseBuffer = null;

/*=============================================================
 * 2.0 CORE AUDIO GRAPH SETUP (একবারই তৈরি হয়)
 *============================================================*/
function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  // মাস্টার আউটপুট
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 1.0;
  masterGain.connect(audioCtx.destination);

  // মাস্টার কম্প্রেসার (প্রিমিয়াম লাউডনেস কন্ট্রোল)
  masterCompressor = audioCtx.createDynamicsCompressor();
  masterCompressor.threshold.setValueAtTime(-8, audioCtx.currentTime);
  masterCompressor.knee.setValueAtTime(18, audioCtx.currentTime);
  masterCompressor.ratio.setValueAtTime(10, audioCtx.currentTime);
  masterCompressor.attack.setValueAtTime(0.002, audioCtx.currentTime);
  masterCompressor.release.setValueAtTime(0.15, audioCtx.currentTime);
  masterCompressor.connect(masterGain);

  // মাস্টার রিভার্ব সেন্ড (রুম-অ্যাম্বিয়েন্স — শব্দকে "flat" শোনানো থেকে বাঁচায়)
  const reverbSend = audioCtx.createGain();
  reverbSend.gain.value = 0.16;
  const reverbNode = audioCtx.createConvolver();
  reverbNode.buffer = _buildImpulseResponse(1.4, 2.4);
  reverbSend.connect(reverbNode);
  reverbNode.connect(masterGain);

  // সব ভয়েস এই বাসেই কানেক্ট হবে, যা ড্রাই (কম্প্রেসার) ও ওয়েট (রিভার্ব) দুই পথেই যায়
  masterBus = audioCtx.createGain();
  masterBus.gain.value = 1.0;
  masterBus.connect(masterCompressor);
  masterBus.connect(reverbSend);

  noiseBuffer = _buildNoiseBuffer();
}

/** প্রোসিডুরালি একটি রিভার্ব ইমপালস রেসপন্স তৈরি করে (এক্সটার্নাল ফাইলের দরকার নেই) */
function _buildImpulseResponse(duration, decay) {
  const sampleRate = audioCtx.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * duration));
  const impulse = audioCtx.createBuffer(2, length, sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

/** সাদা নয়েজ বাফার তৈরি করে — খড়খড়/ইমপ্যাক্ট টেক্সচারের ভিত্তি */
function _buildNoiseBuffer() {
  const bufferSize = audioCtx.sampleRate * 1;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function _rand(min, max) {
  return min + Math.random() * (max - min);
}

/*=============================================================
 * 2.1 REUSABLE VOICE HELPERS
 *============================================================*/

/** একটি অসিলেটর-ভিত্তিক টোন শিডিউল করে, ঐচ্ছিক ফিল্টার ও প্যানসহ */
function _scheduleTone({
  waveType = 'triangle', freqStart, freqEnd, duration,
  gainStart = 0.8, gainEnd = 0.01, startTime = 0, pan = 0,
  filterType = null, filterFreq = null
}) {
  const now = audioCtx.currentTime + startTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = waveType;
  osc.frequency.setValueAtTime(Math.max(freqStart, 1), now);
  if (freqEnd !== undefined && freqEnd !== freqStart) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), now + duration);
  }

  gain.gain.setValueAtTime(gainStart, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(gainEnd, 0.0001), now + duration);
  osc.connect(gain);

  let outputNode = gain;
  if (filterType) {
    const filter = audioCtx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    gain.connect(filter);
    outputNode = filter;
  }

  if (pan !== 0 && audioCtx.createStereoPanner) {
    const panner = audioCtx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    outputNode.connect(panner);
    outputNode = panner;
  }

  outputNode.connect(masterBus);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

/** ফিল্টারড নয়েজ বার্স্ট শিডিউল করে — বাস্তবসম্মত ইমপ্যাক্ট/টেক্সচারের জন্য */
function _scheduleNoiseBurst({
  duration, filterType = 'bandpass', filterFreq = 1000, Q = 1,
  gainStart = 0.8, gainEnd = 0.01, startTime = 0, pan = 0
}) {
  const now = audioCtx.currentTime + startTime;
  const src = audioCtx.createBufferSource();
  src.buffer = noiseBuffer;

  const filter = audioCtx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(filterFreq, now);
  filter.Q.value = Q;

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(gainStart, now);
  gain.gain.exponentialRampToValueAtTime(Math.max(gainEnd, 0.0001), now + duration);

  src.connect(filter);
  filter.connect(gain);

  let outputNode = gain;
  if (pan !== 0 && audioCtx.createStereoPanner) {
    const panner = audioCtx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    outputNode.connect(panner);
    outputNode = panner;
  }

  outputNode.connect(masterBus);
  src.start(now);
  src.stop(now + duration + 0.02);
}

/*=============================================================
 * 2.2 SOUND DISPATCHER
 *============================================================*/
function playSound(type) {
  const soundToggle = document.getElementById('sound-toggle');
  const isSoundOn = soundToggle ? soundToggle.checked : true;
  if (!isSoundOn) return;
  initAudio();
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  if (type === 'hop') {
    // মানবিক বৈচিত্র্য: প্রতিবার সামান্য ভিন্ন পিচ ও প্যান
    const pitchJitter = _rand(-15, 15);
    const pan = _rand(-0.15, 0.15);

    // লেয়ার ১: উষ্ণ রেজোন্যান্ট বডি (lowpass দিয়ে গোলগাল টোন)
    _scheduleTone({
      waveType: 'triangle', freqStart: 320 + pitchJitter, freqEnd: 640 + pitchJitter,
      duration: 0.16, gainStart: 0.85, gainEnd: 0.01, pan,
      filterType: 'lowpass', filterFreq: 2200
    });

    // লেয়ার ২: তীক্ষ্ণ ট্যাকটাইল পপ
    _scheduleTone({
      waveType: 'triangle', freqStart: 1400 + _rand(-60, 60), freqEnd: 600,
      duration: 0.035, gainStart: 0.92, gainEnd: 0.01, pan
    });

  } else if (type === 'roll') {
    // আন্ডারলেয়ার: টেবিলে গড়িয়ে যাওয়ার ধারাবাহিক টেক্সচার (রেজোন্যান্ট নয়েজ সুইপ)
    const rollDuration = 0.32;
    const now = audioCtx.currentTime;
    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 3;
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(1800, now + rollDuration);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.22, now);
    g.gain.exponentialRampToValueAtTime(0.01, now + rollDuration);
    src.connect(filter);
    filter.connect(g);
    g.connect(masterBus);
    src.start(now);
    src.stop(now + rollDuration + 0.02);

    // মাইক্রো-ইমপ্যাক্ট ক্লিক (অসম বিরতিতে — বাস্তব ডাইসের খড়খড় শব্দ)
    let t = 0;
    for (let i = 0; i < 6; i++) {
      t += _rand(0.03, 0.06);
      const freq = _rand(500, 1300);
      const pan = _rand(-0.3, 0.3);
      _scheduleNoiseBurst({
        duration: 0.03, filterType: 'bandpass', filterFreq: freq, Q: 6,
        gainStart: _rand(0.5, 0.85), gainEnd: 0.01, startTime: t, pan
      });
      _scheduleTone({
        waveType: 'triangle', freqStart: freq * 0.6, freqEnd: freq * 0.3,
        duration: 0.03, gainStart: 0.4, gainEnd: 0.01, startTime: t, pan
      });
    }

  } else if (type === 'capture') {
    const pan = _rand(-0.1, 0.1);

    // ইমপ্যাক্ট ট্রানজিয়েন্ট (আঘাতের বাস্তব "থাপ্পড়" অনুভূতি)
    _scheduleNoiseBurst({
      duration: 0.05, filterType: 'highpass', filterFreq: 1800, Q: 0.7,
      gainStart: 0.9, gainEnd: 0.01, pan
    });

    // প্রধান ক্র্যাশ সুইপ (lowpass দিয়ে বাস্তবসম্মত ডার্কেনিং)
    _scheduleTone({
      waveType: 'sawtooth', freqStart: 750, freqEnd: 90, duration: 0.45,
      gainStart: 0.9, gainEnd: 0.01, pan, filterType: 'lowpass', filterFreq: 2000
    });
    _scheduleTone({
      waveType: 'triangle', freqStart: 350, freqEnd: 60, duration: 0.45,
      gainStart: 0.65, gainEnd: 0.01, pan
    });

    // মেটালিক ক্ল্যাং (দুটি সামান্য ডিটিউনড টোন)
    _scheduleTone({ waveType: 'square', freqStart: 220, freqEnd: 180, duration: 0.25, gainStart: 0.18, gainEnd: 0.01, pan: pan + 0.12 });
    _scheduleTone({ waveType: 'square', freqStart: 227, freqEnd: 185, duration: 0.25, gainStart: 0.15, gainEnd: 0.01, pan: pan - 0.12 });

  } else if (type === 'win') {
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const t = idx * 0.06 + _rand(-0.005, 0.01);
      const pan = _rand(-0.2, 0.2);
      _scheduleTone({ waveType: 'triangle', freqStart: freq, freqEnd: freq, duration: 0.22, gainStart: 0.85, gainEnd: 0.01, startTime: t, pan });
      // হারমনিক ওভারটোন — সমৃদ্ধ ঘণ্টার মতো টিমব্রে
      _scheduleTone({ waveType: 'sine', freqStart: freq * 2, freqEnd: freq * 2, duration: 0.18, gainStart: 0.22, gainEnd: 0.01, startTime: t, pan });
    });

  } else if (type === 'click') {
    const jitter = _rand(-30, 30);
    _scheduleTone({ waveType: 'triangle', freqStart: 800 + jitter, freqEnd: 400, duration: 0.05, gainStart: 0.75, gainEnd: 0.01 });
    _scheduleNoiseBurst({ duration: 0.015, filterType: 'highpass', filterFreq: 3000, gainStart: 0.15, gainEnd: 0.01 });

  } else if (type === 'powerup') {
    const baseFreqs = [440, 554.37, 659.25, 880];
    baseFreqs.forEach((freq, idx) => {
      [0, 8].forEach(detune => {
        const now = audioCtx.currentTime + idx * 0.07;
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, now);
        filter.frequency.exponentialRampToValueAtTime(4000, now + 0.18); // পাওয়ার-সার্জ ফিল্টার ওপেনিং
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        osc.detune.setValueAtTime(detune, now);
        g.gain.setValueAtTime(0.55, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
        osc.connect(filter);
        filter.connect(g);
        g.connect(masterBus);
        osc.start(now);
        osc.stop(now + 0.18 + 0.02);
      });
    });

  } else if (type === 'six') {
    const notes = [880, 1109.73, 1318.51, 1760];
    notes.forEach((freq, idx) => {
      const t = idx * 0.04;
      const pan = _rand(-0.4, 0.4);
      _scheduleTone({ waveType: 'sine', freqStart: freq, freqEnd: freq, duration: 0.18, gainStart: 0.8, gainEnd: 0.01, startTime: t, pan });
      // শিমার নয়েজ — স্পার্কল ধুলোর মতো টেক্সচার
      _scheduleNoiseBurst({ duration: 0.06, filterType: 'highpass', filterFreq: 6000, gainStart: 0.12, gainEnd: 0.01, startTime: t, pan });
    });

  } else if (type === 'error') {
    _scheduleTone({ waveType: 'square', freqStart: 150, freqEnd: 110, duration: 0.12, gainStart: 0.6, gainEnd: 0.01 });
    _scheduleNoiseBurst({ duration: 0.08, filterType: 'lowpass', filterFreq: 500, gainStart: 0.3, gainEnd: 0.01 });

  } else if (type === 'turn') {
    const notes = [523.25, 659.25];
    notes.forEach((freq, idx) => {
      _scheduleTone({ waveType: 'sine', freqStart: freq, freqEnd: freq, duration: 0.22, gainStart: 0.7, gainEnd: 0.01, startTime: idx * 0.08 });
    });

  } else if (type === 'victory') {
    // সাব-বেস থাম্প — গাম্ভীর্য ও ওজন যোগ করে
    _scheduleTone({ waveType: 'sine', freqStart: 80, freqEnd: 50, duration: 0.3, gainStart: 0.5, gainEnd: 0.01 });

    const chords = [
      [261.63, 329.63, 392.00],
      [293.66, 349.23, 440.00],
      [329.63, 392.00, 523.25, 659.25]
    ];
    chords.forEach((chord, chordIdx) => {
      const t = chordIdx * 0.22;
      chord.forEach((freq, ni) => {
        const pan = (ni - (chord.length - 1) / 2) * 0.25; // কর্ডের প্রতিটি নোট স্টেরিও-তে ছড়ানো
        _scheduleTone({ waveType: 'triangle', freqStart: freq, freqEnd: freq, duration: 0.5, gainStart: 0.6, gainEnd: 0.01, startTime: t, pan });
      });
    });

  } else if (type === 'sad') {
    const frequencies = [392.00, 349.23, 311.13, 293.66];
    frequencies.forEach((freq, idx) => {
      const t = idx * 0.16;
      _scheduleTone({
        waveType: 'sawtooth', freqStart: freq, freqEnd: freq * 0.85, duration: 0.14,
        gainStart: 0.65, gainEnd: 0.01, startTime: t,
        filterType: 'lowpass', filterFreq: 1200 - idx * 150 // ক্রমশ ডার্কার হয়ে হতাশা প্রকাশ করে
      });
    });
  }
}

/*=============================================================
 * 2.3 HAPTIC FEEDBACK
 *============================================================*/
function triggerHaptic(type) {
  const vibeToggle = document.getElementById('vibe-toggle');
  const isVibeOn = vibeToggle ? vibeToggle.checked : true;
  if (!isVibeOn || !('vibrate' in navigator)) return;

  if (type === 'tap') navigator.vibrate(8);
  else if (type === 'hit') navigator.vibrate([35, 25, 35]);
  else if (type === 'victory') navigator.vibrate([70, 40, 70]);
  else if (type === 'six') navigator.vibrate([15, 10, 15, 10, 25]);
  else if (type === 'error') navigator.vibrate(45);
  else if (type === 'powerup') navigator.vibrate([20, 15, 40]);
}
/*************************************************************
 * BACKGROUND TAB SILENCER — অ্যাপ সুইচ করলে শব্দ ও বট থামায়
 *************************************************************/
let isTabActive = true;

document.addEventListener('visibilitychange', () => {
  isTabActive = !document.hidden;

  if (document.hidden) {
    if (audioCtx && audioCtx.state === 'running') {
      audioCtx.suspend(); // ব্যাকগ্রাউন্ডে গেলে অডিও থামিয়ে দিন
    }
  } else {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume(); // ফিরে এলে অডিও আবার চালু করুন
    }
    // ফিরে আসার সময় যদি বটের টার্ন আটকে থাকে, আবার ট্রিগার করুন
    if (typeof currentPlayer !== 'undefined' && isBotPlayer(currentPlayer) && !isMoving) {
      executeBotTurn();
    }
  }
});

/*************************************************************
 * 3. GAME STATE & SETUP CONFIG
 *************************************************************/
const playerSettings = {
  red: 'human',
  green: 'human',
  yellow: 'human',
  blue: 'off'
};

let isTeamMode = false;
let activeOrder = [];
let currentTurnIndex = 0;
let currentPlayer = 'red';

let diceValue = 1;
let diceRolled = false;
let consecutiveSixes = 0;
let isMoving = false;

const captureCounts = { red: 0, green: 0, yellow: 0, blue: 0 };
const powerCharges = { red: 0, green: 0, yellow: 0, blue: 0 };
let nextRollForcedValue = null;
let activePowerSelected = null; // 'swift_leap' | 'aegis_teleport'

const tokens = {
  red:    [{ pos: 0 }, { pos: 0 }, { pos: 0 }, { pos: 0 }],
  green:  [{ pos: 0 }, { pos: 0 }, { pos: 0 }, { pos: 0 }],
  yellow: [{ pos: 0 }, { pos: 0 }, { pos: 0 }, { pos: 0 }],
  blue:   [{ pos: 0 }, { pos: 0 }, { pos: 0 }, { pos: 0 }]
};

const winners = [];

const diceFaceRotations = {
  1: { x: 0, y: 0 },
  2: { x: 90, y: 0 },
  3: { x: 0, y: 90 },
  4: { x: 0, y: -90 },
  5: { x: -90, y: 0 },
  6: { x: 180, y: 0 }
};

/*************************************************************
 * 4. SETUP CONTROL PANEL INTERACTIVITY
 *************************************************************/
function setGameMode(mode) {
  playSound('click');
  isTeamMode = (mode === 'team');
  
  document.getElementById('btn-mode-solo').classList.toggle('selected', !isTeamMode);
  document.getElementById('btn-mode-solo').classList.toggle('active-yellow', !isTeamMode);
  document.getElementById('btn-mode-team').classList.toggle('selected', isTeamMode);
  document.getElementById('btn-mode-team').classList.toggle('active-yellow', isTeamMode);
  
  if (isTeamMode) {
    setPlayerType('red', 'human');
    setPlayerType('green', 'human');
    setPlayerType('yellow', 'human');
    setPlayerType('blue', 'bot');
  }
  validateLobbySettings();
}

function setPlayerType(player, type) {
  playSound('click');
  playerSettings[player] = type;
  
  const selector = document.getElementById(`select-${player}`);
  if (!selector) return;
  const btns = selector.querySelectorAll('.role-btn');
  
  btns.forEach(btn => btn.classList.remove('selected', 'active-red', 'active-green', 'active-yellow', 'active-blue'));
  
  const targetIdx = type === 'human' ? 0 : (type === 'bot' ? 1 : 2);
  const selectedBtn = btns[targetIdx];
  if (selectedBtn) {
    selectedBtn.classList.add('selected');
    if (type !== 'off') {
      selectedBtn.classList.add(`active-${player}`);
    }
  }

  validateLobbySettings();
}

function validateLobbySettings() {
  const activeCount = Object.values(playerSettings).filter(val => val !== 'off').length;
  const startBtn = document.getElementById('start-btn');
  if (!startBtn) return;
  
  if (isTeamMode) {
    if (activeCount !== 4) {
      startBtn.disabled = true;
      startBtn.innerText = "TEAM MODE REQUIRES 4 PLAYERS";
      return;
    }
    startBtn.disabled = false;
    startBtn.innerText = "START TEAM MATCH (2v2)";
    return;
  }

  if (activeCount < 2) {
    startBtn.disabled = true;
    startBtn.innerText = "MINIMUM 2 PLAYERS REQ.";
  } else {
    startBtn.disabled = false;
    startBtn.innerText = "START MATCH";
  }
}

/*************************************************************
 * 5. GRID GENERATOR & VECTOR ASSETS
 *************************************************************/
const SVG_STAR_PATH = `<svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`;

function generateGridCells() {
  const grid = document.getElementById('board-grid');
  if (!grid) return;
  grid.innerHTML = '';
  
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      if ((r < 6 && c < 6) || (r < 6 && c > 8) || (r > 8 && c > 8) || (r > 8 && c < 6)) continue;
      if (r >= 6 && r <= 8 && c >= 6 && c <= 8) continue;
      
      const cell = document.createElement('div');
      cell.classList.add('cell');
      cell.style.gridColumnStart = c + 1;
      cell.style.gridRowStart = r + 1;
      
      applyCellStyles(cell, c, r);
      grid.appendChild(cell);
    }
  }
}

function applyCellStyles(cell, col, row) {
  if (col === 1 && row === 6) cell.classList.add('path-red');
  if (col === 8 && row === 1) cell.classList.add('path-green');
  if (col === 13 && row === 8) cell.classList.add('path-yellow');
  if (col === 6 && row === 13) cell.classList.add('path-blue');
  
  if (row === 7 && col >= 1 && col <= 5) cell.classList.add('path-red');
  if (col === 7 && row >= 1 && row <= 5) cell.classList.add('path-green');
  if (row === 7 && col >= 9 && col <= 13) cell.classList.add('path-yellow');
  if (col === 7 && row >= 9 && row <= 13) cell.classList.add('path-blue');
  
  if ((col === 2 && row === 8) || (col === 6 && row === 2) || (col === 12 && row === 6) || (col === 8 && row === 12) ||
      (col === 1 && row === 6) || (col === 8 && row === 1) || (col === 13 && row === 8) || (col === 6 && row === 13)) {
    cell.classList.add('safe-star');
    cell.innerHTML = SVG_STAR_PATH;
  }

  if (row < 6 && col < 6) {
    cell.style.borderColor = 'rgba(255, 42, 95, 0.22)';
  } else if (row < 6 && col > 8) {
    cell.style.borderColor = 'rgba(0, 204, 102, 0.22)';
  } else if (row > 8 && col > 8) {
    cell.style.borderColor = 'rgba(250, 204, 21, 0.22)';
  } else if (row > 8 && col < 6) {
    cell.style.borderColor = 'rgba(0, 153, 255, 0.22)';
  }
}

function generateTokenElements() {
  const layer = document.getElementById('tokens-layer');
  if (!layer) return;
  layer.innerHTML = '';
  
  activeOrder.forEach(player => {
    for (let i = 0; i < 4; i++) {
      const token = document.createElement('div');
      token.className = `token ${player}`;
      token.id = `token-${player}-${i}`;
      token.onclick = () => onTokenTapped(player, i);
      // ভেতরটি খালি রাখা হলো কারণ CSS pseudo-element (::after) দিয়ে গ্লসি মার্বেল ইফেক্ট রেন্ডার হবে
      token.innerHTML = ``;
      layer.appendChild(token);
    }
  });
}

/*************************************************************
 * 6. SPATIAL RESOLVERS & COLLISION HANDLING
 *************************************************************/
function getTokenCoordinates(player, tokenIdx) {
  const pos = tokens[player][tokenIdx].pos;
  const config = PLAYER_CONFIGS[player];
  
  if (pos === 0) return config.yard[tokenIdx];
  if (pos === 57) return config.goal;
  if (pos >= 52 && pos <= 56) return config.homePath[pos - 52];
  
  const index = (config.startIndex + pos - 1) % 52;
  return TRACK[index];
}

function updateTokenPositions() {
  const positionsMap = {};
  
  activeOrder.forEach(player => {
    for (let i = 0; i < 4; i++) {
      const coord = getTokenCoordinates(player, i);
      const key = `${coord[0].toFixed(1)},${coord[1].toFixed(1)}`;
      if (!positionsMap[key]) positionsMap[key] = [];
      positionsMap[key].push({ player, idx: i });
    }
  });

  for (const key in positionsMap) {
    const cluster = positionsMap[key];
    const [col, row] = key.split(',').map(Number);
    
    cluster.forEach((item, index) => {
      const el = document.getElementById(`token-${item.player}-${item.idx}`);
      if (!el) return;
      
      let dx = 0;
      let dy = 0;
      let scale = 1.0;
      
      if (tokens[item.player][item.idx].pos > 0) {
        if (cluster.length === 2) {
          dx = index === 0 ? -12 : 12;
          scale = 0.82;
        } else if (cluster.length === 3) {
          if (index === 0) { dx = -14; dy = -14; }
          else if (index === 1) { dx = 14; dy = -14; }
          else { dx = 0; dy = 14; }
          scale = 0.72;
        } else if (cluster.length >= 4) {
          if (index === 0) { dx = -16; dy = -16; }
          else if (index === 1) { dx = 16; dy = -16; }
          else if (index === 2) { dx = -16; dy = 16; }
          else { dx = 16; dy = 16; }
          scale = 0.65;
        }
      }
      
      const finalCol = Number.isInteger(col) ? col + 0.5 : col;
const finalRow = Number.isInteger(row) ? row + 0.5 : row;
el.style.left = `calc(${finalCol} * 6.6667% - 3.6%)`;
el.style.top = `calc(${finalRow} * 6.6667% - 3.6%)`;
      el.style.setProperty('--col-offset', dx);
      el.style.setProperty('--row-offset', dy);
      el.style.setProperty('--token-scale', scale);
      
      if (!el.classList.contains('hopping') && !el.classList.contains('capturing')) {
        el.style.transform = `translate3d(${dx}%, ${dy}%, 0) scale(${scale})`;
      }
    });
  }
}

/*************************************************************
 * 7. LOBBY STATE CONTROLLER & TEAM SYSTEM HELPERS
 *************************************************************/
function areTeammates(p1, p2) {
  if (!isTeamMode) return false;
  return (p1 === 'red' && p2 === 'yellow') ||
         (p1 === 'yellow' && p2 === 'red') ||
         (p1 === 'green' && p2 === 'blue') ||
         (p1 === 'blue' && p2 === 'green');
}

function getTeammate(player) {
  if (player === 'red') return 'yellow';
  if (player === 'yellow') return 'red';
  if (player === 'green') return 'blue';
  if (player === 'blue') return 'green';
  return null;
}

function goToLobby() {
  playSound('click');
  document.getElementById('splash-screen').classList.add('hidden');
  document.getElementById('home-screen').classList.remove('hidden');
}

function startLobbyGame() {
  playSound('click');
  saveLastConfig();
  activeOrder = [];
  if (playerSettings.red !== 'off') activeOrder.push('red');
  if (playerSettings.green !== 'off') activeOrder.push('green');
  if (playerSettings.yellow !== 'off') activeOrder.push('yellow');
  if (playerSettings.blue !== 'off') activeOrder.push('blue');
  
  document.getElementById('home-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.remove('hidden');
  restartGame();
}

function restartGame() {
  winners.length = 0;
  currentTurnIndex = 0;
  currentPlayer = activeOrder[0];
  
  activeOrder.forEach(player => {
    tokens[player] = [{ pos: 0 }, { pos: 0 }, { pos: 0 }, { pos: 0 }];
    captureCounts[player] = 0;
    powerCharges[player] = 0;
  });
  
  nextRollForcedValue = null;
  activePowerSelected = null;
  
  document.querySelectorAll('.yard').forEach(yard => yard.style.opacity = '0.08');
  activeOrder.forEach(player => {
    const y = document.getElementById(`yard-${player}`);
    if (y) y.style.opacity = '1';
  });

  const badge = document.getElementById('team-status-indicator');
  if (badge) {
    badge.innerText = isTeamMode ? "TEAM MATCH (Red+Yellow vs Green+Blue)" : "SOLO MATCH";
  }

  document.getElementById('podium-modal').classList.add('hidden');
  generateGridCells();
  generateTokenElements();
  updateTokenPositions();
  resetDiceUI();
  setTurnState(currentPlayer);
}

function setTurnState(player) {
  currentPlayer = player;
  diceRolled = false;
  activePowerSelected = null;
  
  document.querySelectorAll('.yard').forEach(yard => yard.classList.remove('active-turn-glow'));
  const activeYard = document.getElementById(`yard-${player}`);
  if (activeYard) activeYard.classList.add('active-turn-glow');

  document.querySelectorAll('.floating-dice').forEach(dice => dice.classList.remove('active-turn'));
  const activeDice = document.getElementById(`dice-${player}`);
  if (activeDice) activeDice.classList.add('active-turn');

  updatePowerHubUI();

  // যদি চালটি কোনো মানব খেলোয়াড়ের (Human) হয়, তবে তাকে সচেতন করতে হালকা চিম বাজবে
  if (playerSettings[player] === 'human') {
    playSound('turn');
  }

  if (playerSettings[player] === 'bot') {
    executeBotTurn();
  }

  saveMatchState();
  mpBroadcastState();
}

function toggleRulesModal(closeOnly) {
  playSound('click');
  const rules = document.getElementById('rules-modal');
  if (!rules) return;
  if (closeOnly) {
    rules.classList.add('hidden');
  } else {
    rules.classList.toggle('hidden');
  }
}

function getPlayableTokens(player, roll) {
  const list = [];
  if (isMoving) return list;
  
  let targetPlayer = player;
  if (isTeamMode && checkPlayerFinish(player)) {
    targetPlayer = getTeammate(player);
  }
  
  for (let i = 0; i < 4; i++) {
    const pos = tokens[targetPlayer][i].pos;
    if (pos === 0 && roll === 6) list.push(i);
    else if (pos > 0 && pos + roll <= 57) list.push(i);
  }
  return list;
}

/*************************************************************
 * 8. DICE ROLL HANDLERS
 *************************************************************/
function onDiceTriggered(player) {
  if (mpIsActive && !mpIsHost) {
    if (player !== currentPlayer || diceRolled) return;
    mpSendAction('dice', { player });
    return;
  }
  if (player !== currentPlayer || diceRolled || isMoving) return;
  triggerHaptic('tap');
  playSound('roll');
  diceRolled = true;
  
  if (nextRollForcedValue !== null) {
    diceValue = nextRollForcedValue;
    nextRollForcedValue = null;
  } else {
    diceValue = Math.floor(Math.random() * 6) + 1;
  }
  
  const spinsX = (3 + Math.floor(Math.random() * 3)) * 360;
  const spinsY = (3 + Math.floor(Math.random() * 3)) * 360;
  const faceRot = diceFaceRotations[diceValue];
  
  const activeCube = document.getElementById(`cube-${player}`);
  if (activeCube) {
    activeCube.style.transform = `rotateX(${spinsX + faceRot.x}deg) rotateY(${spinsY + faceRot.y}deg)`;
  }
  
  setTimeout(() => {
    evaluateRollResult();
  }, 250);
}

function evaluateRollResult() {
  if (diceValue === 6) {
    playSound('six'); // ডাইসে ৬ উঠলে প্রিমিয়াম লাকি বেল বাজবে
    consecutiveSixes++;
    if (consecutiveSixes === 3) {
      consecutiveSixes = 0;
      playSound('error'); // ৩ বার ছক্কা পড়লে এরর সাউন্ড বাজবে
      showNotification("💥 OVERLIMIT", `${PLAYER_CONFIGS[currentPlayer].name} rolled 3 consecutive sixes! Turn skipped.`, "red");
      setTimeout(passTurn, 200);
      return;
    }
  } else {
    consecutiveSixes = 0;
  }
  
  const choices = getPlayableTokens(currentPlayer, diceValue);
  
  if (choices.length === 0) {
    setTimeout(passTurn, 350);
  } else if (choices.length === 1) {
    setTimeout(() => onTokenTapped(currentPlayer, choices[0]), 300);
  } else {
    if (playerSettings[currentPlayer] === 'bot') {
      setTimeout(() => executeBotPawnSelection(choices), 100);
    } else {
      highlightPlayableTokens(choices);
    }
  }
}

function highlightPlayableTokens(indices) {
  let targetPlayer = currentPlayer;
  if (isTeamMode && checkPlayerFinish(currentPlayer)) {
    targetPlayer = getTeammate(currentPlayer);
  }
  indices.forEach(idx => {
    const el = document.getElementById(`token-${targetPlayer}-${idx}`);
    if (el) el.classList.add('playable');
  });
}

function clearHighlighting() {
  document.querySelectorAll('.token').forEach(el => {
    el.classList.remove('playable');
  });
}

/*************************************************************
 * 9. LUDO INTELLIGENT BOT (AI) SYSTEM — PRO EDITION v2
 * (হিউম্যানাইজড + কৌশলী চৌকস সংস্করণ)
 *
 * এই ফাইলটি v1 (ludo-bot-ai-pro.js)-এর সম্পূর্ণ প্রতিস্থাপন।
 * বাইরের কল-সিগনেচার অপরিবর্তিত: executeBotTurn,
 * executeBotPowerUsage, executeBotPawnSelection,
 * simulateTargetCoordinates, getGamePhase, getTurnDistance,
 * setBotDifficulty — কোডবেসের বাকি অংশে কিছু বদলাতে হবে না।
 *
 * ==================== ⚠️ নতুন ইন্টিগ্রেশন হুক ====================
 * হিউম্যানাইজেশনের জন্য দুটো নতুন ফাংশন আপনার capture-handling
 * কোড থেকে কল করতে হবে (এই ফাইলে সেই লজিক নেই, কারণ ক্যাপচার
 * ইভেন্ট আপনার মূল গেম-ইঞ্জিনে ঘটে):
 *
 *   • যখন একটি বট প্রতিপক্ষকে ক্যাপচার করে:
 *       onBotCapturedOpponent(capturingPlayer);
 *
 *   • যখন একটি বটের টোকেন ক্যাপচার হয়ে যায়:
 *       onBotWasCaptured(capturedPlayer);
 *
 *   • নতুন ম্যাচ শুরু হলে (personality/momentum রিসেট করতে):
 *       resetBotAIState();
 *
 * এই তিনটে কল যোগ করলে momentum system সম্পূর্ণ সক্রিয় হবে।
 * না যোগ করলেও বাকি সব ফিচার (personality, leader-targeting,
 * calculated risk, thinking delay) স্বাভাবিকভাবেই কাজ করবে।
 * ===================================================================
 *************************************************************/

/*=============================================================
 * 9.0 DIFFICULTY PRESETS & WEIGHT CONFIGURATION
 *============================================================*/
const AI_DIFFICULTY_PRESETS = {
  easy: {
    captureBase: 1000, captureProgressFactor: 8,
    captureNearHomeThreshold: 45, captureNearHomeBonus: 400,
    leaderPressureBonus: 150,

    threatBase: 150, threatTurnDist1Bonus: 70, threatTurnDist2Bonus: 35,
    threatPosFactor: 3,

    safetyBase: 300, safetyEscapeBonus: 500,

    sixEarlyBase: 700, sixEarlyDecay: 150,
    sixMidBase: 500, sixMidDecay: 100,
    sixLateBase: 250,

    progMultEarly: 1.0, progMultMid: 1.6, progMultLate: 2.6,
    homeStretchBonus: 100,

    finishScore: 2200,

    stackSafeMult: 150, stackUnsafeMult: 100, spreadBonus: 30,

    teamGuardSafe: 100, teamGuardUnsafe: 60, teamSaveBonus: 400,

    futureSafeBonus: 80, futureCaptureBonus: 200, futureThreatPenaltyFactor: 150,

    mistakeChance: 0.32, mistakeAbsThreshold: 100, mistakeRatioThreshold: 0.22,

    lookAheadDepth: 1, counterRiskWeight: 0, riskTolerance: 0
  },

  medium: {
    captureBase: 1600, captureProgressFactor: 10,
    captureNearHomeThreshold: 45, captureNearHomeBonus: 700,
    leaderPressureBonus: 250,

    threatBase: 280, threatTurnDist1Bonus: 180, threatTurnDist2Bonus: 90,
    threatPosFactor: 5,

    safetyBase: 450, safetyEscapeBonus: 850,

    sixEarlyBase: 1050, sixEarlyDecay: 200,
    sixMidBase: 750, sixMidDecay: 120,
    sixLateBase: 350,

    progMultEarly: 1.4, progMultMid: 2.5, progMultLate: 4.2,
    homeStretchBonus: 180,

    finishScore: 2800,

    stackSafeMult: 250, stackUnsafeMult: 200, spreadBonus: 60,

    teamGuardSafe: 180, teamGuardUnsafe: 120, teamSaveBonus: 750,

    futureSafeBonus: 160, futureCaptureBonus: 350, futureThreatPenaltyFactor: 200,

    mistakeChance: 0.15, mistakeAbsThreshold: 60, mistakeRatioThreshold: 0.10,

    lookAheadDepth: 1, counterRiskWeight: 0, riskTolerance: 0.1
  },

  hard: {
    captureBase: 1750, captureProgressFactor: 12,
    captureNearHomeThreshold: 45, captureNearHomeBonus: 800,
    leaderPressureBonus: 400,

    threatBase: 320, threatTurnDist1Bonus: 220, threatTurnDist2Bonus: 110,
    threatPosFactor: 6,

    safetyBase: 480, safetyEscapeBonus: 900,

    sixEarlyBase: 1100, sixEarlyDecay: 220,
    sixMidBase: 800, sixMidDecay: 130,
    sixLateBase: 380,

    progMultEarly: 1.5, progMultMid: 2.7, progMultLate: 4.6,
    homeStretchBonus: 220,

    finishScore: 3000,

    stackSafeMult: 280, stackUnsafeMult: 240, spreadBonus: 70,

    teamGuardSafe: 200, teamGuardUnsafe: 140, teamSaveBonus: 850,

    futureSafeBonus: 170, futureCaptureBonus: 400, futureThreatPenaltyFactor: 220,

    mistakeChance: 0.05, mistakeAbsThreshold: 40, mistakeRatioThreshold: 0.06,

    lookAheadDepth: 2, counterRiskWeight: 0.6, riskTolerance: 0.25
  }
};

let botDifficulty = 'medium';

function setBotDifficulty(level) {
  if (AI_DIFFICULTY_PRESETS[level]) {
    botDifficulty = level;
    return true;
  }
  console.warn(`[Bot AI] অজানা difficulty level: "${level}"।`);
  return false;
}

function getBotWeights() {
  return AI_DIFFICULTY_PRESETS[botDifficulty] || AI_DIFFICULTY_PRESETS.medium;
}

/*=============================================================
 * 9.0.1 PERSONALITY SYSTEM (হিউম্যানাইজেশন)
 *
 * প্রতিটি বট ম্যাচ শুরুতে একটি এলোমেলো "স্বভাব" পায়, যা তার
 * প্রতিটি সিদ্ধান্তে সামান্য পক্ষপাত যোগ করে — ফলে চারটি বট
 * একই কম্পিউটারের মতো না খেলে, চারজন ভিন্ন মানুষের মতো খেলে।
 *============================================================*/
const BOT_PERSONALITIES = {
  aggressive:  { captureMult: 1.28, threatMult: 0.82, safetyMult: 0.85, teamSaveMult: 0.95, mistakeMult: 0.85 },
  defensive:   { captureMult: 0.82, threatMult: 1.30, safetyMult: 1.25, teamSaveMult: 1.15, mistakeMult: 1.05 },
  opportunist: { captureMult: 1.15, threatMult: 1.10, safetyMult: 1.00, teamSaveMult: 0.90, mistakeMult: 0.80 },
  balanced:    { captureMult: 1.00, threatMult: 1.00, safetyMult: 1.00, teamSaveMult: 1.00, mistakeMult: 1.00 }
};

let botPersonalities = {}; // { playerId: 'aggressive' | 'defensive' | ... }

function getBotPersonality(player) {
  if (!botPersonalities[player]) {
    const keys = Object.keys(BOT_PERSONALITIES);
    botPersonalities[player] = keys[Math.floor(Math.random() * keys.length)];
  }
  return BOT_PERSONALITIES[botPersonalities[player]];
}

/** ডিবাগ/UI প্রদর্শনের জন্য — বটের স্বভাবের নাম রিটার্ন করে */
function getBotPersonalityName(player) {
  return botPersonalities[player] || null;
}

/*=============================================================
 * 9.0.2 MOMENTUM / EMOTIONAL STATE (হিউম্যানাইজেশন)
 *
 * বট সাম্প্রতিক ঘটনার ওপর ভিত্তি করে সাময়িকভাবে বেশি সাহসী বা
 * বেশি সতর্ক হয়ে ওঠে — ঠিক মানুষের মতো। প্রতি টার্নে ধীরে ধীরে
 * এই প্রভাব হ্রাস পায় (decay)।
 *============================================================*/
let botMomentum = {}; // { playerId: { confidence, caution } }

function _initMomentum(player) {
  if (!botMomentum[player]) botMomentum[player] = { confidence: 0, caution: 0 };
}

/** কল করুন: বট যখন প্রতিপক্ষকে ক্যাপচার করে */
function onBotCapturedOpponent(player) {
  _initMomentum(player);
  botMomentum[player].confidence = Math.min(botMomentum[player].confidence + 1, 3);
  botMomentum[player].caution = Math.max(botMomentum[player].caution - 0.5, 0);
}

/** কল করুন: বটের টোকেন ক্যাপচার হয়ে গেলে */
function onBotWasCaptured(player) {
  _initMomentum(player);
  botMomentum[player].caution = Math.min(botMomentum[player].caution + 1, 3);
  botMomentum[player].confidence = Math.max(botMomentum[player].confidence - 0.5, 0);
}

function _decayMomentum(player) {
  _initMomentum(player);
  const m = botMomentum[player];
  if (m.confidence > 0) m.confidence = Math.max(0, m.confidence - 0.25);
  if (m.caution > 0) m.caution = Math.max(0, m.caution - 0.25);
}

/** নতুন ম্যাচ শুরুর সময় কল করুন — personality ও momentum রিসেট হবে */
function resetBotAIState() {
  botPersonalities = {};
  botMomentum = {};
  _simCoordCache.clear();
}

/*=============================================================
 * 9.0.3 EFFECTIVE WEIGHTS — Difficulty + Personality + Momentum
 * মিলিয়ে প্রতিটি সিদ্ধান্তের জন্য একটি তাজা, নিরাপদ weight object
 * তৈরি করে (মূল প্রিসেট কখনো mutate হয় না)।
 *============================================================*/
function getEffectiveWeights(player) {
  const base = getBotWeights();
  const personality = getBotPersonality(player);
  _initMomentum(player);
  const momentum = botMomentum[player];

  const confidenceFactor = 1 + (momentum.confidence * 0.06);
  const cautionFactor = 1 + (momentum.caution * 0.08);

  return {
    ...base,
    captureBase: base.captureBase * personality.captureMult * confidenceFactor,
    captureProgressFactor: base.captureProgressFactor * personality.captureMult,
    leaderPressureBonus: base.leaderPressureBonus * personality.captureMult,

    threatBase: base.threatBase * personality.threatMult * cautionFactor,
    threatTurnDist1Bonus: base.threatTurnDist1Bonus * personality.threatMult * cautionFactor,
    threatTurnDist2Bonus: base.threatTurnDist2Bonus * personality.threatMult * cautionFactor,

    safetyBase: base.safetyBase * personality.safetyMult * cautionFactor,
    safetyEscapeBonus: base.safetyEscapeBonus * personality.safetyMult * cautionFactor,

    teamSaveBonus: base.teamSaveBonus * personality.teamSaveMult,

    mistakeChance: Math.max(0.02, Math.min(0.5,
      base.mistakeChance * personality.mistakeMult * (1 - momentum.confidence * 0.05 + momentum.caution * 0.05)
    ))
  };
}

/*=============================================================
 * 9.1 ADAPTIVE PLAY STYLE & LOBBY HELPERS
 *============================================================*/
function getGamePhase(player) {
  const positions = tokens[player].map(t => t.pos);
  const totalProgress = positions.reduce((sum, p) => sum + p, 0);
  const activeOnBoard = positions.filter(p => p > 0 && p < 57).length;
  const finished = positions.filter(p => p === 57).length;

  if (finished >= 2 || positions.some(p => p >= 50)) return 'late';
  if (totalProgress > 110 || activeOnBoard >= 3) return 'mid';
  return 'early';
}

function getTurnDistance(fromPlayer, toPlayer) {
  const fromIdx = activeOrder.indexOf(fromPlayer);
  const toIdx = activeOrder.indexOf(toPlayer);
  if (fromIdx === -1 || toIdx === -1) return 4;
  return (toIdx - fromIdx + activeOrder.length) % activeOrder.length;
}

/*=============================================================
 * 9.2 SPATIAL COORDINATE EMULATOR + PER-TURN CACHE
 *============================================================*/
let _simCoordCache = new Map();

function _resetSimCache() {
  _simCoordCache.clear();
}

function simulateTargetCoordinates(player, tokenIdx, targetPos) {
  const cacheKey = `${player}|${tokenIdx}|${targetPos}`;
  if (_simCoordCache.has(cacheKey)) return _simCoordCache.get(cacheKey);

  const config = PLAYER_CONFIGS[player];
  let result;
  if (targetPos === 0) result = config.yard[tokenIdx];
  else if (targetPos === 57) result = config.goal;
  else if (targetPos >= 52 && targetPos <= 56) result = config.homePath[targetPos - 52];
  else {
    const index = (config.startIndex + targetPos - 1) % 52;
    result = TRACK[index];
  }

  _simCoordCache.set(cacheKey, result);
  return result;
}

/*=============================================================
 * 9.3 MODULAR DECISION ENGINE EVALUATORS (Weight-Driven)
 *============================================================*/

// ১. Capture Evaluation
function evaluateCapture(player, targetPlayer, idx, targetCoord, targetPos, phase, w) {
  if (isCoordinateSafe(targetCoord[0], targetCoord[1])) return 0;

  let score = 0;
  activeOrder.forEach(opp => {
    if (opp === player || areTeammates(player, opp)) return;
    tokens[opp].forEach((oppToken, oppIdx) => {
      if (oppToken.pos > 0 && oppToken.pos < 57) {
        const oppCoord = getTokenCoordinates(opp, oppIdx);
        if (oppCoord[0] === targetCoord[0] && oppCoord[1] === targetCoord[1]) {
          let captureValue = w.captureBase;
          captureValue += oppToken.pos * w.captureProgressFactor;
          if (oppToken.pos >= w.captureNearHomeThreshold) {
            captureValue += w.captureNearHomeBonus;
          }
          score += captureValue;
        }
      }
    });
  });
  return score;
}

// ২. Threat Analysis
function evaluateThreat(player, targetPlayer, idx, targetCoord, targetPos, w) {
  if (isCoordinateSafe(targetCoord[0], targetCoord[1])) return 0;

  let totalPenalty = 0;
  activeOrder.forEach(opp => {
    if (opp === player || areTeammates(player, opp)) return;
    tokens[opp].forEach((oppToken, oppIdx) => {
      if (oppToken.pos <= 0 || oppToken.pos >= 52) return;
      for (let roll = 1; roll <= 6; roll++) {
        const simulatedPos = oppToken.pos + roll;
        const simulatedCoord = simulateTargetCoordinates(opp, oppIdx, simulatedPos);
        if (simulatedCoord && simulatedCoord[0] === targetCoord[0] && simulatedCoord[1] === targetCoord[1]) {
          let danger = w.threatBase;
          const turnDist = getTurnDistance(player, opp);
          if (turnDist === 1) danger += w.threatTurnDist1Bonus;
          else if (turnDist === 2) danger += w.threatTurnDist2Bonus;
          danger += targetPos * w.threatPosFactor;
          totalPenalty += danger;
        }
      }
    });
  });

  return -totalPenalty;
}

// ৩. Safety Evaluation
function evaluateSafety(player, targetPlayer, idx, targetCoord, currentPos, targetPos, w) {
  let safetyScore = 0;
  const isCurrentlySafe = currentPos === 0 || isCoordinateSafe(getTokenCoordinates(targetPlayer, idx)[0], getTokenCoordinates(targetPlayer, idx)[1]);
  const isTargetSafe = isCoordinateSafe(targetCoord[0], targetCoord[1]);

  if (isTargetSafe) {
    safetyScore += w.safetyBase;
    if (!isCurrentlySafe && isTokenCurrentlyThreatened(targetPlayer, idx)) {
      safetyScore += w.safetyEscapeBonus;
    }
  }
  return safetyScore;
}

// ৪. Adaptive Progress Evaluation
function evaluateProgress(player, targetPlayer, idx, currentPos, targetPos, phase, roll, w) {
  let progressScore = 0;

  if (currentPos === 0 && roll === 6) {
    const activeCount = tokens[targetPlayer].filter(t => t.pos > 0 && t.pos < 57).length;
    if (phase === 'early') progressScore += w.sixEarlyBase - (activeCount * w.sixEarlyDecay);
    else if (phase === 'mid') progressScore += w.sixMidBase - (activeCount * w.sixMidDecay);
    else progressScore += w.sixLateBase;
    return progressScore;
  }

  let multiplier = w.progMultMid;
  if (phase === 'early') multiplier = w.progMultEarly;
  else if (phase === 'mid') multiplier = w.progMultMid;
  else if (phase === 'late') multiplier = w.progMultLate;

  progressScore += targetPos * multiplier;

  if (targetPos >= 52 && targetPos <= 56) {
    progressScore += w.homeStretchBonus;
  }

  return progressScore;
}

// ৫. Finish Priority
function evaluateFinish(player, targetPlayer, idx, targetPos, w) {
  if (targetPos === 57) return w.finishScore;
  return 0;
}

// ৬. Distribution & Board Control Strategy
function evaluateDistribution(player, targetPlayer, idx, targetCoord, w) {
  let score = 0;
  const isTargetSafe = isCoordinateSafe(targetCoord[0], targetCoord[1]);

  const stackedCount = tokens[targetPlayer].filter((t, tIdx) => {
    if (tIdx === idx || t.pos <= 0 || t.pos >= 57) return false;
    const coord = getTokenCoordinates(targetPlayer, tIdx);
    return coord[0] === targetCoord[0] && coord[1] === targetCoord[1];
  }).length;

  if (stackedCount > 0) {
    if (isTargetSafe) score += w.stackSafeMult * stackedCount;
    else score -= w.stackUnsafeMult * stackedCount;
  } else {
    score += w.spreadBonus;
  }

  return score;
}

// ৭. Team Mode Intelligence
function evaluateTeam(player, targetPlayer, idx, targetCoord, targetPos, w) {
  if (!isTeamMode) return 0;

  let teamScore = 0;
  const teammate = getTeammate(player);
  if (!teammate) return 0;

  const landsOnTeammate = tokens[teammate].some(t => {
    if (t.pos <= 0 || t.pos >= 57) return false;
    const coord = getTokenCoordinates(teammate, tokens[teammate].indexOf(t));
    return coord[0] === targetCoord[0] && coord[1] === targetCoord[1];
  });

  if (landsOnTeammate) {
    if (isCoordinateSafe(targetCoord[0], targetCoord[1])) teamScore += w.teamGuardSafe;
    else teamScore -= w.teamGuardUnsafe;
  }

  activeOrder.forEach(opp => {
    if (opp === player || opp === teammate) return;
    tokens[opp].forEach((oppToken, oppIdx) => {
      if (oppToken.pos > 0 && oppToken.pos < 57) {
        const oppCoord = getTokenCoordinates(opp, oppIdx);
        let threatensTeammate = false;
        tokens[teammate].forEach((teamToken, teamIdx) => {
          if (teamToken.pos > 0 && teamToken.pos < 52) {
            const teamCoord = getTokenCoordinates(teammate, teamIdx);
            for (let r = 1; r <= 6; r++) {
              const simulatedOppCoord = simulateTargetCoordinates(opp, oppIdx, oppToken.pos + r);
              if (simulatedOppCoord && simulatedOppCoord[0] === teamCoord[0] && simulatedOppCoord[1] === teamCoord[1]) {
                threatensTeammate = true;
              }
            }
          }
        });
        if (threatensTeammate && oppCoord[0] === targetCoord[0] && oppCoord[1] === targetCoord[1]) {
          teamScore += w.teamSaveBonus;
        }
      }
    });
  });

  return teamScore;
}

// ৮. Look-Ahead Decision System (১ চাল)
function evaluateFuture(player, targetPlayer, idx, targetPos, phase, w) {
  if (targetPos >= 52) return 0;

  let futureExpectancy = 0;

  for (let nextRoll = 1; nextRoll <= 6; nextRoll++) {
    const nextSimulatedPos = targetPos + nextRoll;
    if (nextSimulatedPos > 57) continue;

    const nextSimulatedCoord = simulateTargetCoordinates(targetPlayer, idx, nextSimulatedPos);
    if (!nextSimulatedCoord) continue;

    let subScore = 0;
    const isNextSafe = isCoordinateSafe(nextSimulatedCoord[0], nextSimulatedCoord[1]);
    if (isNextSafe) subScore += w.futureSafeBonus;

    activeOrder.forEach(opp => {
      if (opp === player || areTeammates(player, opp)) return;
      tokens[opp].forEach((oppToken, oppIdx) => {
        if (oppToken.pos > 0 && oppToken.pos < 57) {
          const oppCoord = getTokenCoordinates(opp, oppIdx);
          if (oppCoord[0] === nextSimulatedCoord[0] && oppCoord[1] === nextSimulatedCoord[1]) {
            subScore += w.futureCaptureBonus;
          }
        }
      });
    });

    const nextThreatCount = countThreats(nextSimulatedCoord, player);
    subScore -= nextThreatCount * w.futureThreatPenaltyFactor;

    futureExpectancy += subScore;
  }

  return Math.round(futureExpectancy / 6);
}

// ৯. Counter-Risk (2-Ply Look-Ahead) — শুধুমাত্র 'hard' মোডে সক্রিয়
function evaluateCounterRisk(player, targetPlayer, idx, targetPos, targetCoord, w) {
  if (w.lookAheadDepth < 2) return 0;
  if (targetPos >= 52) return 0;
  if (isCoordinateSafe(targetCoord[0], targetCoord[1])) return 0;

  let maxCounterValue = 0;
  activeOrder.forEach(opp => {
    if (opp === player || areTeammates(player, opp)) return;
    tokens[opp].forEach((oppToken, oppIdx) => {
      if (oppToken.pos <= 0 || oppToken.pos >= 52) return;
      for (let roll = 1; roll <= 6; roll++) {
        const simCoord = simulateTargetCoordinates(opp, oppIdx, oppToken.pos + roll);
        if (simCoord && simCoord[0] === targetCoord[0] && simCoord[1] === targetCoord[1]) {
          const counterValue = 900 + (targetPos * 8);
          if (counterValue > maxCounterValue) maxCounterValue = counterValue;
        }
      }
    });
  });

  return -Math.round(maxCounterValue * w.counterRiskWeight);
}

// ১০. NEW — Leader Pressure (কৌশলী চৌকসতা: এগিয়ে থাকা প্রতিপক্ষকে টার্গেট করা)
/**
 * যে প্রতিপক্ষের সামগ্রিক অগ্রগতি (progress) সবচেয়ে বেশি, তাকে
 * ক্যাপচার করার সুযোগ পেলে বাড়তি অগ্রাধিকার দেয় — যাতে খেলা
 * এক প্রতিপক্ষের একচেটিয়া জয়ের দিকে না চলে যায় (catch-up logic)।
 */
function evaluateLeaderPressure(player, targetPlayer, idx, targetCoord, targetPos, w) {
  if (isCoordinateSafe(targetCoord[0], targetCoord[1])) return 0;

  let maxProgress = -1;
  const progressMap = {};
  activeOrder.forEach(opp => {
    if (opp === player || areTeammates(player, opp)) return;
    const prog = tokens[opp].reduce((s, t) => s + t.pos, 0);
    progressMap[opp] = prog;
    if (prog > maxProgress) maxProgress = prog;
  });

  let bonus = 0;
  activeOrder.forEach(opp => {
    if (opp === player || areTeammates(player, opp)) return;
    if (progressMap[opp] !== maxProgress || maxProgress <= 0) return;
    tokens[opp].forEach((oppToken, oppIdx) => {
      if (oppToken.pos > 0 && oppToken.pos < 57) {
        const oppCoord = getTokenCoordinates(opp, oppIdx);
        if (oppCoord[0] === targetCoord[0] && oppCoord[1] === targetCoord[1]) {
          bonus += w.leaderPressureBonus;
        }
      }
    });
  });

  return bonus;
}

/*=============================================================
 * 9.4 INTELLIGENT CORE DECISION EXECUTION
 *============================================================*/

function executeBotTurn() {
  if (winners.length > 0 && (isTeamMode || winners.length >= activeOrder.length - 1)) return;

  setTimeout(() => {
    _resetSimCache();
    _decayMomentum(currentPlayer);
    const usedPower = executeBotPowerUsage();
    if (usedPower) {
      if (nextRollForcedValue === 6) {
        setTimeout(() => onDiceTriggered(currentPlayer), 300);
      }
    } else {
      onDiceTriggered(currentPlayer);
    }
  }, 350 + Math.random() * 200);
}

// Power Usage Logic
function executeBotPowerUsage() {
  if (powerCharges[currentPlayer] <= 0 || isMoving) return false;

  const w = getEffectiveWeights(currentPlayer);
  let targetPlayer = currentPlayer;
  if (isTeamMode && checkPlayerFinish(currentPlayer)) {
    targetPlayer = getTeammate(currentPlayer);
  }

  const phase = getGamePhase(targetPlayer);
  const yardCount = tokens[targetPlayer].filter(t => t.pos === 0).length;
  const activeCount = tokens[targetPlayer].filter(t => t.pos > 0 && t.pos < 57).length;

  // ১. ফোর্স সিক্স
  if (yardCount > 0 && (activeCount === 0 || yardCount >= 2 || phase === 'early')) {
    const startCellCoord = simulateTargetCoordinates(targetPlayer, tokens[targetPlayer].findIndex(t => t.pos === 0), 1);
    if (startCellCoord) {
      const threatAtStart = countThreats(startCellCoord, currentPlayer);
      if (threatAtStart === 0 || activeCount === 0) {
        activatePower('force_six');
        return true;
      }
    }
  }

  // ২. এজিস টেলিপোর্ট
  for (let i = 0; i < 4; i++) {
    const pos = tokens[targetPlayer][i].pos;
    if (pos > 25 && pos < 52 && isTokenCurrentlyThreatened(targetPlayer, i)) {
      const nextSafePos = getNearestSafeZonePos(targetPlayer, i);
      if (nextSafePos !== null) {
        const jumpDistance = nextSafePos - pos;
        if (jumpDistance >= 3 || pos >= 40) {
          activatePower('aegis_teleport');
          setTimeout(() => onTokenTapped(currentPlayer, i), 300);
          return true;
        }
      }
    }
  }

  // ৩. সুইফ্ট লিপ
  for (let i = 0; i < 4; i++) {
    const pos = tokens[targetPlayer][i].pos;
    if (pos > 0 && pos + 6 <= 57) {
      const targetCoord = simulateTargetCoordinates(targetPlayer, i, pos + 6);
      if (!targetCoord) continue;

      const isTargetSafe = isCoordinateSafe(targetCoord[0], targetCoord[1]);
      const isCurrentlyThreatened = isTokenCurrentlyThreatened(targetPlayer, i);

      if (pos + 6 === 57) {
        activatePower('swift_leap');
        setTimeout(() => onTokenTapped(currentPlayer, i), 300);
        return true;
      }

      let canLeapCapture = false;
      if (!isTargetSafe) {
        activeOrder.forEach(opp => {
          if (opp === currentPlayer || areTeammates(currentPlayer, opp)) return;
          tokens[opp].forEach(oppToken => {
            if (oppToken.pos > 0 && oppToken.pos < 57) {
              const oppCoord = getTokenCoordinates(opp, tokens[opp].indexOf(oppToken));
              if (oppCoord[0] === targetCoord[0] && oppCoord[1] === targetCoord[1]) {
                canLeapCapture = true;
              }
            }
          });
        });
      }

      if (canLeapCapture) {
        activatePower('swift_leap');
        setTimeout(() => onTokenTapped(currentPlayer, i), 300);
        return true;
      }

      if (isCurrentlyThreatened && isTargetSafe) {
        activatePower('swift_leap');
        setTimeout(() => onTokenTapped(currentPlayer, i), 300);
        return true;
      }
    }
  }

  return false;
}

// Pawn Selection — হিউম্যানাইজড + কৌশলী চৌকস সংস্করণ
function executeBotPawnSelection(choices) {
  _resetSimCache();
  const w = getEffectiveWeights(currentPlayer);

  let targetPlayer = currentPlayer;
  if (isTeamMode && checkPlayerFinish(currentPlayer)) {
    targetPlayer = getTeammate(currentPlayer);
  }

  const phase = getGamePhase(targetPlayer);
  const scoredChoices = [];

  choices.forEach(idx => {
    const token = tokens[targetPlayer][idx];
    const currentPos = token.pos;
    const targetPos = currentPos === 0 ? 1 : currentPos + diceValue;
    const targetCoord = simulateTargetCoordinates(targetPlayer, idx, targetPos);

    if (!targetCoord) return;

    const capture = evaluateCapture(currentPlayer, targetPlayer, idx, targetCoord, targetPos, phase, w);
    const leaderPressure = evaluateLeaderPressure(currentPlayer, targetPlayer, idx, targetCoord, targetPos, w);
    let threat = evaluateThreat(currentPlayer, targetPlayer, idx, targetCoord, targetPos, w);
    const safety = evaluateSafety(currentPlayer, targetPlayer, idx, targetCoord, currentPos, targetPos, w);
    const progress = evaluateProgress(currentPlayer, targetPlayer, idx, currentPos, targetPos, phase, diceValue, w);
    const finish = evaluateFinish(currentPlayer, targetPlayer, idx, targetPos, w);
    const distribution = evaluateDistribution(currentPlayer, targetPlayer, idx, targetCoord, w);
    const team = evaluateTeam(currentPlayer, targetPlayer, idx, targetCoord, targetPos, w);
    const future = evaluateFuture(currentPlayer, targetPlayer, idx, targetPos, phase, w);
    let counterRisk = evaluateCounterRisk(currentPlayer, targetPlayer, idx, targetPos, targetCoord, w);

    // ★ Calculated Risk-Taking: বড় পুরস্কার (ক্যাপচার/ফিনিশ/লিডার-টার্গেট)
    // থাকলে ঝুঁকির পেনাল্টি সামান্য ছাড় পায় — মানুষের মতো "সাহসী কিন্তু হিসেবি" সিদ্ধান্ত
    const rewardSignal = capture + finish + leaderPressure;
    if (rewardSignal > 0 && w.riskTolerance > 0) {
      const discount = Math.min(0.6, w.riskTolerance * (rewardSignal / 1000));
      threat *= (1 - discount);
      counterRisk *= (1 - discount);
    }

    const totalScore = capture + leaderPressure + threat + safety + progress +
      finish + distribution + team + future + counterRisk;

    scoredChoices.push({ index: idx, score: totalScore });
  });

  scoredChoices.sort((a, b) => b.score - a.score);

  // Human-like Decision Making (personality/momentum-aware mistake rate)
  let selectedIndex = scoredChoices[0].index;
  if (scoredChoices.length > 1) {
    const best = scoredChoices[0];
    const secondBest = scoredChoices[1];
    const scoreDiff = best.score - secondBest.score;
    const isCloseMatch = scoreDiff < w.mistakeAbsThreshold ||
      (best.score !== 0 && (scoreDiff / Math.abs(best.score)) < w.mistakeRatioThreshold);

    if (isCloseMatch && Math.random() < w.mistakeChance) {
      selectedIndex = secondBest.index;
    }
  }

  // ★ Variable Thinking Delay: কঠিন/কাছাকাছি সিদ্ধান্তে বেশি সময়, সহজ চালে দ্রুত
  const delay = _computeThinkingDelay(scoredChoices);
  setTimeout(() => onTokenTapped(currentPlayer, selectedIndex), delay);
}

/**
 * সিদ্ধান্তের জটিলতা অনুযায়ী "চিন্তার বিরতি" হিসাব করে।
 * সেরা ও দ্বিতীয়-সেরা চালের স্কোর যত কাছাকাছি, বট তত বেশি
 * "দ্বিধায়" পড়ে — ঠিক মানুষের মতো।
 */
function _computeThinkingDelay(scoredChoices) {
  if (scoredChoices.length <= 1) {
    return 250 + Math.random() * 200; // একটাই অপশন, দ্রুত চাল
  }
  const diff = Math.abs(scoredChoices[0].score - scoredChoices[1].score);
  const hesitation = Math.max(0, 850 - diff * 3);
  return 300 + hesitation + Math.random() * 300;
}

/*************************************************************
 * 10. REWIND RETREAT & PIECE HOPPING ENGINE
 *************************************************************/
async function animateCapture(opp, tokenIdx) {
  const el = document.getElementById(`token-${opp}-${tokenIdx}`);
  if (!el) return;
  
  playSound('sad'); // টোকেন মার খাওয়ার হতাশাজনক সুরটি এখানে শুরুতে একবার বাজবে
  el.classList.add('capturing');
  const startPos = tokens[opp][tokenIdx].pos;
  const stepDelay = Math.max(100, Math.min(200, 240 / startPos));
  
  for (let p = startPos - 1; p >= 0; p--) {
    tokens[opp][tokenIdx].pos = p;
    updateTokenPositions();
    await delay(stepDelay);
  }
  el.classList.remove('capturing');
}

async function onTokenTapped(player, idx) {
  if (mpIsActive && !mpIsHost) {
    mpSendAction('token', { player, idx });
    return;
  }
  if (player !== currentPlayer || isMoving) {
    playSound('error'); // নিজের চাল না হওয়া সত্ত্বেও গুটি ট্যাপ করলে এরর সাউন্ড দেবে
    return;
  }
  
  let targetPlayer = player;
  if (isTeamMode && checkPlayerFinish(player)) {
    targetPlayer = getTeammate(player);
  }

  // অ্যাক্টিভ কসমিক পাওয়ার মুভমেন্ট হ্যান্ডেলিং
  if (activePowerSelected) {
    const tokenObj = tokens[targetPlayer][idx];
    
    if (activePowerSelected === 'swift_leap') {
      if (tokenObj.pos <= 0 || tokenObj.pos + 6 > 57) return;
      
      playSound('click');
      powerCharges[player]--;
      activePowerSelected = null;
      clearHighlighting();
      isMoving = true;
      
      const totalSteps = tokenObj.pos + 6;
      const el = document.getElementById(`token-${targetPlayer}-${idx}`);
      
      for (let s = tokenObj.pos + 1; s <= totalSteps; s++) {
        tokenObj.pos = s;
        updateTokenPositions();
        playSound('hop');
        triggerHaptic('tap');
        if (el) el.classList.add('hopping');
        await delay(120);
        if (el) el.classList.remove('hopping');
      }
      isMoving = false;
      await evaluateStepLanding(player, idx);
      return;
    }
    
    if (activePowerSelected === 'aegis_teleport') {
      const targetPos = getNearestSafeZonePos(targetPlayer, idx);
      if (!targetPos) return;
      
      playSound('click');
      powerCharges[player]--;
      activePowerSelected = null;
      clearHighlighting();
      isMoving = true;
      
      const el = document.getElementById(`token-${targetPlayer}-${idx}`);
      const stepDelay = Math.max(60, 240 / (targetPos - tokenObj.pos));
      
      for (let s = tokenObj.pos + 1; s <= targetPos; s++) {
        tokenObj.pos = s;
        updateTokenPositions();
        playSound('hop');
        triggerHaptic('tap');
        if (el) el.classList.add('hopping');
        await delay(stepDelay);
        if (el) el.classList.remove('hopping');
      }
      isMoving = false;
      await evaluateStepLanding(player, idx);
      return;
    }
  }

  // সাধারণ স্ট্যান্ডার্ড টার্ন মুভমেন্ট
  if (!diceRolled) {
    playSound('error'); // ডাইস না রোল করে সরাসরি গুটি ট্যাপ করলে এরর সাউন্ড দেবে
    return;
  }
  const legalChoices = getPlayableTokens(player, diceValue);
  if (!legalChoices.includes(idx)) {
    playSound('error'); // অচল বা অবৈধ গুটি ট্যাপ করলে এরর সাউন্ড দেবে
    return;
  }
  
  clearHighlighting();
  isMoving = true;
  
  const stepsToMove = diceValue;
  const tokenObj = tokens[targetPlayer][idx];
  const el = document.getElementById(`token-${targetPlayer}-${idx}`);
  
  if (tokenObj.pos === 0 && stepsToMove === 6) {
    tokenObj.pos = 1;
    updateTokenPositions();
    playSound('hop');
    triggerHaptic('tap');
    await delay(250);
  } else {
    const totalSteps = tokenObj.pos + stepsToMove;
    for (let s = tokenObj.pos + 1; s <= totalSteps; s++) {
      tokenObj.pos = s;
      updateTokenPositions();
      playSound('hop');
      triggerHaptic('tap');
      
      if (el) el.classList.add('hopping');
      await delay(160);
      if (el) el.classList.remove('hopping');
    }
  }
  
  isMoving = false;
  await evaluateStepLanding(player, idx);
}

async function evaluateStepLanding(player, idx) {
  let targetPlayer = player;
  if (isTeamMode && checkPlayerFinish(player)) {
    targetPlayer = getTeammate(player);
  }
  
  const curCoord = getTokenCoordinates(targetPlayer, idx);
  const isSafe = isCoordinateSafe(curCoord[0], curCoord[1]);
  let capturedOpponent = false;
  let capturesAccumulated = 0;
  
  if (!isSafe) {
    const toCapture = [];
    activeOrder.forEach(opp => {
      if (opp === player || areTeammates(player, opp)) return; // টিমমেট হলে কাটবে না
      for (let i = 0; i < 4; i++) {
        if (tokens[opp][i].pos > 0 && tokens[opp][i].pos < 57) {
          const oppCoord = getTokenCoordinates(opp, i);
          if (oppCoord[0] === curCoord[0] && oppCoord[1] === curCoord[1]) {
            toCapture.push({ opp, i });
          }
        }
      }
    });
    
    if (toCapture.length > 0) {
      capturedOpponent = true;
      capturesAccumulated = toCapture.length;
      playSound('capture');
      triggerHaptic('hit');
      
      for (const item of toCapture) {
        await animateCapture(item.opp, item.i);
      }
    }
  }
  
  // কসমিক চার্জ ক্যালকুলেশন
  if (capturedOpponent) {
    captureCounts[player] += capturesAccumulated;
    if (captureCounts[player] >= 4) {
      const extraCharges = Math.floor(captureCounts[player] / 4);
      powerCharges[player] += extraCharges;
      captureCounts[player] %= 4;
      triggerPowerUpCelebration(player, extraCharges);
    }
    
    updateTokenPositions();
    setTimeout(() => setTurnState(currentPlayer), 400);
    return;
  }
  
  if (tokens[targetPlayer][idx].pos === 57) {
    playSound('win');
    triggerHaptic('victory');
    
    if (isTeamMode) {
      if (checkTeamFinish(player)) {
        winners.push(player);
        const mate = getTeammate(player);
        if (mate && !winners.includes(mate)) winners.push(mate);
        endGame();
        return;
      }
    } else {
      if (checkPlayerFinish(player)) {
        winners.push(player);
        if (winners.length >= activeOrder.length - 1) {
          endGame();
          return;
        }
      }
    }
    
    setTimeout(() => setTurnState(currentPlayer), 300);
    return;
  }
  
  if (diceRolled && diceValue === 6) {
    setTimeout(() => setTurnState(currentPlayer), 450);
  } else {
    passTurn();
  }
}

function isCoordinateSafe(col, row) {
  return SAFE_ZONES.some(s => s[0] === col && s[1] === row);
}

function countThreats(targetCoord, movingPlayer) {
  if (isCoordinateSafe(targetCoord[0], targetCoord[1])) return 0;
  
  let threatCount = 0;
  activeOrder.forEach(opp => {
    if (opp === movingPlayer || areTeammates(movingPlayer, opp)) return;
    
    tokens[opp].forEach((oToken, oIdx) => {
      if (oToken.pos <= 0 || oToken.pos >= 52) return;
      
      for (let roll = 1; roll <= 6; roll++) {
        const futurePos = oToken.pos + roll;
        const futureCoord = simulateTargetCoordinates(opp, oIdx, futurePos);
        if (futureCoord && futureCoord[0] === targetCoord[0] && futureCoord[1] === targetCoord[1]) {
          threatCount++;
        }
      }
    });
  });
  
  return threatCount;
}

function isTokenCurrentlyThreatened(player, tokenIdx) {
  const pos = tokens[player][tokenIdx].pos;
  if (pos <= 0 || pos >= 52) return false;
  const coord = getTokenCoordinates(player, tokenIdx);
  return countThreats(coord, player) > 0;
}

function getNearestSafeZonePos(player, tokenIdx) {
  const currentPos = tokens[player][tokenIdx].pos;
  if (currentPos <= 0 || currentPos >= 51) return null;
  
  for (let futurePos = currentPos + 1; futurePos <= 51; futurePos++) {
    const coord = simulateTargetCoordinates(player, tokenIdx, futurePos);
    if (isCoordinateSafe(coord[0], coord[1])) {
      return futurePos;
    }
  }
  return null;
}

function checkPlayerFinish(player) {
  return tokens[player].every(t => t.pos === 57);
}

function checkTeamFinish(player) {
  if (!isTeamMode) return checkPlayerFinish(player);
  const teammate = getTeammate(player);
  return checkPlayerFinish(player) && checkPlayerFinish(teammate);
}

function passTurn() {
  clearHighlighting();
  consecutiveSixes = 0;
  
  let nextIndex = currentTurnIndex;
  let iterations = 0;
  
  do {
    nextIndex = (nextIndex + 1) % activeOrder.length;
    iterations++;
  } while (checkPlayerFinish(activeOrder[nextIndex]) && (!isTeamMode) && iterations < activeOrder.length);
  
  currentTurnIndex = nextIndex;
  setTurnState(activeOrder[currentTurnIndex]);
}

/*************************************************************
 * 11. POWER ACTION HUB INTERFACES
 *************************************************************/
function activatePower(type) {
  if (powerCharges[currentPlayer] <= 0 || isMoving) return;
  
  playSound('click');
  
  let targetPlayer = currentPlayer;
  if (isTeamMode && checkPlayerFinish(currentPlayer)) {
    targetPlayer = getTeammate(currentPlayer);
  }

  if (type === 'force_six') {
    powerCharges[currentPlayer]--;
    nextRollForcedValue = 6;
    showNotification("🎲 COSMIC SIX", "A cosmic roll has been summoned! Next roll will guarantee a 6.", "gold");
    updatePowerHubUI();
  } else if (type === 'swift_leap') {
    activePowerSelected = 'swift_leap';
    showNotification("🏃 SWIFT LEAP", "Select one of your active track tokens to leap 6 spaces forward!", "gold");
    
    const indices = [];
    for (let i = 0; i < 4; i++) {
      const pos = tokens[targetPlayer][i].pos;
      if (pos > 0 && pos + 6 <= 57) indices.push(i);
    }
    highlightPlayableTokens(indices);
  } else if (type === 'aegis_teleport') {
    activePowerSelected = 'aegis_teleport';
    showNotification("🛡️ AEGIS SHIELD", "Select one active track token to warp directly onto the next safe zone!", "gold");
    
    const indices = [];
    for (let i = 0; i < 4; i++) {
      if (getNearestSafeZonePos(targetPlayer, i) !== null) indices.push(i);
    }
    highlightPlayableTokens(indices);
  }
}

function updatePowerHubUI() {
  const hub = document.getElementById('power-hub');
  const countSpan = document.getElementById('power-charge-count');
  const btnSix = document.getElementById('btn-power-six');
  const btnLeap = document.getElementById('btn-power-leap');
  const btnAegis = document.getElementById('btn-power-aegis');
  
  if (!hub) return;
  
  const charges = powerCharges[currentPlayer] || 0;
  if (countSpan) countSpan.innerText = charges;
  
  const isHuman = playerSettings[currentPlayer] === 'human';
  
  if (isHuman && (charges > 0 || activePowerSelected)) {
    hub.classList.remove('hidden');
    hub.className = `power-hub active-glow active-${currentPlayer}`;
  } else {
    hub.classList.add('hidden');
  }

  if (charges <= 0 && !activePowerSelected) {
    if (btnSix) btnSix.disabled = true;
    if (btnLeap) btnLeap.disabled = true;
    if (btnAegis) btnAegis.disabled = true;
    return;
  }
  
  let targetPlayer = currentPlayer;
  if (isTeamMode && checkPlayerFinish(currentPlayer)) {
    targetPlayer = getTeammate(currentPlayer);
  }

  if (btnSix) btnSix.disabled = diceRolled;
  
  const hasActiveLeap = tokens[targetPlayer].some(t => t.pos > 0 && t.pos + 6 <= 57);
  if (btnLeap) btnLeap.disabled = !hasActiveLeap || diceRolled;
  
  let hasSafeTeleport = false;
  for (let i = 0; i < 4; i++) {
    if (getNearestSafeZonePos(targetPlayer, i) !== null) {
      hasSafeTeleport = true;
      break;
    }
  }
  if (btnAegis) btnAegis.disabled = !hasSafeTeleport || diceRolled;
}

function showNotification(title, message, themeClass) {
  const toast = document.createElement('div');
  toast.className = `custom-toast ${themeClass}`;
  toast.innerHTML = `<strong>${title}</strong><p>${message}</p>`;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 50);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

function triggerPowerUpCelebration(player, charges) {
  playSound('powerup');
  showNotification("⚡ COSMIC POWER EARNED!", `${PLAYER_CONFIGS[player].name} got ${charges} Power Charge(s) for consecutive captures!`, "gold");
}

/*************************************************************
 * 12. RESET CONTROLS & SYSTEM BOOTSTRAP
 *************************************************************/
function openResetModal() {
  playSound('click');
  saveMatchState();
  document.getElementById('game-screen').classList.add('hidden');
  document.getElementById('home-screen').classList.add('hidden');
  document.getElementById('splash-screen').classList.remove('hidden');
  updateSplashCta();
  renderStatsLine();
}

function endGame() {
  clearMatchState();
  playSound('victory'); // ম্যাচ শেষ হওয়ার সাথে সাথে রাজকীয় কর্ড বাজবে
  recordMatchResult(isTeamMode ? winners.slice(0, 2) : [winners[0]]);

  const container = document.getElementById('podium-list');
  if (!container) return;
  container.innerHTML = '';
  
  if (isTeamMode) {
    const team1Won = winners.includes('red') || winners.includes('yellow');
    const winningTeamName = team1Won ? "RED & YELLOW (Alpha)" : "GREEN & BLUE (Beta)";
    const winningTeamColor = team1Won ? "var(--color-red)" : "var(--color-green)";
    const losingTeamName = team1Won ? "GREEN & BLUE (Beta)" : "RED & YELLOW (Alpha)";
    const losingTeamColor = team1Won ? "var(--color-green)" : "var(--color-red)";
    
    const winCard = document.createElement('div');
    winCard.className = "podium-item";
    winCard.style.borderColor = winningTeamColor;
    winCard.innerHTML = `<span style="color: ${winningTeamColor}; font-weight: 900;">🏆 VICTORY</span><span style="color: white;">Team ${winningTeamName}</span>`;
    container.appendChild(winCard);
    
    const loseCard = document.createElement('div');
    loseCard.className = "podium-item";
    loseCard.style.borderColor = losingTeamColor;
    loseCard.innerHTML = `<span style="color: var(--text-dim); font-weight: 700;">2nd Place</span><span style="color: var(--text-dim);">Team ${losingTeamName}</span>`;
    container.appendChild(loseCard);
  } else {
    winners.forEach((p, index) => {
      const card = document.createElement('div');
      card.className = "podium-item";
      card.style.color = PLAYER_CONFIGS[p].color;
      card.innerHTML = `<span>${index + 1}st Place</span><span>${PLAYER_CONFIGS[p].name} (${playerSettings[p].toUpperCase()})</span>`;
      container.appendChild(card);
    });
    
    activeOrder.forEach(p => {
      if (!winners.includes(p)) {
        const card = document.createElement('div');
        card.className = "podium-item";
        card.style.color = PLAYER_CONFIGS[p].color;
        card.innerHTML = `<span>Runner Up</span><span>${PLAYER_CONFIGS[p].name} (${playerSettings[p].toUpperCase()})</span>`;
        container.appendChild(card);
      }
    });
  }

  const modal = document.getElementById('podium-modal');
  if (modal) modal.classList.remove('hidden');
}

function resetDiceUI() {
  activeOrder.forEach(player => {
    const cube = document.getElementById(`cube-${player}`);
    if (cube) cube.style.transform = `rotateX(0deg) rotateY(0deg)`;
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/*************************************************************
 * 13. HOME SCREEN ENHANCEMENTS (Persistence, Theme, Utilities)
 *************************************************************/
function loadStats() {
  try {
    return JSON.parse(localStorage.getItem('ludoRoyale_stats')) ||
      { matchesPlayed: 0, wins: { red: 0, green: 0, yellow: 0, blue: 0 } };
  } catch (e) {
    return { matchesPlayed: 0, wins: { red: 0, green: 0, yellow: 0, blue: 0 } };
  }
}

function recordMatchResult(winnerList) {
  const stats = loadStats();
  stats.matchesPlayed++;
  winnerList.forEach(p => { if (p && stats.wins[p] !== undefined) stats.wins[p]++; });
  localStorage.setItem('ludoRoyale_stats', JSON.stringify(stats));
}

function renderStatsLine() {
  const el = document.getElementById('splash-stats-line');
  if (!el) return;
  const stats = loadStats();
  el.textContent = stats.matchesPlayed > 0 ? `🏆 ${stats.matchesPlayed} matches played` : '';
}

function saveMatchState() {
  if (!activeOrder.length) return;
  const state = {
    playerSettings, isTeamMode, activeOrder, currentTurnIndex, currentPlayer,
    tokens, captureCounts, powerCharges, winners, consecutiveSixes
  };
  try {
    localStorage.setItem('ludoRoyale_matchState', JSON.stringify(state));
  } catch (e) {}
}

function clearMatchState() {
  localStorage.removeItem('ludoRoyale_matchState');
}

function hasSavedMatch() {
  return !!localStorage.getItem('ludoRoyale_matchState');
}

function resumeMatch() {
  const raw = localStorage.getItem('ludoRoyale_matchState');
  if (!raw) return;
  let state;
  try { state = JSON.parse(raw); } catch (e) { return; }

  playSound('click');
  Object.assign(playerSettings, state.playerSettings);
  isTeamMode = state.isTeamMode;
  activeOrder = state.activeOrder;
  currentTurnIndex = state.currentTurnIndex;
  currentPlayer = state.currentPlayer;
  Object.keys(state.tokens).forEach(p => tokens[p] = state.tokens[p]);
  Object.assign(captureCounts, state.captureCounts);
  Object.assign(powerCharges, state.powerCharges);
  winners.length = 0;
  winners.push(...state.winners);
  consecutiveSixes = state.consecutiveSixes || 0;

  document.getElementById('splash-screen').classList.add('hidden');
  document.getElementById('home-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.remove('hidden');

  document.querySelectorAll('.yard').forEach(yard => yard.style.opacity = '0.08');
  activeOrder.forEach(player => {
    const y = document.getElementById(`yard-${player}`);
    if (y) y.style.opacity = '1';
  });
  const badge = document.getElementById('team-status-indicator');
  if (badge) badge.innerText = isTeamMode ? "TEAM MATCH (Red+Yellow vs Green+Blue)" : "SOLO MATCH";

  generateGridCells();
  generateTokenElements();
  updateTokenPositions();
  resetDiceUI();
  setTurnState(currentPlayer);
}

function saveLastConfig() {
  try {
    localStorage.setItem('ludoRoyale_lastConfig', JSON.stringify({ playerSettings, isTeamMode }));
  } catch (e) {}
}

function hasLastConfig() {
  return !!localStorage.getItem('ludoRoyale_lastConfig');
}

function quickPlay() {
  const raw = localStorage.getItem('ludoRoyale_lastConfig');
  if (!raw) return;
  try {
    const cfg = JSON.parse(raw);
    Object.assign(playerSettings, cfg.playerSettings);
    isTeamMode = cfg.isTeamMode;
  } catch (e) { return; }

  playSound('click');
  activeOrder = [];
  if (playerSettings.red !== 'off') activeOrder.push('red');
  if (playerSettings.green !== 'off') activeOrder.push('green');
  if (playerSettings.yellow !== 'off') activeOrder.push('yellow');
  if (playerSettings.blue !== 'off') activeOrder.push('blue');

  document.getElementById('splash-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.remove('hidden');
  restartGame();
}

function updateSplashCta() {
  const primaryBtn = document.getElementById('primary-cta-btn');
  const secondaryLink = document.getElementById('secondary-cta-link');
  if (!primaryBtn || !secondaryLink) return;

  if (hasSavedMatch()) {
    primaryBtn.textContent = 'RESUME MATCH';
    primaryBtn.onclick = resumeMatch;
    secondaryLink.textContent = 'Start New Match';
    secondaryLink.onclick = () => { clearMatchState(); goToLobby(); };
    secondaryLink.classList.remove('hidden');
  } else if (hasLastConfig()) {
    primaryBtn.textContent = 'QUICK REMATCH';
    primaryBtn.onclick = quickPlay;
    secondaryLink.textContent = 'Custom Setup';
    secondaryLink.onclick = goToLobby;
    secondaryLink.classList.remove('hidden');
  } else {
    primaryBtn.textContent = 'PLAY';
    primaryBtn.onclick = goToLobby;
    secondaryLink.classList.add('hidden');
  }
}

function previewEmblem() {
  playSound('click');
  const el = document.querySelector('.splash-emblem');
  if (!el) return;
  el.classList.add('emblem-spin');
  setTimeout(() => el.classList.remove('emblem-spin'), 700);
}

function previewSoundToggle() {
  const soundToggle = document.getElementById('sound-toggle');
  if (soundToggle && soundToggle.checked) playSound('click');
}

function previewVibeToggle() {
  const vibeToggle = document.getElementById('vibe-toggle');
  if (vibeToggle && vibeToggle.checked) triggerHaptic('tap');
}

function applyTheme(theme) {
  document.body.classList.toggle('light-theme', theme === 'light');
  const icon = document.getElementById('theme-toggle-icon');
  if (icon) icon.textContent = theme === 'light' ? '☀️' : '🌙';
}

function loadTheme() {
  applyTheme(localStorage.getItem('ludoRoyale_theme') || 'dark');
}

function toggleTheme() {
  playSound('click');
  const newTheme = document.body.classList.contains('light-theme') ? 'dark' : 'light';
  applyTheme(newTheme);
  localStorage.setItem('ludoRoyale_theme', newTheme);
}

function toggleFullscreen() {
  playSound('click');
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

document.addEventListener('fullscreenchange', () => {
  const icon = document.getElementById('fullscreen-icon');
  if (icon) icon.textContent = document.fullscreenElement ? '⤢' : '⛶';
});

/*************************************************************
 * 14. HOTSPOT MULTIPLAYER (WebSocket)
 *************************************************************/
let mpSocket = null;
let mpIsHost = false;
let mpIsActive = false;

function mpConnect() {
  playSound('click');
  const statusEl = document.getElementById('mp-status-text');
  const wsUrl = `ws://${location.hostname}:3000`;

  mpSocket = new WebSocket(wsUrl);
  mpIsActive = true;

  mpSocket.onopen = () => {
    statusEl.innerText = '✅ সার্ভারের সাথে কানেক্ট হয়েছে, অপেক্ষা করছি...';
  };

  mpSocket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'role') {
      mpIsHost = data.role === 'host';
      statusEl.innerText = mpIsHost
        ? '👑 তুমি HOST। বন্ধুর কানেক্ট করার অপেক্ষায়...'
        : '🎮 তুমি যুক্ত হয়েছ। Host ম্যাচ শুরু করবে।';
    }

    if (data.type === 'player_joined') {
      statusEl.innerText = '🎉 বন্ধু যুক্ত হয়েছে! এখন START MATCH চাপো।';
    }

    if (data.type === 'state_sync' && !mpIsHost) {
      applyRemoteState(data.state);
    }

    if (data.type === 'action' && mpIsHost) {
      handleRemoteAction(data.action);
    }
  };

  mpSocket.onerror = () => {
    statusEl.innerText = '❌ কানেক্ট করা যায়নি। IP/নেটওয়ার্ক চেক করো।';
  };

  mpSocket.onclose = () => {
    statusEl.innerText = '⚠️ সংযোগ বিচ্ছিন্ন হয়েছে।';
  };
}

// Host: প্রতি turn/move এর পর পুরো board state broadcast করবে
function mpBroadcastState() {
  if (!mpIsActive || !mpIsHost || !mpSocket || mpSocket.readyState !== 1) return;
  mpSocket.send(JSON.stringify({
    type: 'state_sync',
    state: {
      tokens, currentPlayer, currentTurnIndex, diceValue, diceRolled,
      activeOrder, winners, captureCounts, isTeamMode
    }
  }));
}

// Client: Host থেকে আসা state দিয়ে নিজের বোর্ড আপডেট করবে
function applyRemoteState(state) {
  Object.keys(state.tokens).forEach(p => tokens[p] = state.tokens[p]);
  currentPlayer = state.currentPlayer;
  currentTurnIndex = state.currentTurnIndex;
  diceValue = state.diceValue;
  diceRolled = state.diceRolled;
  activeOrder = state.activeOrder;
  isTeamMode = state.isTeamMode;
  Object.assign(captureCounts, state.captureCounts);

  if (document.getElementById('game-screen').classList.contains('hidden')) {
    document.getElementById('home-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    generateGridCells();
    generateTokenElements();
  }
  updateTokenPositions();
  setTurnState(currentPlayer);
}

// Client: নিজের turn-এ dice/token চাপলে Host-কে জানাবে, নিজে হিসাব করবে না
function mpSendAction(type, payload) {
  if (!mpIsActive || mpIsHost || !mpSocket || mpSocket.readyState !== 1) return false;
  mpSocket.send(JSON.stringify({ type: 'action', action: { type, payload } }));
  return true;
}

// Host: Client থেকে আসা action পেয়ে আসল গেম-লজিক চালাবে
function handleRemoteAction(action) {
  if (action.type === 'dice') {
    onDiceTriggered(action.payload.player);
  } else if (action.type === 'token') {
    onTokenTapped(action.payload.player, action.payload.idx);
  }
}

// System Bootstrapping
validateLobbySettings();
generateGridCells();
loadTheme();
updateSplashCta();
renderStatsLine();
/*************************************************************
 * SERVICE WORKER REGISTRATION (PWA)
 *************************************************************/
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('Service Worker registered successfully. Scope:', reg.scope);
      })
      .catch((err) => {
        console.error('Service Worker registration failed:', err);
      });
  });
}