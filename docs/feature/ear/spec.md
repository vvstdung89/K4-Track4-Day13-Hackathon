# EAR (eye aspect ratio)

## What
Compute EAR per eye every frame and show it on the demo page:

- EAR value under each eye crop (left / right).
- Average EAR in the eyes pane, plus a rolling chart of the last ~10 s so blinks are visible.
- The 6 EAR landmarks highlighted on each eye crop.

## Formula
`EAR = (|p2-p6| + |p3-p5|) / (2 |p1-p4|)` (Soukupová & Čech, 2016).
p1/p4 = eye corners, p2/p3 = upper lid, p6/p5 = lower lid.

| eye   | p1  | p2  | p3  | p4  | p5  | p6  |
|-------|-----|-----|-----|-----|-----|-----|
| left  | 362 | 385 | 387 | 263 | 373 | 380 |
| right | 33  | 160 | 158 | 133 | 153 | 144 |

## Decisions
- Distances are measured in pixels (normalized x and y have different scales on a non-square frame).
- No threshold, no closed/open state yet: that comes with per-driver calibration.

## Out of scope
Calibration, PERCLOS, MAR, alerts.
