// Per-frame features from MediaPipe results: EAR, MAR, head angles. Pure, no DOM.
import { LEFT_EAR, RIGHT_EAR, ear } from "./eyes.js";

// Inner mouth corners and three vertical lip pairs (inner lips).
const MOUTH_CORNERS = [78, 308];
const LIP_PAIRS = [[82, 87], [13, 14], [312, 317]];

// Mouth aspect ratio: mean lip opening / mouth width, in pixels.
export function mar(face, width, height) {
  const d = (a, b) => Math.hypot((face[a].x - face[b].x) * width, (face[a].y - face[b].y) * height);
  const opening = LIP_PAIRS.reduce((s, [a, b]) => s + d(a, b), 0) / LIP_PAIRS.length;
  return opening / d(...MOUTH_CORNERS);
}

// Yaw / pitch in degrees from MediaPipe's facial transformation matrix:
// 4x4, column-major (m[col * 4 + row]). Rotation is taken as Ry(yaw) * Rx(pitch);
// the formulas ignore uniform scale. Signs only matter relative to the calibrated pose.
export function headAngles(m) {
  const r02 = m[8], r12 = m[9], r22 = m[10];
  const deg = 180 / Math.PI;
  return { yaw: Math.atan2(r02, r22) * deg, pitch: Math.atan2(-r12, Math.hypot(r02, r22)) * deg };
}

// One engine input: { t, face, ear, mar, yaw, pitch }. Without a face only t and face are meaningful.
export function toSample(result, width, height, t) {
  const face = result.faceLandmarks[0];
  if (!face) return { t, face: false };
  const matrix = result.facialTransformationMatrixes?.[0]?.data;
  const { yaw, pitch } = matrix ? headAngles(matrix) : { yaw: 0, pitch: 0 };
  return {
    t,
    face: true,
    ear: (ear(LEFT_EAR.map((i) => face[i]), width, height) + ear(RIGHT_EAR.map((i) => face[i]), width, height)) / 2,
    mar: mar(face, width, height),
    yaw,
    pitch,
  };
}
