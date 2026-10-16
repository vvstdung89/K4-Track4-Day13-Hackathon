# Code map

```
web/                 the demo page (static, no build step)
  index.html         layout: Camera pane | Eyes pane, status line in header
  style.css          dark theme, two-column grid (stacks under 800px)
  app.js             webcam + MediaPipe FaceLandmarker loop, draws overlay and eye crops
  eyes.js            pure eye geometry: landmark indices, eyeBox(), smoothBox(), ear()
  features.js        mar(), headAngles() from the transformation matrix, toSample() -> engine input
  engine.js          createEngine(): calibration -> trust check -> signals -> state (pure, time from sample.t)
  log.js             raw samples <-> CSV (calibration in a "# ..." header line)
  score.js           replay logs through the engine: recall, false alarms/min, latency, coverage; trust on/off
  report.js          rows / text for the on/off comparison table
scripts/
  score.js           CLI: npm run score -- logs/*.csv
test/
  eyes.test.js       unit tests for eyes.js (node --test)
  features.test.js   MAR, head angles, toSample
  engine.test.js     calibration, thresholds, hysteresis, trust, state machine
  log.test.js        CSV round trip
  score.test.js      metrics on synthetic logs, trust on/off
docs/feature/        per-feature spec / plan / progress
```

Flow per frame (`app.js`): `detectForVideo()` -> `draw(face)` -> for each eye:
`ear()` -> `eyeBox()` + `smoothBox()` -> contour + dashed box on the video overlay -> zoomed crop with
the 6 EAR points on the eye canvas. The average EAR is kept for 10 s in `history` and drawn by `drawChart()`.

Mirroring is CSS only (`.mirror`); all math uses raw camera coordinates.

Engine flow per frame: `toSample()` -> `engine.step(sample)` -> `updatePanel()` (badge, bars, readouts, beep).
Spec: docs/feature/drowsiness-engine/spec.md.
Recording (`app.js`): hold 1 = microsleep, 2 = yawn; samples + label are pushed while Record is on, then downloaded or scored in the page.
