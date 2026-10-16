// Usage: npm run score -- logs/*.csv   (scenario = file name prefix, e.g. microsleep-2026-10-16.csv)
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { parseCsv } from "../web/log.js";
import { compareTrust, scenarioFromName } from "../web/score.js";
import { formatReport } from "../web/report.js";

const files = process.argv.slice(2);
if (!files.length) {
  console.error("usage: npm run score -- <log.csv> [...]");
  process.exit(1);
}
const logs = files.map((f) => {
  const scenario = scenarioFromName(basename(f));
  if (!scenario) console.error(`warning: ${f}: unknown scenario, events still scored, false alarms ignored`);
  return { scenario, ...parseCsv(readFileSync(f, "utf8")) };
});
console.log(formatReport(compareTrust(logs)));
