// Drowsiness engine: calibration -> trust check -> signals -> state. Pure; time comes only from sample.t (ms).
// Sample: { t, face, ear, mar, yaw, pitch } (see features.js). State: TINH < CHU_Y < CANH_BAO.

export const DEFAULTS = {
  trust: true, // false: ignore head angles (used to compare with/without the trust check)
  calibration: null, // { earOpen, marClosed, yaw0, pitch0 }: skips calibration (replay)
  calibrateMs: 10000, calibMinFaceFrac: 0.7, calibMinSamples: 100, earOpenRange: [0.18, 0.45],
  closeRatio: 0.55, reopenRatio: 0.7, // eye closed below closeRatio * earOpen, open again above reopenRatio * earOpen
  marDelta: 0.35, // mouth open above marClosed + marDelta (closes below 70% of that)
  closedMs: 1500, yawnMs: 2000,
  perclosWindowMs: 60000, perclosMinMs: 20000, perclosAttention: 0.15, perclosAlarm: 0.3,
  yawLimit: 25, pitchLimit: 20, // degrees away from the calibrated pose
  holdMs: 3000, // keep the state this long while untrusted
  dwellMs: 3000, // calm time before dropping one level
};

const LEVELS = ["TINH", "CHU_Y", "CANH_BAO"];
const sorted = (a) => [...a].sort((x, y) => x - y);
export const median = (a) => {
  const s = sorted(a), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const percentile = (a, p) => sorted(a)[Math.max(0, Math.ceil(p * a.length) - 1)];

export function createEngine(options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  let calibration = cfg.calibration;
  let phase, calib, run;

  const newCalib = (failed = false) => ({ start: null, total: 0, faces: [], failed });
  const newRun = () => ({
    ears: [], closed: false, closedStart: null, yawning: false, yawnStart: null,
    win: [], sumDt: 0, sumClosed: 0, lastT: null,
    level: 0, calmSince: null, untrustedSince: null,
  });
  const reset = () => {
    phase = calibration ? "run" : "wait";
    calib = newCalib();
    run = newRun();
  };
  reset();

  const thresholds = () =>
    calibration && {
      closeBelow: cfg.closeRatio * calibration.earOpen,
      reopenAbove: cfg.reopenRatio * calibration.earOpen,
      yawnAbove: calibration.marClosed + cfg.marDelta,
      yawnBelow: calibration.marClosed + cfg.marDelta * 0.7,
    };

  const output = (trusted, signals = { closedMs: 0, perclos: null, yawnMs: 0 }) => ({
    phase,
    trusted,
    state: LEVELS[run.level],
    signals,
    calib: { pct: 0, failed: calib.failed },
    thresholds: thresholds(),
    calibration,
  });

  function calibrate(s) {
    if (calib.start === null) calib.start = s.t;
    calib.total++;
    if (s.face) calib.faces.push(s);
    const pct = Math.min(1, (s.t - calib.start) / cfg.calibrateMs);
    if (pct < 1) return { ...output(s.face), calib: { pct, failed: calib.failed } };

    const f = calib.faces;
    const earOpen = f.length ? percentile(f.map((x) => x.ear), 0.8) : 0;
    const ok =
      f.length >= cfg.calibMinSamples &&
      f.length / calib.total >= cfg.calibMinFaceFrac &&
      earOpen >= cfg.earOpenRange[0] && earOpen <= cfg.earOpenRange[1];
    if (ok) {
      calibration = {
        earOpen,
        marClosed: median(f.map((x) => x.mar)),
        yaw0: median(f.map((x) => x.yaw)),
        pitch0: median(f.map((x) => x.pitch)),
      };
      phase = "run";
      calib = newCalib();
      run = newRun();
      return output(s.face);
    }
    calib = newCalib(true); // retry with a fresh window
    return { ...output(s.face), calib: { pct: 0, failed: true } };
  }

  function step(s) {
    if (phase === "wait" && s.face) phase = "calibrate";
    if (phase === "wait") return output(false);
    if (phase === "calibrate") return calibrate(s);

    const th = thresholds();
    const trusted =
      s.face &&
      (!cfg.trust ||
        (Math.abs(s.yaw - calibration.yaw0) <= cfg.yawLimit && Math.abs(s.pitch - calibration.pitch0) <= cfg.pitchLimit));

    if (!trusted) {
      Object.assign(run, { closed: false, closedStart: null, yawning: false, yawnStart: null, lastT: null, calmSince: null });
      run.ears.length = 0;
      run.untrustedSince ??= s.t;
      if (s.t - run.untrustedSince > cfg.holdMs) run.level = 0;
      return output(false);
    }
    run.untrustedSince = null;

    // eye: median of 3, then hysteresis
    run.ears.push(s.ear);
    if (run.ears.length > 3) run.ears.shift();
    const ear = median(run.ears);
    if (!run.closed && ear < th.closeBelow) [run.closed, run.closedStart] = [true, s.t];
    else if (run.closed && ear > th.reopenAbove) [run.closed, run.closedStart] = [false, null];

    // mouth: hysteresis
    if (!run.yawning && s.mar > th.yawnAbove) [run.yawning, run.yawnStart] = [true, s.t];
    else if (run.yawning && s.mar < th.yawnBelow) [run.yawning, run.yawnStart] = [false, null];

    // PERCLOS over trusted time only, time-weighted
    const dt = run.lastT === null ? 0 : Math.min(s.t - run.lastT, 200);
    run.lastT = s.t;
    if (dt > 0) {
      run.win.push({ t: s.t, dt, closed: run.closed });
      run.sumDt += dt;
      if (run.closed) run.sumClosed += dt;
    }
    while (run.win.length && run.win[0].t < s.t - cfg.perclosWindowMs) {
      const w = run.win.shift();
      run.sumDt -= w.dt;
      if (w.closed) run.sumClosed -= w.dt;
    }

    const signals = {
      closedMs: run.closed ? s.t - run.closedStart : 0,
      perclos: run.sumDt >= cfg.perclosMinMs ? run.sumClosed / run.sumDt : null,
      yawnMs: run.yawning ? s.t - run.yawnStart : 0,
    };

    const alarm = signals.closedMs >= cfg.closedMs || (signals.perclos !== null && signals.perclos > cfg.perclosAlarm);
    const attention = (signals.perclos !== null && signals.perclos > cfg.perclosAttention) || signals.yawnMs >= cfg.yawnMs;
    const target = alarm ? 2 : attention ? 1 : 0;
    if (target >= run.level) {
      run.level = target;
      run.calmSince = null;
    } else {
      run.calmSince ??= s.t;
      if (s.t - run.calmSince >= cfg.dwellMs) {
        run.level--;
        run.calmSince = s.t;
      }
    }
    return output(true, signals);
  }

  return {
    step,
    recalibrate() {
      calibration = null;
      reset();
    },
    get calibration() {
      return calibration;
    },
    config: cfg,
  };
}
