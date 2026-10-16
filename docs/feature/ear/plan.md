# Plan: EAR

1. `test/eyes.test.js`: tests for `ear()` (open eye, closed eye, scale invariance).
2. `web/eyes.js`: `LEFT_EAR`, `RIGHT_EAR` index lists and `ear(points, width, height)`.
3. `web/index.html` / `style.css`: EAR value in each caption, average + chart canvas in the eyes pane.
4. `web/app.js`: compute EAR per eye, highlight the 6 points on the crop, push average into a ~10 s history, draw chart.
5. Update CODEMAP, progress; commit.
