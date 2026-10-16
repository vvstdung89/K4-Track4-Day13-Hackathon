# Plan: demo page

1. `web/eyes.js`: eye landmark indices, `eyeBox()` (padded fixed-aspect crop box), `smoothBox()` (EMA).
2. `test/eyes.test.js`: unit tests for the two functions (`node --test`).
3. `web/index.html` + `web/style.css`: two-pane layout (video | eyes), stacks on narrow screens.
4. `web/app.js`: start webcam, load `FaceLandmarker`, per-frame loop:
   detect -> draw overlay on video pane -> draw eye crops on eyes pane -> update status.
5. `package.json` scripts: `npm test`, `npm start` (static server on :8000).
6. Manual check in Chrome; update `CODEMAP.md`, `README.md`, `progress.md`; commit.
