// WebAudio synth sound: engine hum, sirens, gunshots, pickups, jingles.
// No audio files, no network. Created lazily on the first user gesture.

export function createAudio() {
  const audio = {
    ctx: null,
    muted: false,
    engine: null,
    engineGain: null,
    siren: null,
    sirenGain: null,
    ensure() {
      if (audio.ctx) {
        if (audio.ctx.state === 'suspended') audio.ctx.resume();
        return;
      }
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audio.ctx = new Ctx();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.ctx.destination);
      // Engine: sawtooth whose pitch follows speed.
      audio.engine = audio.ctx.createOscillator();
      audio.engine.type = 'sawtooth';
      audio.engine.frequency.value = 60;
      audio.engineGain = audio.ctx.createGain();
      audio.engineGain.gain.value = 0;
      audio.engine.connect(audio.engineGain);
      audio.engineGain.connect(audio.master);
      audio.engine.start();
      // Siren: two-tone triangle, quiet until wanted.
      audio.siren = audio.ctx.createOscillator();
      audio.siren.type = 'triangle';
      audio.siren.frequency.value = 660;
      audio.sirenGain = audio.ctx.createGain();
      audio.sirenGain.gain.value = 0;
      audio.siren.connect(audio.sirenGain);
      audio.sirenGain.connect(audio.master);
      audio.siren.start();
      audio.sirenPhase = 0;
    },
    setEngine(speed01) {
      if (!audio.ctx || audio.muted) return;
      audio.engine.frequency.value = 55 + speed01 * 130;
      audio.engineGain.gain.value = 0.015 + speed01 * 0.03;
    },
    setSiren(on, dt) {
      if (!audio.ctx) return;
      if (!on) { audio.sirenGain.gain.value = 0; return; }
      audio.sirenPhase += dt;
      const high = Math.floor(audio.sirenPhase * 1.6) % 2 === 0;
      audio.siren.frequency.value = high ? 720 : 540;
      audio.sirenGain.gain.value = audio.muted ? 0 : 0.02;
    },
    blip(freq, dur, type, vol) {
      if (!audio.ctx || audio.muted) return;
      const t = audio.ctx.currentTime;
      const osc = audio.ctx.createOscillator();
      const gain = audio.ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol || 0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(audio.master);
      osc.start(t);
      osc.stop(t + dur);
    },
    noise(dur, vol) {
      if (!audio.ctx || audio.muted) return;
      const t = audio.ctx.currentTime;
      const len = Math.floor(audio.ctx.sampleRate * dur);
      const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = audio.ctx.createBufferSource();
      src.buffer = buf;
      const gain = audio.ctx.createGain();
      gain.gain.value = vol || 0.15;
      src.connect(gain);
      gain.connect(audio.master);
      src.start(t);
    },
    shot() { audio.noise(0.12, 0.22); audio.blip(160, 0.08, 'square', 0.1); },
    pickup() { audio.blip(880, 0.09, 'sine', 0.1); audio.blip(1320, 0.12, 'sine', 0.08); },
    cash() { audio.blip(660, 0.07, 'sine', 0.09); setTimeout(() => audio.blip(990, 0.1, 'sine', 0.09), 70); },
    jingle() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => audio.blip(f, 0.16, 'triangle', 0.1), i * 110)); },
    busted() { [392, 311, 233].forEach((f, i) => setTimeout(() => audio.blip(f, 0.22, 'sawtooth', 0.08), i * 160)); },
    toggleMute() {
      audio.muted = !audio.muted;
      if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.5;
      return audio.muted;
    },
  };
  return audio;
}
