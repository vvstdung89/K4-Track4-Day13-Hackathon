# Drowsiness engine

## What
Turn the demo page from "show EAR" into a working detector that runs in the browser:

- **Calibration**: learn each driver's open-eye EAR and closed-mouth MAR.
- **Engine**: per-frame sample -> trust check -> state `TINH` / `CHU_Y` / `CANH_BAO` (+ `KHONG CHAC` flag).
- **Log + score**: record raw samples with key labels, replay them through the same engine, report recall, false alarms/min, median latency, coverage; compare trust check on/off.
- **Panel on the page**: state badge, signal bars, thresholds on the EAR chart, controls, live score table, alert beep.

## Why
Hackathon scoring rewards a live demo (25), evidence (10) and use of course knowledge (25). The trust check
("alert only when sure") is the differentiator, and it must be measurable, hence log + replay.

## Data flow
```
landmarks + 4x4 matrix --features.js--> sample {t, face, ear, mar, yaw, pitch} --engine.step--> {phase, trusted, state, signals}
```
The log stores samples only. State is always recomputed by the engine, so thresholds can change after recording.

## Modules (all pure, testable in Node)
| file | job |
|---|---|
| `web/features.js` | landmarks/matrix -> `ear`, `mar`, `yaw`, `pitch` (pixels, reuses `eyes.js`) |
| `web/engine.js` | `createEngine(config)` -> `step(sample)`; no clock, time comes from `sample.t` |
| `web/log.js` | samples <-> CSV, including the `# earOpen=..., marClosed=...` header |
| `web/score.js` | replay logs through the engine, compute metrics |
| `scripts/score.js` | CLI: `npm run score -- logs/*.csv` |
| `web/app.js` | camera, drawing, keys, buttons, panel; no detection logic |

## Engine
**Phases**: `wait` -> `calibrate` (10 s, starts at first face) -> `run`. "Recalibrate" returns to `calibrate`.
`config.calibration` skips calibration (used by replay).

**Calibration**: uses every sample that has a face. Valid if >= 70% of samples have a face, >= 100 samples,
and `earOpen` in [0.18, 0.45]; otherwise retry. `earOpen` = 80th percentile of EAR; `marClosed` = median MAR;
`yaw0`, `pitch0` = median head angles (the driver's normal pose; a laptop webcam above the screen reads 10-20 deg of pitch).
Until calibrated, state is `TINH` and no alert is raised.

**Signals** (trusted samples only; EAR median-of-3 first):
- closed: `ear < 0.55*earOpen`, reopen at `ear > 0.70*earOpen`. `closedMs` = continuous closed time.
- yawn: `mar > marClosed + 0.35`, `yawnMs` = continuous time.
- `perclos`: closed-time fraction over the last 60 s, time-weighted; used only with >= 20 s of trusted data.
  (Closed = below 55% of own open level, not the standard 80% closure; say so when presenting.)

**Trust**: untrusted when no face, |yaw - yaw0| > 25 deg or |pitch - pitch0| > 20 deg (angles relative to the calibrated pose). Untrusted samples reset `closedMs` and `yawnMs`
and are excluded from `perclos`. The current state is held for at most 3 s, then falls to `TINH`.
`config.trust = false` disables the check (for on/off comparison).

**State**:
| condition | state |
|---|---|
| `closedMs >= 1500` or `perclos > 0.30` | `CANH_BAO` |
| `perclos > 0.15` or `yawnMs >= 2000` | `CHU_Y` |
| otherwise | `TINH` |

Up immediately; down one level only after 3 s with no condition of that level true (`dwellMs`).
All numbers live in `config`; the values above are starting points to tune on recorded logs.

## Log and score
- CSV columns: `t_ms, face, ear, mar, yaw, pitch, label_key`. Hold **1** = `microsleep`, **2** = `yawn` while performing it.
- Scenario chosen before recording, stored in the file name. Scenarios: tinh-tao, nhin-guong, microsleep, ngap, dieu-kien-xau.
- Event = contiguous run of one label. Hit: `microsleep` needs `CANH_BAO`, `yawn` needs `CHU_Y` or above, within [start, end + 3 s].
- Metrics: recall per event type; false alarms/min = `CANH_BAO` onsets outside event windows in tinh-tao + nhin-guong logs
  divided by their minutes; median latency = key press to first `CANH_BAO` (microsleep); coverage = share of trusted samples after calibration.
- Report trust on and off side by side.

## Evidence report
Serves the "Bằng chứng" criterion (numbers, a failure case with its cause, stated limits).
- `scoreLogs` also returns `failures`: misses and false alarms with file, time and a rule-based cause hint
  (trust lost, EAR never below threshold, closure too short, MAR below threshold, head tilt, PERCLOS). Hints are a starting point; a person confirms the real cause.
- Recall is shown with a 95% Wilson interval (rounded outwards), e.g. 10/10 only proves recall >= 72%.
- `npm run evidence -- --people N logs/*.csv` prints Markdown: numbers (trust on/off), sample size, failure cases, limits.
  Limits are generated from the data (interval widths, number of people) plus fixed statements; the people count is never guessed.

Known measurement gaps, stated in the report's limits (deliberately not fixed for now): `dieu-kien-xau` only yields coverage
(no "correct or KHONG CHAC" rate), no nod scenario, no scenario that isolates PERCLOS / the CHU_Y it causes.

## Page panel
State badge (green / amber / red / grey `KHONG CHAC`; while an alarm is held during an untrusted spell the red badge stays, marked as held), bars for `closedMs` (vs 1500), `perclos`, `yawnMs`;
threshold lines on the EAR chart derived from `earOpen`; calibration countdown; Recalibrate; scenario menu; Record/Stop
with REC and held-label indicator; Download CSV; score table for the last recording or uploaded CSVs;
Web Audio beep on `CANH_BAO`, at most once per 5 s, with a mute toggle.

## Decisions
- Everything runs in the browser; Python is not used. `score.py`, `check_env.py`, `requirements.txt` are superseded (kept until the owner says otherwise).
- Same module (`score.js`) serves the CLI and the page, so there is one definition of every metric.
- Keep the page's current stack: plain ES modules, no build step, `node --test`.

## Out of scope
Nod detection, blendshape as a second estimator, solvePnP, evidence clips, checkerboard camera calibration, e2e test with a fake camera.

## Known limits (state them in the demo)
Data comes from team members acting, one webcam, one room; small sample, indicative only. Averaging both eyes hides one-eye winks.
Webcam is not enough at night; a real cabin needs infrared. Driver privacy: on-device, no video stored.

## Tests
Node unit tests for `features` (head angles from known matrices, MAR), `engine` (EAR 0.3 open / 0.1 closed fixtures, hysteresis,
reset on untrusted, 3 s hold, calibration rejection), `log` (CSV round trip), `score` (synthetic log with known answers,
deterministic replay).
