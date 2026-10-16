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

## Log: ghi dữ liệu và chỉnh ngưỡng (2026-10-16)

**Thiết lập đã đo bằng tay (người dùng báo):** MAR ngậm miệng 0, nói chuyện ~0,2, ngáp 0,30 trở lên; quay đầu mạnh yaw ~30°, gật đầu pitch 15° trở lên; EAR mở ~0,3, nhắm ~0,1.
Ngưỡng đặt theo các số này: `marDelta` 0,27, `yawLimit` 20°, `pitchLimit` 25° (commit `b534ba5`).

**Dữ liệu đã ghi:** 8 log hợp lệ, 2,8 phút (tỉnh táo 2 log, nhìn gương 2 log, ngáp 1 log, microsleep 3 log). Chưa có điều kiện xấu. Số người chưa ghi (không đoán).

**Sửa bộ chấm điểm từ dữ liệu thật (commit sau `b534ba5`):**
- Nhãn nhả rồi nhấn lại trong 0,5 s được gộp thành một sự kiện (một cú nhắm bị đếm thành hai).
- Sự kiện bắt đầu khi hệ thống đã ở mức cảnh báo (cảnh báo trước chưa hạ, hoặc nhấn phím muộn) bị loại khỏi recall và độ trễ.
  Trước khi sửa, độ trễ trung vị ghi 0,62 s (sai); sau khi sửa là 1,21 s (hai sự kiện hợp lệ ở log `09-50`).

**Kết quả trên 8 log (kiểm tra tin cậy bật / tắt):** recall microsleep 4/7 và 5/8, ngáp 2/4 và 2/4, báo nhầm 0 và 0, độ trễ trung vị 1,38 s và 1,44 s, độ phủ 86% và 98%. Có 6 sự kiện bị loại vì nghỉ giữa hai lần quá ngắn.

**Quét ngưỡng `closedMs` x `yawnMs` (1000/1200/1500 x 1000/1500/2000):**

| `closedMs` | `yawnMs` | microsleep | ngáp | báo nhầm | độ trễ | bị loại |
|---|---|---|---|---|---|---|
| 1500 (đang dùng) | 2000 (đang dùng) | 4/7 | 2/4 | 0 | 1,38 s | 6 |
| 1500 | 1500 | 4/7 | 1/1 | 0 | 1,38 s | 9 |
| 1200 | 2000 | 4/7 | 2/4 | 0 | 1,07 s | 6 |
| 1000 | 2000 | 4/7 | 2/4 | 0 | 0,87 s | 6 |

**Quyết định: giữ nguyên `closedMs` 1500 và `yawnMs` 2000.**
- Hạ `yawnMs` chỉ làm "ngáp 1/1" vì số sự kiện bị loại tăng từ 6 lên 9; cải thiện này là ảo.
- Hạ `closedMs` chỉ rút ngắn độ trễ, recall microsleep vẫn 4/7 ở mọi giá trị; ba lần bỏ sót nằm ở log gục đầu.
- Chờ ghi lại log đúng quy trình (nghỉ >= 8 s, nhắm đủ 2 s, tỉnh táo 60 s, quay đầu ~3 s) rồi quét lại.

**Việc còn mở:**
- [ ] Ghi lại log theo quy trình rồi quét ngưỡng lần nữa.
- [ ] Ghi điều kiện xấu (kính, đèn rọi, thiếu sáng).
- [ ] Sửa gợi ý nguyên nhân: nhắc tới mất mặt khi nó chiếm từ ~30% số khung (luật hiện tại chỉ nhắc khi vượt 50%).
- [ ] Thời điểm trong báo cáo ca lỗi đang là mốc tuyệt đối của trang, nên đổi sang tính từ lúc bắt đầu ghi.

