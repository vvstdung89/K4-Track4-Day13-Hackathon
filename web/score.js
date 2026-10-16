// Replays logs through the engine and measures it. Same code for the CLI and the page.
// A log: { scenario, calibration | null, samples: [{ t, face, ear, mar, yaw, pitch, label }] }.
import { createEngine, median } from "./engine.js";

export const SCENARIOS = ["tinh-tao", "nhin-guong", "microsleep", "ngap", "dieu-kien-xau"];
const FALSE_ALARM_SCENARIOS = ["tinh-tao", "nhin-guong"]; // alerts here are false by definition
const EXPECT = { microsleep: 2, yawn: 1 }; // minimum level that counts as detecting the event
const LEVEL = { TINH: 0, CHU_Y: 1, CANH_BAO: 2 };
const GRACE_MS = 3000; // an alert may arrive this long after the key is released

export const scenarioFromName = (name) => SCENARIOS.find((s) => name.startsWith(s)) ?? null;

// Runs of the same non-empty label -> { name, t0, t1 }.
function eventsOf(samples) {
  const out = [];
  for (const s of samples) {
    const last = out[out.length - 1];
    if (s.label && last && last.name === s.label && last.open) last.t1 = s.t;
    else if (s.label) out.push({ name: s.label, t0: s.t, t1: s.t, open: true });
    else if (last) last.open = false;
  }
  return out.filter((e) => e.name in EXPECT);
}

export function scoreLogs(logs, config = {}) {
  const recall = { microsleep: { hit: 0, total: 0 }, yawn: { hit: 0, total: 0 } };
  const latencies = [];
  let falseAlarms = 0, quietMs = 0, trusted = 0, running = 0;

  for (const log of logs) {
    const engine = createEngine({ ...config, calibration: log.calibration ?? null });
    const rows = log.samples.map((s) => ({ t: s.t, out: engine.step(s) }));
    const run = rows.filter((r) => r.out.phase === "run");
    const events = eventsOf(log.samples);
    const level = (r) => LEVEL[r.out.state];
    trusted += run.filter((r) => r.out.trusted).length;
    running += run.length;

    for (const ev of events) {
      recall[ev.name].total++;
      const first = run.find((r) => r.t >= ev.t0 && r.t <= ev.t1 + GRACE_MS && level(r) >= EXPECT[ev.name]);
      if (!first) continue;
      recall[ev.name].hit++;
      if (ev.name === "microsleep") latencies.push(first.t - ev.t0);
    }

    if (FALSE_ALARM_SCENARIOS.includes(log.scenario) && run.length) {
      const inWindow = (t) => events.some((ev) => t >= ev.t0 && t <= ev.t1 + GRACE_MS);
      run.forEach((r, i) => {
        if (level(r) === 2 && (i === 0 || level(run[i - 1]) < 2) && !inWindow(r.t)) falseAlarms++;
      });
      quietMs += run[run.length - 1].t - run[0].t - events.reduce((s, ev) => s + ev.t1 + GRACE_MS - ev.t0, 0);
    }
  }

  const minutes = quietMs / 60000;
  return {
    recall,
    falseAlarms: { count: falseAlarms, minutes, perMin: minutes > 0 ? falseAlarms / minutes : null },
    latencyMs: latencies.length ? median(latencies) : null,
    coverage: running ? trusted / running : null,
  };
}

// The same logs with the trust check on and off.
export const compareTrust = (logs, config = {}) => ({
  on: scoreLogs(logs, { ...config, trust: true }),
  off: scoreLogs(logs, { ...config, trust: false }),
});
