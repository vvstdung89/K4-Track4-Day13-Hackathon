// Raw-sample log <-> CSV. State is never stored: the engine recomputes it on replay.
// First line: "# earOpen=..,marClosed=..,yaw0=..,pitch0=.." (calibration, omitted if not calibrated yet).
export const COLUMNS = ["t_ms", "face", "ear", "mar", "yaw", "pitch", "label_key"];
const FIELDS = ["ear", "mar", "yaw", "pitch"];
const CAL_KEYS = ["earOpen", "marClosed", "yaw0", "pitch0"];
const round = (v, d) => (v === undefined ? "" : String(Number(v.toFixed(d))));

export function toCsv(samples, { calibration = null } = {}) {
  const lines = [];
  if (calibration) lines.push("# " + CAL_KEYS.map((k) => `${k}=${round(calibration[k], 6)}`).join(","));
  lines.push(COLUMNS.join(","));
  for (const s of samples) {
    lines.push([Math.round(s.t), s.face ? 1 : 0, ...FIELDS.map((k) => round(s.face ? s[k] : undefined, 4)), s.label ?? ""].join(","));
  }
  return lines.join("\n") + "\n";
}

export function parseCsv(text) {
  let calibration = null;
  const samples = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith("t_ms")) continue;
    if (line.startsWith("#")) {
      const kv = Object.fromEntries(line.slice(1).split(",").map((p) => p.trim().split("=")));
      if (CAL_KEYS.every((k) => k in kv)) calibration = Object.fromEntries(CAL_KEYS.map((k) => [k, Number(kv[k])]));
      continue;
    }
    const [t, face, ear, mar, yaw, pitch, label = ""] = line.split(",");
    const s = { t: Number(t), face: face === "1", label };
    if (s.face) Object.assign(s, { ear: Number(ear), mar: Number(mar), yaw: Number(yaw), pitch: Number(pitch) });
    samples.push(s);
  }
  return { calibration, samples };
}
