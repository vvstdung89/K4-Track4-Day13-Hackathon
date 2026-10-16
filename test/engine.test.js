import { test } from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "../web/engine.js";

const DT = 33; // ~30 Hz
const OPEN = { ear: 0.3, mar: 0.02, yaw: 5, pitch: 12 }; // a laptop webcam reads ~12 deg of pitch at rest
const CALIB = { earOpen: 0.3, marClosed: 0.02, yaw0: 5, pitch0: 12 };

// Feeds `ms` of samples built by `make(i)`; returns the last output. Keeps its own clock on the engine's test handle.
function feed(e, ms, make = () => ({})) {
  const t0 = (e.t ?? 0);
  let out;
  for (let t = DT; t <= ms; t += DT) {
    e.t = t0 + t;
    out = e.step({ t: e.t, face: true, ...OPEN, ...make(t) });
  }
  return out;
}
const withCalibration = (config = {}) => Object.assign(createEngine({ calibration: CALIB, ...config }), { t: 0 });
const states = (e, ms, make) => {
  const seen = [];
  for (let t = DT; t <= ms; t += DT) seen.push(feed(e, DT, () => make(t)).state);
  return seen;
};

test("calibration: 10 s of an open-eyed face learns earOpen, marClosed and the normal pose", () => {
  const e = Object.assign(createEngine(), { t: 0 });
  assert.equal(e.step({ t: 0, face: false }).phase, "wait");
  const mid = feed(e, 5000);
  assert.equal(mid.phase, "calibrate");
  assert.equal(mid.state, "TINH");
  const out = feed(e, 5500);
  assert.equal(out.phase, "run");
  assert.ok(Math.abs(e.calibration.earOpen - 0.3) < 1e-9);
  assert.ok(Math.abs(e.calibration.marClosed - 0.02) < 1e-9);
  assert.equal(e.calibration.yaw0, 5);
  assert.equal(e.calibration.pitch0, 12);
});

test("thresholds follow earOpen: 0.3 -> close below 0.165, reopen above 0.21", () => {
  const e = withCalibration();
  const out = feed(e, 100);
  assert.ok(Math.abs(out.thresholds.closeBelow - 0.165) < 1e-9);
  assert.ok(Math.abs(out.thresholds.reopenAbove - 0.21) < 1e-9);
});

test("calibration is rejected when the eyes look closed (earOpen out of range) and retried", () => {
  const e = Object.assign(createEngine(), { t: 0 });
  const out = feed(e, 10500, () => ({ ear: 0.1 }));
  assert.equal(out.phase, "calibrate");
  assert.equal(out.calib.failed, true);
  assert.equal(e.calibration, null);
});

test("calibration is rejected when the face is missing for too long", () => {
  const e = Object.assign(createEngine(), { t: 0 });
  feed(e, 100); // face seen -> calibrate starts
  const out = feed(e, 10500, (t) => (t < 4000 ? {} : { face: false }));
  assert.equal(out.calib.failed, true);
  assert.equal(e.calibration, null);
});

test("a preset calibration skips straight to run; recalibrate goes back to wait", () => {
  const e = withCalibration();
  assert.equal(feed(e, 100).phase, "run");
  e.recalibrate();
  assert.equal(e.step({ t: e.t + DT, face: true, ...OPEN }).phase, "calibrate");
});

test("eyes closed (EAR 0.1): CANH_BAO only after 1.5 s", () => {
  const e = withCalibration();
  feed(e, 1000);
  const seen = states(e, 2000, () => ({ ear: 0.1 }));
  const first = seen.indexOf("CANH_BAO");
  assert.ok(first >= 0);
  const at = (first + 1) * DT;
  assert.ok(at >= 1400 && at <= 1700, `alarm at ${at} ms`);
});

test("a 300 ms blink never alerts", () => {
  const e = withCalibration();
  feed(e, 1000);
  assert.ok(!states(e, 300, () => ({ ear: 0.1 })).includes("CANH_BAO"));
  assert.equal(feed(e, 2000).state, "TINH");
});

test("hysteresis: EAR 0.19 (between 0.165 and 0.21) keeps whichever side it came from", () => {
  const e = withCalibration();
  feed(e, 500);
  // came from open -> stays open: no closed time accumulates
  assert.equal(feed(e, 3000, () => ({ ear: 0.19 })).signals.closedMs, 0);
  // came from closed -> stays closed
  const e2 = withCalibration();
  feed(e2, 500);
  feed(e2, 300, () => ({ ear: 0.1 }));
  assert.ok(feed(e2, 1000, () => ({ ear: 0.19 })).signals.closedMs > 1000);
});

