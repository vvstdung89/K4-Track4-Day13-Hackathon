# Code map

```
web/                 the demo page (static, no build step)
  index.html         layout: Camera pane | Eyes pane, status line in header
  style.css          dark theme, two-column grid (stacks under 800px)
  app.js             webcam + MediaPipe FaceLandmarker loop, draws overlay and eye crops
  eyes.js            pure eye geometry: landmark indices, eyeBox(), smoothBox(), ear()
test/
  eyes.test.js       unit tests for eyes.js (node --test)
docs/feature/        per-feature spec / plan / progress
```

Flow per frame (`app.js`): `detectForVideo()` -> `draw(face)` -> for each eye:
`ear()` -> `eyeBox()` + `smoothBox()` -> contour + dashed box on the video overlay -> zoomed crop with
the 6 EAR points on the eye canvas. The average EAR is kept for 10 s in `history` and drawn by `drawChart()`.

Mirroring is CSS only (`.mirror`); all math uses raw camera coordinates.
