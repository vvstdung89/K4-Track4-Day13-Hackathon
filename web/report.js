// Text and table rows for a trust on/off comparison, and the evidence report (shared by the CLI and the page).
import { wilson } from "./score.js";

const pct = (v) => (v === null ? "–" : `${(v * 100).toFixed(0)}%`);
// "hit/total (lo–hi%)": the 95% interval rounded outwards, so it never looks tighter than it is.
function interval(r) {
  const ci = wilson(r.hit, r.total);
  return ci ? [Math.floor(ci[0] * 100), Math.ceil(ci[1] * 100)] : null;
}
const recall = (r) => {
  const ci = interval(r);
  return r.total ? `${r.hit}/${r.total} (${ci[0]}–${ci[1]}%)` : "–";
};

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

const NAMES = { microsleep: "microsleep", yawn: "ngáp" };

// Markdown for the "Bằng chứng" criterion: numbers with intervals, failure cases with a cause hint, limits.
export function evidenceMarkdown(cmp, { logs, people } = {}) {
  const { on } = cmp;
  const minutes = logs.reduce((s, l) => s + (l.samples.at(-1).t - l.samples[0].t) / 60000, 0);
  const who = people ? `${people} người` : "chưa ghi số người (chạy lại với --people N)";
  const table = reportRows(cmp).map((r) => `| ${r.join(" | ")} |`);
  table.splice(1, 0, "|---|---|---|");

  const failures = on.failures.length
    ? on.failures.map((f, i) => {
        const what = f.kind === "miss" ? `bỏ sót ${NAMES[f.event]}` : "báo nhầm";
        return `${i + 1}. **${what}** (${f.scenario ?? "?"}${f.file ? `, ${f.file}` : ""}, ${(f.t / 1000).toFixed(1)} s): ${f.cause}. *Gợi ý tự động, cần xác nhận.*`;
      })
    : ["Chưa có ca lỗi trong các log này. Cần ghi thêm dữ liệu khó (kính, ánh sáng xấu, quay đầu) trước khi nói về giới hạn."];

  const limits = [];
  for (const [key, r] of Object.entries(on.recall)) {
    const ci = interval(r);
    if (r.total) limits.push(`Recall ${NAMES[key]} ${r.hit}/${r.total}: khoảng tin cậy 95% là ${ci[0]}–${ci[1]}%, nên chỉ chứng minh recall ≥ ${ci[0]}%, không phải ${r.hit === r.total ? "100%" : pct(r.hit / r.total)}.`);
  }
  limits.push(
    `Dữ liệu từ ${who} đóng vai, không phải tài xế mệt thật.`,
    "Một loại webcam, một phòng, ánh sáng trong nhà; chưa thử ban đêm, kính râm hay khẩu trang.",
    "Ngưỡng đặt bằng quan sát và có thể đã chỉnh trên chính các log này; số đo là chỉ báo, chưa phải kết luận cho đội xe.",
    "PERCLOS tính theo ngưỡng 55% mức mở mắt của từng người, không phải chuẩn 80% khép mắt.",
    "Kịch bản điều kiện xấu (kính, đèn rọi, thiếu sáng) chỉ đo độ phủ, chưa đo tỷ lệ kết quả đúng hoặc KHÔNG CHẮC, nên chưa chứng minh hệ thống an toàn khi điều kiện xấu.",
    "Hệ thống chưa nhận diện gật đầu nên chưa kịch bản nào đo gật đầu.",
    "Khi đầu lệch quá giới hạn góc (ví dụ gục xuống) hệ thống coi là KHÔNG CHẮC và chỉ giữ cảnh báo tối đa 3 giây (mặc định) rồi về TỈNH, nên người ngủ gục lâu hơn thế có thể không còn được cảnh báo.",
    "Chưa có kịch bản riêng cho PERCLOS và mức CHÚ Ý do PERCLOS gây ra, nên các ngưỡng này chưa được kiểm chứng riêng.",
  );

  return [
    "# Bằng chứng",
    "",
    "## Số đo",
    ...table,
    "",
    "## Cỡ mẫu",
    `${logs.length} log, ${minutes.toFixed(1)} phút, ${who}; ${on.recall.microsleep.total} sự kiện microsleep, ${on.recall.yawn.total} sự kiện ngáp.`,
    "",
    "## Ca lỗi (kiểm tra tin cậy bật)",
    ...failures,
    "",
    "## Giới hạn của những gì đã chứng minh",
    ...limits.map((l) => `- ${l}`),
    "",
  ].join("\n");
}
