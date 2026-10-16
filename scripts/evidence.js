// Usage: npm run evidence -- --people 3 logs/*.csv   (prints Markdown for the "Bằng chứng" criterion)
import { loadLogs } from "./logs.js";
import { compareTrust } from "../web/score.js";
import { evidenceMarkdown } from "../web/report.js";

const args = process.argv.slice(2);
const i = args.indexOf("--people");
const people = i >= 0 ? Number(args.splice(i, 2)[1]) : undefined;
if (!args.length) {
  console.error("usage: npm run evidence -- [--people N] <log.csv> [...]");
  process.exit(1);
}
const logs = loadLogs(args);
console.log(evidenceMarkdown(compareTrust(logs), { logs, people }));
