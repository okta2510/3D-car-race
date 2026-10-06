class SoundEffectManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isMusicEnabled: boolean = true;

  // Engine sound nodes
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private isEngineRunning: boolean = false;

  // Nitro continuous sound
  private nitroNoise: AudioBufferSourceNode | null = null;
  private nitroGain: GainNode | null = null;
  private nitroFilter: BiquadFilterNode | null = null;
  private isNitroPlaying: boolean = false;
  private nitroStartTime: number = 0;

  // Background Music Engine
  private isMusicPlaying: boolean = false;
  private musicInterval: any = null;
  private musicStep: number = 0;
  private musicMasterGain: GainNode | null = null;

  constructor() {}

  private initContext(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      if (this.engineGain) this.engineGain.gain.setValueAtTime(0, this.ctx?.currentTime || 0);
      if (this.nitroGain) this.nitroGain.gain.setValueAtTime(0, this.ctx?.currentTime || 0);
      if (this.musicMasterGain) this.musicMasterGain.gain.setValueAtTime(0, this.ctx?.currentTime || 0);
    } else {
      if (this.musicMasterGain) this.musicMasterGain.gain.setValueAtTime(0.2, this.ctx?.currentTime || 0);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  // --- ENGINE AUDIO ---
  public startEngine() {
    if (this.isEngineRunning || this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      this.engineOsc = ctx.createOscillator();
      this.engineFilter = ctx.createBiquadFilter();
      this.engineGain = ctx.createGain();

      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.setValueAtTime(45, ctx.currentTime);

      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.setValueAtTime(320, ctx.currentTime);

      this.engineGain.gain.setValueAtTime(0.07, ctx.currentTime);

      this.engineOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(ctx.destination);

      this.engineOsc.start();
      this.isEngineRunning = true;
    } catch {}
  }

  public updateEnginePitch(speedNormalized: number, isNitro: boolean) {
    if (!this.isEngineRunning || !this.engineOsc || !this.engineGain || !this.ctx || this.isMuted) return;

    const baseFreq = 45;
    const targetFreq = isNitro ? 140 + speedNormalized * 90 : baseFreq + speedNormalized * 110;
    const targetGain = isNitro ? 0.11 : 0.05 + speedNormalized * 0.07;

    this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.08);
    this.engineGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.08);
  }

  public stopEngine() {
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
        this.engineOsc.disconnect();
      } catch {}
      this.engineOsc = null;
    }
    this.isEngineRunning = false;
  }

  // --- SMOOTH NITRO SOUND (Softened over time when held) ---
  public startNitroSound() {
    if (this.isNitroPlaying) {
      // Soften volume when held down continuously
      if (this.nitroGain && this.ctx && !this.isMuted) {
        const elapsed = (Date.now() - this.nitroStartTime) / 1000;
        // After 0.4s, gradually reduce volume down to 0.04 so it's not piercing/noisy
        const softVolume = Math.max(0.035, 0.12 - elapsed * 0.06);
        this.nitroGain.gain.setTargetAtTime(softVolume, this.ctx.currentTime, 0.1);
      }
      return;
    }

    const ctx = this.initContext();
    if (!ctx || this.isMuted) return;

    try {
      this.nitroStartTime = Date.now();
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      this.nitroNoise = ctx.createBufferSource();
      this.nitroNoise.buffer = buffer;
      this.nitroNoise.loop = true;

      // Warm futuristic jet bandpass filter
      this.nitroFilter = ctx.createBiquadFilter();
      this.nitroFilter.type = 'bandpass';
      this.nitroFilter.frequency.setValueAtTime(1100, ctx.currentTime);
      this.nitroFilter.Q.setValueAtTime(1.8, ctx.currentTime);

      this.nitroGain = ctx.createGain();
      // Gentle initial whoosh, not loud
      this.nitroGain.gain.setValueAtTime(0.12, ctx.currentTime);

      this.nitroNoise.connect(this.nitroFilter);
      this.nitroFilter.connect(this.nitroGain);
      this.nitroGain.connect(ctx.destination);

      this.nitroNoise.start();
      this.isNitroPlaying = true;
    } catch {}
  }

  public stopNitroSound() {
    if (!this.isNitroPlaying) return;
    if (this.nitroGain && this.ctx) {
      this.nitroGain.gain.setTargetAtTime(0.001, this.ctx.currentTime, 0.15);
    }
    setTimeout(() => {
      if (this.nitroNoise) {
        try {
          this.nitroNoise.stop();
          this.nitroNoise.disconnect();
        } catch {}
        this.nitroNoise = null;
      }
      this.isNitroPlaying = false;
    }, 180);
  }

  // --- TIRE SKID (For Oil Slick Swerve) ---
  public playTireSkid() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const bufferSize = Math.floor(ctx.sampleRate * 0.8);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.sin(i * 0.05);
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2400, ctx.currentTime);
      filter.frequency.linearRampToValueAtTime(1200, ctx.currentTime + 0.6);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.7);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start();
    } catch {}
  }

  public playCrash() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const bufferSize = Math.floor(ctx.sampleRate * 0.4);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.08));
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.45, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start();
    } catch {}
  }

  public playCoin() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, ctx.currentTime);
      osc.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    } catch {}
  }

  public playNitroPickup() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.25);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {}
  }

  public playVictory() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = ctx.currentTime + i * 0.12;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.25, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.4);
    });
  }

  // --- PROCEDURAL SYNTHWAVE GAMEPLAY MUSIC ---
  public startMusic() {
    if (this.isMusicPlaying) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      this.musicMasterGain = ctx.createGain();
      this.musicMasterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.18, ctx.currentTime);
      this.musicMasterGain.connect(ctx.destination);

      this.isMusicPlaying = true;
      this.musicStep = 0;

      // 128 BPM -> 16th note interval = (60 / 128) / 4 = 0.117s = 117ms
      const stepTimeMs = 117;

      // Cyberpunk chord roots: Am -> F -> C -> G (frequencies in Hz)
      const bassProgression = [
        [110, 110, 220, 110], // A2
        [87.31, 87.31, 174.6, 87.31], // F2
        [130.81, 130.81, 261.6, 130.81], // C3
        [98.0, 98.0, 196.0, 98.0], // G2
      ];

      const leadArp = [440, 523.25, 659.25, 880, 659.25, 523.25, 783.99, 659.25];

      this.musicInterval = setInterval(() => {
        if (!this.isMusicPlaying || !this.ctx || this.isMuted) return;

        const chordIdx = Math.floor((this.musicStep / 16) % 4);
        const subStep = this.musicStep % 4;
        const now = this.ctx.currentTime;

        // 1. Rolling Synthwave Bassline
        const bassFreq = bassProgression[chordIdx][subStep];
        this.playSynthNote(bassFreq, 'sawtooth', 0.15, 0.08, 380, now);

        // 2. Synth Melody Arpeggio (every 2nd step)
        if (this.musicStep % 2 === 0) {
          const arpNote = leadArp[Math.floor((this.musicStep / 2) % leadArp.length)];
          this.playSynthNote(arpNote, 'triangle', 0.07, 0.1, 1600, now);
        }

        // 3. Electronic Kick Drum on beats 0, 4, 8, 12
        if (this.musicStep % 4 === 0) {
          this.playKick(now);
        }

        // 4. Subtle Hi-Hat tap on 16th notes
        if (this.musicStep % 2 === 1) {
          this.playHiHat(now);
        }

        this.musicStep = (this.musicStep + 1) % 64;
      }, stepTimeMs);
    } catch {}
  }

  public stopMusic() {
    this.isMusicPlaying = false;
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }

  private playSynthNote(freq: number, type: OscillatorType, gainVal: number, duration: number, filterFreq: number, time: number) {
    if (!this.ctx || !this.musicMasterGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterFreq, time);

      gain.gain.setValueAtTime(gainVal, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicMasterGain);

      osc.start(time);
      osc.stop(time + duration);
    } catch {}
  }

  private playKick(time: number) {
    if (!this.ctx || !this.musicMasterGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.frequency.setValueAtTime(120, time);
      osc.frequency.exponentialRampToValueAtTime(35, time + 0.1);

      gain.gain.setValueAtTime(0.2, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

      osc.connect(gain);
      gain.connect(this.musicMasterGain);

      osc.start(time);
      osc.stop(time + 0.12);
    } catch {}
  }

  private playHiHat(time: number) {
    if (!this.ctx || !this.musicMasterGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'square';
      osc.frequency.setValueAtTime(8000, time);

      filter.type = 'highpass';
      filter.frequency.setValueAtTime(7000, time);

      gain.gain.setValueAtTime(0.02, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicMasterGain);

      osc.start(time);
      osc.stop(time + 0.04);
    } catch {}
  }
}

export const soundManager = new SoundEffectManager();
