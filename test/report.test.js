import { test } from "node:test";
import assert from "node:assert/strict";
import { evidenceMarkdown, reportRows } from "../web/report.js";

const result = (over = {}) => ({
  recall: { microsleep: { hit: 10, total: 10 }, yawn: { hit: 4, total: 5 } },
  falseAlarms: { count: 1, minutes: 4, perMin: 0.25 },
  latencyMs: 1700,
  coverage: 0.96,
  failures: [{ kind: "miss", event: "yawn", scenario: "ngap", file: "ngap-1.csv", t: 12300, cause: "MAR chỉ đạt 0.30, chưa vượt ngưỡng ngáp 0.37" }],
  ...over,
});
const cmp = { on: result(), off: result({ falseAlarms: { count: 3, minutes: 4, perMin: 0.75 } }) };
const logs = [{ samples: [{ t: 0 }, { t: 120000 }] }, { samples: [{ t: 0 }, { t: 60000 }] }];

test("recall rows carry the 95% interval", () => {
  assert.match(reportRows(cmp)[1][1], /10\/10 \(72–100%\)/);
});

test("evidence report has the measured numbers, the failure case and an honest limits section", () => {
  const md = evidenceMarkdown(cmp, { logs, people: 3 });
  assert.match(md, /^# Bằng chứng/m);
  assert.match(md, /3 người/);
  assert.match(md, /3\.0 phút/); // 2 + 1 minutes of logs
  assert.match(md, /MAR chỉ đạt 0\.30/);
  assert.match(md, /ngap-1\.csv/);
  assert.match(md, /gợi ý tự động/i);
  assert.match(md, /không chứng minh recall 100%|chỉ chứng minh recall ≥ 72%/);
  assert.match(md, /không phải tài xế mệt thật/);
});

test("without --people the report says the number is missing instead of inventing one", () => {
  assert.match(evidenceMarkdown(cmp, { logs }), /chưa ghi số người/);
});

test("no failures: the report says more hard data is needed", () => {
  const clean = { on: result({ failures: [] }), off: result({ failures: [] }) };
  assert.match(evidenceMarkdown(clean, { logs, people: 2 }), /Chưa có ca lỗi/);
});

test("limits name what the scenarios do not measure", () => {
  const md = evidenceMarkdown(cmp, { logs, people: 3 });
  assert.match(md, /điều kiện xấu[^\n]*chỉ đo độ phủ[^\n]*chưa đo/);
  assert.match(md, /gật đầu[^\n]*chưa/);
  assert.match(md, /chưa có kịch bản riêng[^\n]*PERCLOS/i);
});

test("limits state the blind spot: a held alarm expires while the head is out of range", () => {
  assert.match(evidenceMarkdown(cmp, { logs, people: 3 }), /gục[^\n]*KHÔNG CHẮC[^\n]*3 giây[^\n]*không còn được cảnh báo/);
});
