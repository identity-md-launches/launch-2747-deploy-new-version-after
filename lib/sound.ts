// A short, falling square-wave impact mixed with crunchy LFSR noise.
// Sample-and-hold at 8 kHz and 8-bit amplitude steps give it a cartridge sound.
export function hitSamples(sampleRate: number): Float32Array {
  const duration = .2, samples = new Float32Array(Math.ceil(sampleRate * duration));
  let held = 0, previous = -1, phase = 0, noise = 0xace1;
  for (let i = 0; i < samples.length; i++) {
    const t = i / sampleRate, bucket = Math.floor(t * 8000);
    if (bucket !== previous) {
      previous = bucket;
      const pitch = 260 * Math.pow(38 / 260, t / duration);
      phase = (phase + pitch / 8000) % 1;
      noise = (noise >>> 1) ^ (-(noise & 1) & 0xb400);
      const wave = (phase < .5 ? 1 : -1) * .68 + (noise / 32767.5 - 1) * .32;
      const envelope = Math.min(1, t / .004) * (1 - t / duration) ** 2;
      held = Math.round(wave * envelope * .18 * 127) / 127;
    }
    samples[i] = held;
  }
  return samples;
}
