import { test } from "node:test";
import assert from "node:assert/strict";
import { eyeBox, smoothBox, ear, LEFT_EYE, RIGHT_EYE, LEFT_EAR, RIGHT_EAR } from "../web/eyes.js";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test("eye contours have 16 landmarks each", () => {
  assert.equal(LEFT_EYE.length, 16);
  assert.equal(RIGHT_EYE.length, 16);
});

test("eyeBox is centered on the eye, padded, with the requested aspect", () => {
  // wide eye: 0.1 x 0.02 of a 1000x500 frame -> 100 x 10 px, center (500, 250)
  const pts = [{ x: 0.45, y: 0.49 }, { x: 0.55, y: 0.51 }];
  const b = eyeBox(pts, 1000, 500, { aspect: 2, pad: 1.5 });
  near(b.x + b.w / 2, 500);
  near(b.y + b.h / 2, 250);
  near(b.w, 150); // width-limited: 100 * 1.5
  near(b.w / b.h, 2);
});

test("eyeBox grows width when the eye is tall (open wide)", () => {
  // 20 x 40 px eye -> height-limited: h = 40 * 1.5 = 60, w = 120
  const pts = [{ x: 0.49, y: 0.46 }, { x: 0.51, y: 0.54 }];
  const b = eyeBox(pts, 1000, 500, { aspect: 2, pad: 1.5 });
  near(b.h, 60);
  near(b.w, 120);
});

test("smoothBox blends toward the new box and passes through when no previous", () => {
  const next = { x: 10, y: 10, w: 100, h: 50 };
  assert.deepEqual(smoothBox(null, next, 0.5), next);
  const s = smoothBox({ x: 0, y: 0, w: 80, h: 40 }, next, 0.5);
  assert.deepEqual(s, { x: 5, y: 5, w: 90, h: 45 });
});

// p1..p6 in order: corner, upper, upper, corner, lower, lower
const eyePts = (w, h) => [
  { x: 0, y: 0 }, { x: w / 3, y: -h / 2 }, { x: (2 * w) / 3, y: -h / 2 },
  { x: w, y: 0 }, { x: (2 * w) / 3, y: h / 2 }, { x: w / 3, y: h / 2 },
];

test("EAR index lists have 6 landmarks each", () => {
  assert.equal(LEFT_EAR.length, 6);
  assert.equal(RIGHT_EAR.length, 6);
});

test("ear = lid opening / corner distance", () => {
  near(ear(eyePts(0.3, 0.09), 1, 1), 0.3); // (0.09 + 0.09) / (2 * 0.3)
  near(ear(eyePts(0.3, 0), 1, 1), 0); // closed
});

test("ear measures in pixels, not normalized units", () => {
  // normalized 0.1 wide x 0.05 tall on a 2:1 frame -> square in pixels -> EAR 1
  const pts = eyePts(0.1, 0.05).map((p) => ({ x: p.x + 0.5, y: p.y + 0.5 }));
  near(ear(pts, 1000, 2000), 1);
});
