// Usage: npm run score -- logs/*.csv
import { loadLogs } from "./logs.js";
import { compareTrust } from "../web/score.js";
import { formatReport } from "../web/report.js";

const files = process.argv.slice(2);
if (!files.length) {
  console.error("usage: npm run score -- <log.csv> [...]");
  process.exit(1);
}
console.log(formatReport(compareTrust(loadLogs(files))));
