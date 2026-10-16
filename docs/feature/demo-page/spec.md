# Demo page

## What
A single browser page for the hackathon demo:

- **Video pane**: full webcam feed, mirrored, with eye contours and the eye crop boxes drawn on top.
- **Eyes pane**: zoomed crops of the left and right eye only, with the eye contour drawn on each.
- Status line: model/camera state, face found or not, FPS.

## Why
First visible step of DrowsyGuard. Shows that MediaPipe Face Mesh tracks the eyes reliably
before EAR / PERCLOS / MAR are added.

## Decisions
- Plain HTML + ES modules, no build step. MediaPipe Tasks Vision (`FaceLandmarker`) from jsDelivr,
  pinned to `0.10.21`. Model file loaded from Google storage.
- `delegate: "CPU"`, matching the "runs on laptop CPU" pitch.
- Mirroring is done with CSS only; all landmark math uses raw (unmirrored) coordinates.
- "Left eye" / "right eye" mean the driver's own eyes (MediaPipe convention).
- Eye crop box: landmark bounding box, padded, fixed aspect ratio, lightly smoothed (EMA) to cut jitter.
- Pure geometry lives in `web/eyes.js` so it can be unit tested in Node.

## Out of scope (this stage)
EAR, PERCLOS, MAR, calibration, alerts, sound.
