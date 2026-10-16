// Text and table rows for a trust on/off comparison (shared by the CLI and the page).
const pct = (v) => (v === null ? "–" : `${(v * 100).toFixed(0)}%`);
const recall = (r) => (r.total ? `${r.hit}/${r.total}` : "–");

export function reportRows({ on, off }) {
  const row = (label, f) => [label, f(on), f(off)];
  return [
    ["", "Kiểm tra tin cậy BẬT", "TẮT"],
    row("Recall microsleep", (r) => recall(r.recall.microsleep)),
    row("Recall ngáp", (r) => recall(r.recall.yawn)),
    row("Báo nhầm / phút", (r) => (r.falseAlarms.perMin === null ? "–" : `${r.falseAlarms.perMin.toFixed(2)} (${r.falseAlarms.count} lần)`)),
    row("Độ trễ trung vị", (r) => (r.latencyMs === null ? "–" : `${(r.latencyMs / 1000).toFixed(2)} s`)),
    row("Độ phủ", (r) => pct(r.coverage)),
  ];
}

export function formatReport(cmp) {
  const rows = reportRows(cmp);
  const w = [0, 1, 2].map((i) => Math.max(...rows.map((r) => r[i].length)));
  return rows.map((r) => r.map((c, i) => c.padEnd(w[i])).join("  ")).join("\n");
}
