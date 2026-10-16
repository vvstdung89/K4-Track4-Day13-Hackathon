import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs";
import { LEFT_EYE, RIGHT_EYE, LEFT_EAR, RIGHT_EAR, eyeBox, smoothBox, ear } from "./eyes.js";
import { toSample } from "./features.js";
import { createEngine } from "./engine.js";
import { toCsv, parseCsv } from "./log.js";
import { compareTrust, scenarioFromName } from "./score.js";
import { reportRows } from "./report.js";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm";
const MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const ACCENT = "#3fd0a0";
const CHART_SECONDS = 10, CHART_MAX = 0.5;

const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const statusEl = document.getElementById("status");
const eyesPane = document.getElementById("eyes-pane");
const avgEl = document.getElementById("avg-ear");
const chart = document.getElementById("ear-chart");
const eyes = [
  { idx: LEFT_EYE, earIdx: LEFT_EAR, canvas: document.getElementById("left-eye"), label: document.getElementById("left-ear"), box: null },
  { idx: RIGHT_EYE, earIdx: RIGHT_EAR, canvas: document.getElementById("right-eye"), label: document.getElementById("right-ear"), box: null },
];
const history = []; // { t: ms, v: average EAR or null when no face }

const engine = createEngine();
const $ = (id) => document.getElementById(id);
const badge = $("badge"), BEEP_COOLDOWN_MS = 5000;
let audio = null, lastBeep = 0;
$("recal").onclick = () => (audio?.resume(), engine.recalibrate());
$("sound").onclick = () => {
  if (audio) { audio.close(); audio = null; } else audio = new AudioContext(); // created on a click: browsers block it otherwise
  $("sound").textContent = `Âm thanh: ${audio ? "bật" : "tắt"}`;
};

async function main() {
  const fileset = await FilesetResolver.forVisionTasks(WASM);
  const landmarker = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL, delegate: "CPU" },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFacialTransformationMatrixes: true,
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
      const result = landmarker.detectForVideo(video, now);
      const face = result.faceLandmarks[0];
      const sample = toSample(result, overlay.width, overlay.height, now);
      const out = engine.step(sample);
      updatePanel(out, sample, now);
      if (recording) {
        recording.samples.push({ ...sample, label: held });
        $("rec-state").className = "on";
        $("rec-state").textContent = `● REC ${recording.samples.length} mẫu · nhãn: ${held || "–"}`;
      }
      fps = fps * 0.9 + (1000 / (now - lastFrame)) * 0.1;
      lastFrame = now;
      const avg = draw(face);
      avgEl.textContent = avg === null ? "–" : avg.toFixed(3);
      history.push({ t: now, v: avg });
      while (history[0].t < now - CHART_SECONDS * 1000) history.shift();
      drawChart(now, out.thresholds);
      statusEl.textContent = `${face ? "Face found" : "No face"} · ${fps.toFixed(0)} fps`;
    }
    requestAnimationFrame(loop);
  }
  loop();
}

// Recording: raw samples + the key held at that moment ("1" microsleep, "2" yawn).
const KEY_LABEL = { 1: "microsleep", 2: "yawn" };
const logs = []; // { scenario, calibration, samples } recorded or loaded this session
let recording = null, held = "", lastCsv = null;

const isTyping = (e) => e.target.matches("select, input, textarea");
addEventListener("keydown", (e) => { if (!e.repeat && !isTyping(e) && KEY_LABEL[e.key]) held = KEY_LABEL[e.key]; });
addEventListener("keyup", (e) => { if (KEY_LABEL[e.key] === held) held = ""; });
addEventListener("blur", () => (held = "")); // a key released outside the window must not stay stuck

const countLogs = () => ($("logs-count").textContent = `${logs.length} log`);
$("scenario").onchange = (e) => e.target.blur();
$("rec").onclick = () => {
  if (!recording) {
    recording = { scenario: $("scenario").value, samples: [] };
    $("rec").textContent = "Dừng";
    return;
  }
  const { scenario, samples } = recording;
  recording = null;
  $("rec").textContent = "Ghi";
  $("rec-state").className = "";
  $("rec-state").textContent = `Đã ghi ${samples.length} mẫu (${scenario})`;
  const calibration = engine.calibration;
  logs.push({ scenario, calibration, samples });
  lastCsv = { name: `${scenario}-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`, text: toCsv(samples, { calibration }) };
  $("download").disabled = false;
  countLogs();
};
$("download").onclick = () => {
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([lastCsv.text], { type: "text/csv" })),
    download: lastCsv.name,
  });
  a.click();
  URL.revokeObjectURL(a.href);
};
$("load-btn").onclick = () => $("load").click();
$("load").onchange = async (e) => {
  for (const f of e.target.files) logs.push({ scenario: scenarioFromName(f.name), ...parseCsv(await f.text()) });
  e.target.value = "";
  countLogs();
};
$("score").onclick = () => {
  const rows = logs.length ? reportRows(compareTrust(logs)) : [];
  $("report").replaceChildren(...rows.map((r) => {
    const tr = document.createElement("tr");
    tr.append(...r.map((c) => Object.assign(document.createElement("td"), { textContent: c })));
    return tr;
  }));
};
$("clear").onclick = () => (logs.length = 0, countLogs(), $("score").click());

