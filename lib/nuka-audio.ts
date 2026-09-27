import { STATIONS, type StationId } from "./nuka-physics";

export class NukaAudio {
  private context: AudioContext | null = null;
  muted = false;
  unlock() {
    this.context ??= new AudioContext();
    if (this.context.state === "suspended") void this.context.resume().catch(() => {});
  }
  insert(stationId: StationId = "standard") {
    if (this.muted || !this.context || this.context.state !== "running") return;
    const ctx = this.context, now = ctx.currentTime;
    const texture = STATIONS.find(s => s.id === stationId)!;
    const length = stationId === "sticky" ? 0.85 : stationId === "silky" ? 0.3 : 0.55;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.23, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + length);
    gain.connect(ctx.destination);
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * length), ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(); noise.buffer = buffer;
    const filter = ctx.createBiquadFilter(); filter.type = "lowpass";
    filter.frequency.setValueAtTime((1500 + Math.random() * 500) * texture.tone, now);
    filter.frequency.exponentialRampToValueAtTime(140 * texture.tone, now + length * 0.85);
    filter.Q.value = 1.8;
    noise.connect(filter); filter.connect(gain); noise.start(now);
    const tone = ctx.createOscillator(), volume = ctx.createGain();
    tone.type = "sine";
    tone.frequency.setValueAtTime((320 + Math.random() * 70) * texture.tone, now);
    tone.frequency.exponentialRampToValueAtTime(65 * texture.tone, now + 0.24);
    volume.gain.setValueAtTime(0.14, now);
    volume.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    tone.connect(volume); volume.connect(ctx.destination); tone.start(now); tone.stop(now + 0.36);
    noise.onended = () => { noise.disconnect(); filter.disconnect(); gain.disconnect(); };
    tone.onended = () => { tone.disconnect(); volume.disconnect(); };
  }
  dispose() {
    if (this.context && this.context.state !== "closed") void this.context.close().catch(() => {});
    this.context = null;
  }
}