test("head turned beyond the limit (relative to the calibrated pose) is untrusted and resets the closed timer", () => {
  const e = withCalibration();
  feed(e, 500);
  feed(e, 1000, () => ({ ear: 0.1 })); // 1 s closed, no alarm yet
  const turned = feed(e, 600, () => ({ ear: 0.1, yaw: CALIB.yaw0 + 30 }));
  assert.equal(turned.trusted, false);
  assert.equal(turned.signals.closedMs, 0);
  // back to the front, closed again for 1 s: 1 s + 1 s must not add up to an alarm
  assert.ok(!states(e, 1000, () => ({ ear: 0.1 })).includes("CANH_BAO"));
});

test("angles are relative: a resting pitch of 12 deg is fine, 12 + 25 is not", () => {
  const e = withCalibration();
  assert.equal(feed(e, 200).trusted, true);
  assert.equal(feed(e, 200, () => ({ pitch: 12 + 25 })).trusted, false);
});

test("trust: false ignores head angles (for the on/off comparison)", () => {
  const e = withCalibration({ trust: false });
  const out = feed(e, 2500, () => ({ ear: 0.1, yaw: CALIB.yaw0 + 40 }));
  assert.equal(out.trusted, true);
  assert.equal(out.state, "CANH_BAO");
});

test("an alarm is held up to 3 s while untrusted, then falls to TINH", () => {
  const e = withCalibration();
  feed(e, 500);
  feed(e, 2000, () => ({ ear: 0.1 }));
  const held = feed(e, 2500, () => ({ ear: 0.1, yaw: CALIB.yaw0 + 40 }));
  assert.equal(held.state, "CANH_BAO");
  assert.equal(held.trusted, false);
  const gone = feed(e, 1500, () => ({ ear: 0.1, yaw: CALIB.yaw0 + 40 }));
  assert.equal(gone.state, "TINH");
});

test("de-escalation drops one level at a time, after 3 s each", () => {
  const e = withCalibration();
  feed(e, 500);
  feed(e, 2000, () => ({ ear: 0.1 })); // CANH_BAO
  assert.equal(feed(e, 2500).state, "CANH_BAO"); // 2.5 s of calm: still held
  assert.equal(feed(e, 1000).state, "CHU_Y"); // ~3.5 s of calm: one level down
  assert.equal(feed(e, 3500).state, "TINH"); // another 3 s: back to TINH
});

test("a yawn needs 2 s of an open mouth; 1.5 s does not count", () => {
  const e = withCalibration();
  feed(e, 500);
  assert.ok(!states(e, 1500, () => ({ mar: 0.6 })).includes("CHU_Y"));
  const e2 = withCalibration();
  feed(e2, 500);
  assert.ok(states(e2, 2300, () => ({ mar: 0.6 })).includes("CHU_Y"));
});

test("PERCLOS: closing 1 s in every 5 s (20%) gives CHU_Y, never CANH_BAO", () => {
  const e = withCalibration();
  const cycle = (t) => ({ ear: t % 5000 < 1000 ? 0.1 : 0.3 });
  const seen = states(e, 40000, cycle);
  assert.ok(seen.includes("CHU_Y"));
  assert.ok(!seen.includes("CANH_BAO"));
});

test("PERCLOS: closing 1.4 s in every 3.5 s (40%) raises CANH_BAO without a long single closure", () => {
  const e = withCalibration();
  const seen = states(e, 40000, (t) => ({ ear: t % 3500 < 1400 ? 0.1 : 0.3 }));
  assert.ok(seen.includes("CANH_BAO"));
});

test("PERCLOS needs 20 s of trusted data before it counts", () => {
  const e = withCalibration();
  const early = states(e, 15000, (t) => ({ ear: t % 3500 < 1400 ? 0.1 : 0.3 }));
  assert.ok(!early.includes("CANH_BAO"));
});

test("replay is deterministic: same samples, same states", () => {
  const make = (t) => ({ ear: t % 4000 < 1700 ? 0.1 : 0.3, yaw: t % 9000 < 700 ? 40 : 5 });
  const run = () => states(withCalibration(), 30000, make).join(",");
  assert.equal(run(), run());
});
