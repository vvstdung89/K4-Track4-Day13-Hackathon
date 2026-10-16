import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreLogs, compareTrust } from "../web/score.js";

const DT = 33;
const CALIBRATION = { earOpen: 0.3, marClosed: 0.02, yaw0: 5, pitch0: 12 };

// 30 Hz log of `seconds`; `at(t)` overrides fields; label comes from `label(t)`.
function makeLog(scenario, seconds, at = () => ({}), label = () => "") {
  const samples = [];
  for (let t = 0; t <= seconds * 1000; t += DT) {
    samples.push({ t, face: true, ear: 0.3, mar: 0.02, yaw: 5, pitch: 12, label: label(t), ...at(t) });
  }
  return { scenario, calibration: CALIBRATION, samples };
}
const inRange = (t, a, b) => t >= a && t <= b;

test("microsleep: a labelled 2 s closure is a hit, latency is key press -> first alarm", () => {
  const log = makeLog("microsleep", 30, (t) => (inRange(t, 10000, 12000) ? { ear: 0.1 } : {}), (t) => (inRange(t, 10000, 12000) ? "microsleep" : ""));
  const r = scoreLogs([log]);
  assert.deepEqual(r.recall.microsleep, { hit: 1, total: 1 });
  assert.ok(r.latencyMs > 1400 && r.latencyMs < 1800, `latency ${r.latencyMs}`);
});

test("yawn: a labelled 2.3 s open mouth reaches CHU_Y within the grace window", () => {
  const log = makeLog("ngap", 30, (t) => (inRange(t, 10000, 12300) ? { mar: 0.6 } : {}), (t) => (inRange(t, 10000, 12300) ? "yawn" : ""));
  assert.deepEqual(scoreLogs([log]).recall.yawn, { hit: 1, total: 1 });
});

test("a missed event counts in the total only", () => {
  const log = makeLog("microsleep", 30, () => ({}), (t) => (inRange(t, 10000, 12000) ? "microsleep" : ""));
  assert.deepEqual(scoreLogs([log]).recall.microsleep, { hit: 0, total: 1 });
});

test("false alarms/min: counted on tinh-tao and nhin-guong logs only, outside labelled windows", () => {
  const closed = (t) => (inRange(t, 10000, 12500) ? { ear: 0.1 } : {});
  const calm = scoreLogs([makeLog("tinh-tao", 60, closed)]);
  assert.equal(calm.falseAlarms.count, 1);
  assert.ok(calm.falseAlarms.perMin > 0.9 && calm.falseAlarms.perMin < 1.1, `${calm.falseAlarms.perMin}`);
  // same samples in a microsleep log: not a false alarm source
  assert.equal(scoreLogs([makeLog("microsleep", 60, closed)]).falseAlarms.count, 0);
});

test("trust check: looking at the mirror (eyes squint while the head is turned) alerts only with the check off", () => {
  const mirror = (t) => (inRange(t, 10000, 13000) ? { ear: 0.1, yaw: 5 + 40 } : {});
  const log = makeLog("nhin-guong", 60, mirror);
  const { on, off } = compareTrust([log]);
  assert.equal(on.falseAlarms.count, 0);
  assert.equal(off.falseAlarms.count, 1);
  assert.ok(on.coverage < off.coverage, `coverage on ${on.coverage} off ${off.coverage}`);
  assert.equal(off.coverage, 1);
});

test("coverage = share of trusted samples after calibration", () => {
  const log = makeLog("nhin-guong", 40, (t) => (inRange(t, 10000, 14000) ? { yaw: 50 } : {}));
  assert.ok(Math.abs(scoreLogs([log]).coverage - 0.9) < 0.01);
});

test("scoring is deterministic", () => {
  const log = makeLog("microsleep", 30, (t) => (inRange(t, 10000, 12000) ? { ear: 0.1 } : {}), (t) => (inRange(t, 10000, 12000) ? "microsleep" : ""));
  assert.deepEqual(scoreLogs([log]), scoreLogs([log]));
});

test("a log without a calibration header calibrates itself from its own samples", () => {
  const log = makeLog("tinh-tao", 30);
  log.calibration = null;
  const r = scoreLogs([log]);
  assert.equal(r.falseAlarms.count, 0);
  assert.ok(r.coverage > 0.5);
});