const LABEL = { TINH: "TỈNH", CHU_Y: "CHÚ Ý", CANH_BAO: "CẢNH BÁO" };

function updatePanel(out, s, now) {
  const { signals: g, calibration: c, phase } = out;
  let text, key;
  if (phase === "wait") [text, key] = ["Chờ khuôn mặt", "wait"];
  else if (phase === "calibrate") {
    const left = Math.ceil((1 - out.calib.pct) * engine.config.calibrateMs / 1000);
    [text, key] = [out.calib.failed ? "Hiệu chuẩn lại: nhìn thẳng, mở mắt tự nhiên" : `Hiệu chuẩn… ${left} s, nhìn thẳng`, "calib"];
  } else if (!out.trusted && out.state === "TINH") [text, key] = ["KHÔNG CHẮC", "unsure"];
  else [text, key] = [LABEL[out.state] + (out.trusted ? "" : " (giữ)"), out.state];
  badge.textContent = text;
  badge.dataset.s = key;

  const cfg = engine.config;
  $("bar-closed").style.width = `${Math.min(1, g.closedMs / cfg.closedMs) * 100}%`;
  $("val-closed").textContent = `${(g.closedMs / 1000).toFixed(1)} s`;
  $("bar-perclos").style.width = `${g.perclos === null ? 0 : Math.min(1, g.perclos / cfg.perclosAlarm) * 100}%`;
  $("val-perclos").textContent = g.perclos === null ? "–" : `${(g.perclos * 100).toFixed(0)}%`;
  $("bar-yawn").style.width = `${Math.min(1, g.yawnMs / cfg.yawnMs) * 100}%`;
  $("val-yawn").textContent = `${(g.yawnMs / 1000).toFixed(1)} s`;
  $("val-mar").textContent = s.face ? s.mar.toFixed(2) : "–";
  $("val-yaw").textContent = s.face ? (s.yaw - (c?.yaw0 ?? 0)).toFixed(0) : "–";
  $("val-pitch").textContent = s.face ? (s.pitch - (c?.pitch0 ?? 0)).toFixed(0) : "–";

  if (out.state === "CANH_BAO" && audio && now - lastBeep >= BEEP_COOLDOWN_MS) {
    lastBeep = now;
    const osc = audio.createOscillator();
    osc.frequency.value = 880;
    osc.connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + 0.4);
  }
}

function draw(face) {
  const ctx = overlay.getContext("2d");
  const W = overlay.width, H = overlay.height;
  ctx.clearRect(0, 0, W, H);
  eyesPane.dataset.face = face ? "1" : "0";
  if (!face) {
    eyes.forEach((e) => ((e.box = null), (e.label.textContent = "–")));
    return null;
  }

  let sum = 0;
  for (const e of eyes) {
    const value = ear(e.earIdx.map((i) => face[i]), W, H);
    e.label.textContent = value.toFixed(3);
    sum += value;

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
    const toCrop = (p) => [(p.x * W - b.x) * sx, (p.y * H - b.y) * sy];
    contour(ec, pts.map(toCrop), 2);

    // the 6 EAR points
    ec.fillStyle = "#fff";
    for (const [x, y] of e.earIdx.map((i) => toCrop(face[i]))) {
      ec.beginPath();
      ec.arc(x, y, 4, 0, 2 * Math.PI);
      ec.fill();
    }
  }
  return sum / eyes.length;
}

// Rolling line chart of average EAR; gaps where no face was found.
function drawChart(now, th) {
  const ctx = chart.getContext("2d");
  const W = chart.width, H = chart.height;
  const x = (t) => W - ((now - t) / (CHART_SECONDS * 1000)) * W;
  const y = (v) => H - (v / CHART_MAX) * H;
  ctx.clearRect(0, 0, W, H);

  ctx.strokeStyle = "#2a313c";
  ctx.fillStyle = "#8b949e";
  ctx.font = "11px system-ui";
  ctx.lineWidth = 1;
  for (const v of [0.1, 0.2, 0.3, 0.4]) {
    ctx.beginPath();
    ctx.moveTo(0, y(v));
    ctx.lineTo(W, y(v));
    ctx.stroke();
    ctx.fillText(v.toFixed(1), 4, y(v) - 3);
  }

  if (th) {
    ctx.setLineDash([5, 4]);
    for (const [v, color] of [[th.closeBelow, "#f85149"], [th.reopenAbove, "#d29922"]]) {
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, y(v));
      ctx.lineTo(W, y(v));
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2;
  ctx.beginPath();
  let pen = false;
  for (const { t, v } of history) {
    if (v === null) { pen = false; continue; }
    pen ? ctx.lineTo(x(t), y(v)) : ctx.moveTo(x(t), y(v));
    pen = true;
  }
  ctx.stroke();
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
