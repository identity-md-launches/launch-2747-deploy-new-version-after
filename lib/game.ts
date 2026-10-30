// The browser and server share this fixed-step simulation; client scores are never trusted.
export const STEP_MS = 20;
export const CHECKPOINT_STEPS = 400;
export const MAX_CHUNK_STEPS = 600;
export const TAU = Math.PI * 2;
export type Move = { step: number; direction: -1 | 0 | 1 };
export type Packet = { id: number; angle: number; born: number; travelSteps: number; kind: 'seed' | 'glitch'; resolved: boolean };
export type Game = {
  step: number; angle: number; direction: number; lives: number; catches: number; combo: number;
  score: number; packets: Packet[]; seed: number; next: number; serial: number; ended: boolean;
  hitAt: number; caughtAt: number; lastCatchAngle: number;
};
function random(g: Game) {
  let t = g.seed += 0x6D2B79F5;
  t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
export function difficultyAt(step: number) {
  const seconds = Math.max(0,step)*STEP_MS/1000;
  const multiplier = 1 + seconds / 60 * 0.65;
  return { multiplier, stage: 1 + Math.floor(seconds / 20),
    travelSteps: Math.max(22,Math.round(100 / multiplier)),
    spawnInterval: Math.max(18,Math.round(60 / (1 + seconds / 60 * 0.95))),
    hazardChance: Math.min(.95,.35 + seconds / 120 * .5) };
}
export function verifyRunTiming(started: number, finished: number, steps: number) {
  const elapsed = finished - started, expected = steps * STEP_MS;
  if (elapsed < expected - 750) throw new Error('The replay timing is too fast for this run.');
  if (elapsed > expected + 8000) throw new Error('Run timing expired. Keep ranked runs at normal speed with the tab active.');
}
export function createGame(seed: number): Game {
  return { step: 0, angle: Math.PI / 2, direction: 0, lives: 3, catches: 0, combo: 0,
    score: 0, packets: [], seed: seed >>> 0, next: 50, serial: 0, ended: false,
    hitAt: -100, caughtAt: -100, lastCatchAngle: 0 };
}
export function distance(a: number, b: number) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}
export function steerDirection(angle: number, target: number): -1 | 0 | 1 {
  const delta = Math.atan2(Math.sin(target - angle), Math.cos(target - angle));
  return Math.abs(delta) <= 0.035 ? 0 : delta > 0 ? 1 : -1;
}
export function tick(g: Game) {
  if (g.ended) return;
  g.step++; g.angle = (g.angle + g.direction * 0.068 + TAU) % TAU;
  const pace = difficultyAt(g.step);
  if (g.step >= g.next) {
    const angle = random(g) * TAU;
    g.packets.push({ id: g.serial++, angle, born: g.step, travelSteps: pace.travelSteps, kind: 'seed', resolved: false });
    if (g.step > 300 && random(g) < pace.hazardChance) g.packets.push({ id: g.serial++, angle: (angle + 0.72 + random(g) * 1.4) % TAU, born: g.step + 10, travelSteps: pace.travelSteps, kind: 'glitch', resolved: false });
    g.next = g.step + pace.spawnInterval;
  }
  for (const p of g.packets) {
    if (p.resolved || g.step - p.born < p.travelSteps) continue;
    p.resolved = true;
    const caught = distance(g.angle, p.angle) < 0.26;
    if (caught && p.kind === 'seed') {
      g.catches++; g.combo++; g.score += 50 + Math.min(5, Math.floor(g.combo / 3)) * 10;
      g.caughtAt = g.step; g.lastCatchAngle = p.angle;
    } else if (caught && p.kind === 'glitch') { g.lives--; g.combo = 0; g.hitAt = g.step; }
    else if (p.kind === 'seed') g.combo = 0;
  }
  g.packets = g.packets.filter(p => g.step - p.born < p.travelSteps + 20);
  if (g.lives <= 0) g.ended = true;
}
export function replayChunk(state: Game, moves: Move[], throughStep: number, finished: boolean) {
  const start=state.step;
  if (!Number.isSafeInteger(throughStep) || throughStep <= start || throughStep-start > MAX_CHUNK_STEPS || !Array.isArray(moves) || moves.length > MAX_CHUNK_STEPS) throw new Error('Invalid replay chunk.');
  let previous = start-1;
  for (const m of moves) {
    if (!m || !Number.isInteger(m.step) || m.step <= previous || m.step < start || m.step >= throughStep || ![-1, 0, 1].includes(m.direction)) throw new Error('Invalid inputs.');
    previous = m.step;
  }
  const g:Game=JSON.parse(JSON.stringify(state)); let at = 0;
  while (g.step < throughStep && !g.ended) {
    if (moves[at]?.step === g.step) g.direction = moves[at++].direction;
    tick(g);
  }
  if (g.step !== throughStep || g.ended !== finished) throw new Error('Replay does not match the run outcome.');
  return g;
}
