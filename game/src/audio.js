// All sound is synthesised with WebAudio: no audio files, nothing fetched.
// Engine hum, sirens, gunshots, punches, pickups, mission jingles and a small
// bass-and-hats music loop. Created lazily on the first user gesture.
export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    muted: false,
    musicTimer: null,
    engineOsc: null,
    engineGain: null,
    sirenOn: false,
    sirenTimer: null,
    musicStep: 0,
  };

  audio.ensure = () => {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      audio.ctx = new AC();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = audio.muted ? 0 : 0.5;
      audio.master.connect(audio.ctx.destination);
      return true;
    } catch {
      return false;
    }
  };

  audio.toggleMute = () => {
    audio.muted = !audio.muted;
    if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.5;
    return audio.muted;
  };

  function tone(freq, dur, type, vol, slideTo) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    const o = audio.ctx.createOscillator();
    const g = audio.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(audio.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, freq) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    const len = Math.max(1, Math.floor(audio.ctx.sampleRate * dur));
    const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.ctx.createBufferSource();
    src.buffer = buf;
    const f = audio.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq || 1200;
    const g = audio.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(audio.master);
    src.start(t);
  }

  audio.shoot = () => noise(0.14, 0.5, 900);
  audio.punch = () => tone(90, 0.12, 'sine', 0.5, 50);
  audio.hit = () => tone(180, 0.08, 'square', 0.2, 90);
  audio.pickup = () => {
    tone(660, 0.09, 'sine', 0.25);
    setTimeout(() => tone(990, 0.12, 'sine', 0.25), 70);
  };
  audio.cash = () => {
    tone(880, 0.08, 'triangle', 0.25);
    setTimeout(() => tone(1174, 0.08, 'triangle', 0.25), 70);
    setTimeout(() => tone(1568, 0.16, 'triangle', 0.25), 140);
  };
  audio.deny = () => tone(140, 0.18, 'sawtooth', 0.25, 110);
  audio.carDoor = () => noise(0.08, 0.25, 500);
  audio.crash = () => noise(0.25, 0.5, 350);
  audio.explosion = () => {
    noise(0.7, 0.8, 220);
    tone(60, 0.6, 'sine', 0.6, 30);
  };
  audio.missionDone = () => {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.3), i * 110));
  };
  audio.missionFail = () => {
    [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'sawtooth', 0.2), i * 130));
  };
  audio.sirenBlip = () => {
    tone(950, 0.12, 'square', 0.08, 1250);
    setTimeout(() => tone(1250, 0.12, 'square', 0.08, 950), 130);
  };

  audio.setEngine = (on, speedRatio) => {
    if (!audio.ctx || audio.muted) {
      if (audio.engineOsc) {
        try { audio.engineOsc.stop(); } catch { /* already stopped */ }
        audio.engineOsc = null;
      }
      return;
    }
    if (on && !audio.engineOsc) {
      const o = audio.ctx.createOscillator();
      const g = audio.ctx.createGain();
      const f = audio.ctx.createBiquadFilter();
      o.type = 'sawtooth';
      o.frequency.value = 60;
      f.type = 'lowpass';
      f.frequency.value = 700;
      g.gain.value = 0.05;
      o.connect(f);
      f.connect(g);
      g.connect(audio.master);
      o.start();
      audio.engineOsc = o;
      audio.engineGain = g;
    }
    if (!on && audio.engineOsc) {
      try { audio.engineOsc.stop(); } catch { /* already stopped */ }
      audio.engineOsc = null;
      audio.engineGain = null;
      return;
    }
    if (audio.engineOsc) {
      audio.engineOsc.frequency.value = 55 + speedRatio * 140;
      audio.engineGain.gain.value = 0.03 + speedRatio * 0.05;
    }
  };

  // A lazy two-bar loop: root bass notes with a hat tick. Starts on first gesture.
  const BASS = [55, 55, 65.4, 49];
  audio.startMusic = () => {
    if (!audio.ctx || audio.musicTimer) return;
    audio.musicTimer = setInterval(() => {
      if (audio.muted || !audio.ctx) return;
      const step = audio.musicStep++ % 16;
      const bar = Math.floor(audio.musicStep / 16) % 4;
      if (step % 4 === 0) tone(BASS[bar], 0.5, 'triangle', 0.16);
      if (step % 2 === 1) noise(0.03, 0.05, 6000);
      if (step === 0 || step === 10) tone(BASS[bar] * 2, 0.12, 'sine', 0.08);
    }, 150);
  };

  return audio;
}
