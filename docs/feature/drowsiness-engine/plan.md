# Plan: drowsiness engine

Slice 1 (live demo, stop and check with a person at the webcam):
1. `test/features.test.js` -> `web/features.js`: `mar()`, `headAngles()`, `toSample()`.
2. `test/engine.test.js` -> `web/engine.js`: calibration, trust, signals, state machine.
3. `web/app.js` + `index.html` + `style.css`: enable transformation matrices, build a sample, `engine.step`,
   badge, bars, calibration countdown, Recalibrate, sound toggle, threshold lines on the EAR chart.
4. `npm test`; Playwright smoke with Chrome fake camera (no face): page loads, no console errors.

Slice 2 (after slice 1 is confirmed on a real face):
5. `test/log.test.js` -> `web/log.js` (CSV round trip + calibration header).
6. `test/score.test.js` -> `web/score.js` (events, hits, false alarms, latency, coverage, trust on/off).
7. `scripts/score.js` + `npm run score`; record / label keys / download / score table on the page.
8. CODEMAP, README, progress.
