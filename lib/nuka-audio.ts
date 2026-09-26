import type { Grade } from "./scoring";
export class NukaAudio {
  private context: AudioContext | null = null;
  muted = false;
  unlock() {
    this.context ??= new AudioContext();
    if (this.context.state === "suspended") void this.context.resume();
  }
  hit(grade: Grade, combo: number) {
    if (this.muted) return;
    this.unlock();
    const ctx = this.context!, now = ctx.currentTime;
    const master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
    const thud = ctx.createOscillator(), envelope = ctx.createGain();
    thud.frequency.setValueAtTime(grade === "soft" ? 135 : 205, now);
    thud.frequency.exponentialRampToValueAtTime(48, now + 0.10);
    envelope.gain.setValueAtTime(0.6, now); envelope.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    thud.connect(envelope).connect(master); thud.start(now); thud.stop(now + 0.16);
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.15), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.024));
    const noise = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), ng = ctx.createGain();
    noise.buffer = buffer; filter.type = "lowpass"; filter.frequency.value = 1800; ng.gain.value = 0.18;
    noise.connect(filter).connect(ng).connect(master); noise.start(now);
    if (grade !== "soft") {
      const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
      const base = notes[Math.floor(combo / 3) % notes.length];
      (grade === "perfect" ? [1, 2, 3.01] : [1, 2]).forEach((ratio, index) => {
        const oscillator = ctx.createOscillator(), gain = ctx.createGain();
        oscillator.type = "sine"; oscillator.frequency.value = base * ratio;
        gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(0.25 / (index + 1), now + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.001, now + (grade === "perfect" ? 0.75 : 0.38) / (index + 1));
        oscillator.connect(gain).connect(master); oscillator.start(now); oscillator.stop(now + 0.85);
      });
    }
    setTimeout(() => master.disconnect(), 1100);
  }
  dispose() {
    if (this.context && this.context.state !== "closed") void this.context.close().catch(() => {});
    this.context = null;
  }
}
