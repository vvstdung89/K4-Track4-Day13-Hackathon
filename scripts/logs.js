// Loads CSV logs; the scenario comes from the file name prefix (e.g. microsleep-2026-10-16.csv).
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { parseCsv } from "../web/log.js";
import { scenarioFromName } from "../web/score.js";

export function loadLogs(files) {
  return files.map((f) => {
    const name = basename(f);
    const scenario = scenarioFromName(name);
    if (!scenario) console.error(`warning: ${f}: unknown scenario, events still scored, false alarms ignored`);
    return { name, scenario, ...parseCsv(readFileSync(f, "utf8")) };
  });
}
