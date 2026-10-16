import { test } from "node:test";
import assert from "node:assert/strict";
import { mar, headAngles, toSample } from "../web/features.js";
import { LEFT_EAR, RIGHT_EAR } from "../web/eyes.js";

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const blank = () => Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));

// mouth: inner corners 78 / 308, vertical pairs (82,87) (13,14) (312,317)
function mouth(width, gap) {
  const f = blank();
  f[78] = { x: 0.4, y: 0.7 };
  f[308] = { x: 0.4 + width, y: 0.7 };
  for (const [a, b] of [[82, 87], [13, 14], [312, 317]]) {
    f[a] = { x: 0.5, y: 0.7 - gap / 2 };
    f[b] = { x: 0.5, y: 0.7 + gap / 2 };
  }
  return f;
}

test("mar = mean lip opening / mouth width, in pixels", () => {
  near(mar(mouth(0.1, 0), 1, 1), 0);
  near(mar(mouth(0.1, 0.05), 1, 1), 0.5);
  // 2:1 frame: normalized gap 0.05 is 100 px tall, width 0.1 is 100 px wide -> 1
  near(mar(mouth(0.1, 0.05), 1000, 2000), 1);
});

// column-major 4x4 (as MediaPipe returns it) from Ry(yaw) * Rx(pitch), uniform scale s, translation t
function matrix(yawDeg, pitchDeg, s = 1) {
  const [y, p] = [yawDeg, pitchDeg].map((d) => (d * Math.PI) / 180);
  const Ry = [[Math.cos(y), 0, Math.sin(y)], [0, 1, 0], [-Math.sin(y), 0, Math.cos(y)]];
  const Rx = [[1, 0, 0], [0, Math.cos(p), -Math.sin(p)], [0, Math.sin(p), Math.cos(p)]];
  const R = Ry.map((row) => [0, 1, 2].map((c) => row[0] * Rx[0][c] + row[1] * Rx[1][c] + row[2] * Rx[2][c]));
  const m = new Array(16).fill(0);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) m[c * 4 + r] = R[r][c] * s;
  m[12] = 1.5; m[13] = -2; m[14] = -30; m[15] = 1; // translation
  return m;
}

test("headAngles recovers yaw and pitch, ignores scale and translation", () => {
  for (const [yaw, pitch, s] of [[0, 0, 1], [30, 0, 1], [-25, 10, 1.7], [15, -20, 0.6], [40, 25, 1]]) {
    const a = headAngles(matrix(yaw, pitch, s));
    near(a.yaw, yaw, 1e-4);
    near(a.pitch, pitch, 1e-4);
  }
});

test("toSample: no face -> face false, no NaN in the numeric fields used downstream", () => {
  const s = toSample({ faceLandmarks: [] }, 640, 480, 1234);
  assert.equal(s.t, 1234);
  assert.equal(s.face, false);
});

test("toSample: ear is the mean of both eyes; angles come from the matrix", () => {
  const f = blank();
  // left eye wide open (EAR 0.4), right eye half (EAR 0.2): corners 100 px apart in a 1000x1000 frame
  const set = (idx, open) => {
    const [p1, p2, p3, p4, p5, p6] = idx;
    f[p1] = { x: 0.1, y: 0.5 }; f[p4] = { x: 0.2, y: 0.5 };
    f[p2] = { x: 0.13, y: 0.5 - open / 2 }; f[p3] = { x: 0.17, y: 0.5 - open / 2 };
    f[p6] = { x: 0.13, y: 0.5 + open / 2 }; f[p5] = { x: 0.17, y: 0.5 + open / 2 };
  };
  set(LEFT_EAR, 0.08); // opening 80 px / corners 100 px -> EAR 0.8 * ... see below
  set(RIGHT_EAR, 0.04);
  const s = toSample(
    { faceLandmarks: [f], facialTransformationMatrixes: [{ data: matrix(12, -7) }] },
    1000, 1000, 5,
  );
  assert.equal(s.face, true);
  near(s.ear, (0.8 + 0.4) / 2); // (|p2-p6| + |p3-p5|) / (2|p1-p4|) = opening / width
  near(s.yaw, 12, 1e-4);
  near(s.pitch, -7, 1e-4);
  assert.equal(typeof s.mar, "number");
});
