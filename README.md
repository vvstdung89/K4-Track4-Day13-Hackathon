# DrowsyGuard

Real-time driver drowsiness detection with a normal webcam and MediaPipe Face Mesh. See [AGENTS.md](AGENTS.md).

## Run the demo

```
npm start        # serves web/ on http://localhost:8000
```

Open http://localhost:8000 in Chrome and allow camera access. Needs internet (MediaPipe and model load from CDN).

## Test

```
npm test
```

## Record and score

Pick a scenario, press Record, act it out (hold `1` for microsleep, `2` for yawn), press Stop, Download CSV.
File names start with the scenario (e.g. `microsleep-2026-10-16T09-00-00-000Z.csv`).

```
npm run score -- logs/*.csv     # recall, false alarms/min, latency, coverage; trust check on vs off
```
