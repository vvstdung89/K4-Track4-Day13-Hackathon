# Progress: drowsiness engine

- [x] Slice 1: features + engine + live panel (29 unit tests pass; static check of page ids and imports ok)
- [ ] Slice 1: checked on a real face (needs a person at the webcam)
- [x] Slice 2: log + score + page recording UI (log/score/CLI covered by tests; page UI checked statically only)
- [ ] Slice 2: record and score a real session in the browser
- [x] Evidence report: Wilson interval, failure cases with cause hints, `npm run evidence` (52 tests pass)
- [ ] Record real logs (>= ~5 per scenario, >= 2 people, one glasses/bad-light case) and read the report
- [x] CODEMAP / README updated
- [ ] Open: Playwright smoke test (needs Chrome installed on the machine)
- [ ] Open: thresholds are starting points, tune on recorded logs
- [ ] Open: confirm matrix layout (column-major) and head-angle signs on screen
