// Eye geometry on MediaPipe Face Mesh landmarks (468 points, normalized 0..1).
// "Left"/"right" are the driver's own eyes (MediaPipe convention).

export const LEFT_EYE = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
export const RIGHT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];

// Crop box (pixels) around the given points: centered, padded, fixed aspect (w / h).
export function eyeBox(points, width, height, { aspect = 1.6, pad = 1.8 } = {}) {
  const xs = points.map((p) => p.x * width);
  const ys = points.map((p) => p.y * height);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  let w = (x1 - x0) * pad;
  let h = w / aspect;
  if ((y1 - y0) * pad > h) {
    h = (y1 - y0) * pad;
    w = h * aspect;
  }
  return { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - h / 2, w, h };
}

// Exponential moving average of two boxes; alpha = weight of the new box.
export function smoothBox(prev, next, alpha = 0.4) {
  if (!prev) return next;
  const mix = (k) => prev[k] + (next[k] - prev[k]) * alpha;
  return { x: mix("x"), y: mix("y"), w: mix("w"), h: mix("h") };
}
