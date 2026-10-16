import { test } from "node:test";
import assert from "node:assert/strict";
import { toCsv, parseCsv } from "../web/log.js";

const calibration = { earOpen: 0.3, marClosed: 0.02, yaw0: 5, pitch0: 12 };
const samples = [
  { t: 100, face: true, ear: 0.3012, mar: 0.02, yaw: 5.1, pitch: 12.2, label: "" },
  { t: 133, face: true, ear: 0.1, mar: 0.5, yaw: -3, pitch: 1, label: "microsleep" },
  { t: 166, face: false },
];

test("CSV round trip keeps samples, labels and calibration", () => {
  const back = parseCsv(toCsv(samples, { calibration }));
  assert.deepEqual(back.calibration, calibration);
  assert.equal(back.samples.length, 3);
  assert.equal(back.samples[0].t, 100);
  assert.ok(Math.abs(back.samples[0].ear - 0.3012) < 1e-4);
  assert.equal(back.samples[1].label, "microsleep");
  assert.equal(back.samples[0].label, "");
});

test("a sample without a face round-trips as face false with no numbers", () => {
  const s = parseCsv(toCsv(samples, { calibration })).samples[2];
  assert.equal(s.face, false);
  assert.equal(s.ear, undefined);
});

test("a log recorded before calibration finished has calibration null", () => {
  assert.equal(parseCsv(toCsv(samples, { calibration: null })).calibration, null);
});

test("header line and column names are stable (score.js and humans rely on them)", () => {
  const lines = toCsv(samples, { calibration }).split("\n");
  assert.equal(lines[0], "# earOpen=0.3,marClosed=0.02,yaw0=5,pitch0=12");
  assert.equal(lines[1], "t_ms,face,ear,mar,yaw,pitch,label_key");
});
