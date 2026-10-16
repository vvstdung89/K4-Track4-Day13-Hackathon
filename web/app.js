import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs";
import { LEFT_EYE, RIGHT_EYE, eyeBox, smoothBox } from "./eyes.js";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm";
const MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const ACCENT = "#3fd0a0";

const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const statusEl = document.getElementById("status");
const eyesPane = document.getElementById("eyes-pane");
const eyes = [
  { idx: LEFT_EYE, canvas: document.getElementById("left-eye"), box: null },
  { idx: RIGHT_EYE, canvas: document.getElementById("right-eye"), box: null },
];

async function main() {
  const fileset = await FilesetResolver.forVisionTasks(WASM);
  const landmarker = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL, delegate: "CPU" },
    runningMode: "VIDEO",
    numFaces: 1,
  });

  statusEl.textContent = "Requesting camera…";
  video.srcObject = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
    audio: false,
  });
  await new Promise((r) => (video.onloadeddata = r));
  overlay.width = video.videoWidth;
  overlay.height = video.videoHeight;

  let lastTime = -1, lastFrame = performance.now(), fps = 0;
  function loop() {
    if (video.currentTime !== lastTime) {
      lastTime = video.currentTime;
      const now = performance.now();
      const face = landmarker.detectForVideo(video, now).faceLandmarks[0];
      fps = fps * 0.9 + (1000 / (now - lastFrame)) * 0.1;
      lastFrame = now;
      draw(face);
      statusEl.textContent = `${face ? "Face found" : "No face"} · ${fps.toFixed(0)} fps`;
    }
    requestAnimationFrame(loop);
  }
  loop();
}

function draw(face) {
  const ctx = overlay.getContext("2d");
  const W = overlay.width, H = overlay.height;
  ctx.clearRect(0, 0, W, H);
  eyesPane.dataset.face = face ? "1" : "0";
  if (!face) {
    eyes.forEach((e) => (e.box = null));
    return;
  }

  for (const e of eyes) {
    const pts = e.idx.map((i) => face[i]);
    e.box = smoothBox(e.box, eyeBox(pts, W, H));
    const b = e.box;

    // video pane: eye contour + crop box
    contour(ctx, pts.map((p) => [p.x * W, p.y * H]), 2);
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.setLineDash([]);

    // eyes pane: zoomed crop + contour
    const c = e.canvas, ec = c.getContext("2d");
    const sx = c.width / b.w, sy = c.height / b.h;
    ec.fillStyle = "#000";
    ec.fillRect(0, 0, c.width, c.height);
    ec.drawImage(video, b.x, b.y, b.w, b.h, 0, 0, c.width, c.height);
    contour(ec, pts.map((p) => [(p.x * W - b.x) * sx, (p.y * H - b.y) * sy]), 2);
  }
}

function contour(ctx, xy, width) {
  ctx.strokeStyle = ACCENT;
  ctx.fillStyle = ACCENT;
  ctx.lineWidth = width;
  ctx.beginPath();
  xy.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.stroke();
  for (const [x, y] of xy) ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
}

main().catch((err) => {
  statusEl.textContent = `Error: ${err.message}`;
  console.error(err);
});
