// Replays logs through the engine and measures it. Same code for the CLI and the page.
// A log: { scenario, name?, calibration | null, samples: [{ t, face, ear, mar, yaw, pitch, label }] }.
import { createEngine, median } from "./engine.js";

export const SCENARIOS = ["tinh-tao", "nhin-guong", "microsleep", "ngap", "dieu-kien-xau"];
const FALSE_ALARM_SCENARIOS = ["tinh-tao", "nhin-guong"]; // alerts here are false by definition
const EXPECT = { microsleep: 2, yawn: 1 }; // minimum level that counts as detecting the event
const LEVEL = { TINH: 0, CHU_Y: 1, CANH_BAO: 2 };
const GRACE_MS = 3000; // an alert may arrive this long after the key is released
const CONTEXT_MS = 3000; // look back this far from a false alarm to explain it

export const scenarioFromName = (name) => SCENARIOS.find((s) => name.startsWith(s)) ?? null;

// 95% Wilson score interval for hit / total; null when there is nothing to measure.
export function wilson(hit, total, z = 1.96) {
  if (!total) return null;
  const p = hit / total, z2 = z * z;
  const denom = 1 + z2 / total;
  const center = (p + z2 / (2 * total)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / total + z2 / (4 * total * total))) / denom;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

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

const pct = (v) => `${(v * 100).toFixed(0)}%`;
const secs = (ms) => `${(ms / 1000).toFixed(1)} s`;

// Rule-based hint for why an event was not detected. A starting point for a human, not a verdict.
function missCause(ev, win, cfg) {
  if (!win.length) return "chưa hiệu chuẩn xong trong đoạn này";
  const inside = win.filter((r) => r.t <= ev.t1); // while the key was held; the grace window after it would dilute this
  const untrusted = inside.filter((r) => !r.out.trusted).length / Math.max(1, inside.length);
  if (untrusted > 0.5) return `mất tin cậy ${pct(untrusted)} số khung (góc đầu lệch hoặc mất mặt)`;
  const { thresholds: th, calibration } = win[0].out;
  if (ev.name === "microsleep") {
    const minEar = Math.min(...win.filter((r) => r.s.face).map((r) => r.s.ear));
    if (minEar >= th.closeBelow) {
      return `EAR chỉ xuống ${pct(minEar / calibration.earOpen)} mức mở mắt, chưa dưới ngưỡng nhắm ${pct(cfg.closeRatio)}`;
    }
    return `nhắm liên tục chỉ ${secs(Math.max(...win.map((r) => r.out.signals.closedMs)))}, ngắn hơn ngưỡng ${secs(cfg.closedMs)}`;
  }
  const maxMar = Math.max(...win.filter((r) => r.s.face).map((r) => r.s.mar));
  if (maxMar <= th.yawnAbove) return `MAR chỉ đạt ${maxMar.toFixed(2)}, chưa vượt ngưỡng ngáp ${th.yawnAbove.toFixed(2)}`;
  return `há miệng chỉ ${secs(Math.max(...win.map((r) => r.out.signals.yawnMs)))}, ngắn hơn ngưỡng ${secs(cfg.yawnMs)}`;
}

function falseAlarmCause(row, context, cfg) {
  const { signals: g, calibration: c } = row.out;
  if (g.closedMs >= cfg.closedMs) {
    const tilt = Math.max(0, ...context.filter((r) => r.s.face).map((r) => Math.max(Math.abs(r.s.yaw - c.yaw0), Math.abs(r.s.pitch - c.pitch0))));
    return tilt >= 15
      ? `nhắm liên tục ${secs(g.closedMs)} khi đầu lệch ${tilt.toFixed(0)}°, dưới giới hạn tin cậy nên vẫn tính (mắt hẹp do góc nhìn?)`
      : `nhắm liên tục ${secs(g.closedMs)} ngoài sự kiện có nhãn (mắt nheo hoặc nhắm thật)`;
  }
  return `PERCLOS ${g.perclos === null ? "?" : pct(g.perclos)} vượt ngưỡng ${pct(cfg.perclosAlarm)} (chớp mắt nhiều hoặc nheo mắt kéo dài)`;
}

export function scoreLogs(logs, config = {}) {
  const recall = { microsleep: { hit: 0, total: 0 }, yawn: { hit: 0, total: 0 } };
  const latencies = [], failures = [];
  let falseAlarms = 0, quietMs = 0, trusted = 0, running = 0;

  for (const log of logs) {
    const engine = createEngine({ ...config, calibration: log.calibration ?? null });
    const rows = log.samples.map((s) => ({ t: s.t, s, out: engine.step(s) }));
    const run = rows.filter((r) => r.out.phase === "run");
    const events = eventsOf(log.samples);
    const level = (r) => LEVEL[r.out.state];
    trusted += run.filter((r) => r.out.trusted).length;
    running += run.length;

    for (const ev of events) {
      recall[ev.name].total++;
      const win = run.filter((r) => r.t >= ev.t0 && r.t <= ev.t1 + GRACE_MS);
      const first = win.find((r) => level(r) >= EXPECT[ev.name]);
      if (first) {
        recall[ev.name].hit++;
        if (ev.name === "microsleep") latencies.push(first.t - ev.t0);
      } else {
        failures.push({ kind: "miss", event: ev.name, scenario: log.scenario, file: log.name, t: ev.t0, cause: missCause(ev, win, engine.config) });
      }
    }

    if (FALSE_ALARM_SCENARIOS.includes(log.scenario) && run.length) {
      const inWindow = (t) => events.some((ev) => t >= ev.t0 && t <= ev.t1 + GRACE_MS);
      run.forEach((r, i) => {
        if (level(r) !== 2 || (i > 0 && level(run[i - 1]) === 2) || inWindow(r.t)) return;
        falseAlarms++;
        const context = run.filter((x) => x.t >= r.t - CONTEXT_MS && x.t <= r.t);
        failures.push({ kind: "false_alarm", scenario: log.scenario, file: log.name, t: r.t, cause: falseAlarmCause(r, context, engine.config) });
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
    failures,
  };
}

// The same logs with the trust check on and off.
export const compareTrust = (logs, config = {}) => ({
  on: scoreLogs(logs, { ...config, trust: true }),
  off: scoreLogs(logs, { ...config, trust: false }),
});
