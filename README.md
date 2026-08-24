# 🎱 Dò số Vietlott

Mini web dò vé Vietlott: so bộ số của bạn với **toàn bộ lịch sử quay thưởng**, xếp từ trúng nhiều nhất đến không trúng, kèm tiền thưởng, thống kê tần suất và dự đoán số cho vui.

**Hỗ trợ:** Mega 6/45 · Power 6/55 · Lotto 5/35 (có số may mắn 1–12)

## Tính năng

- 🔍 **Dò số**: dò 1 lần trên toàn bộ các kỳ (hoặc 100/500/1000 kỳ gần nhất), kết quả xếp theo giải cao nhất, ghi rõ giải + tiền thưởng từng kỳ
- 🎫 **Vé bao**: bao 7 → 18 (Mega/Power), bao 6 → 15 (Lotto 5/35) — tính đúng luật: mỗi tổ hợp trúng độc lập, tiền cộng dồn
- 🗂️ **Dò nhiều bộ cùng lúc**: tối đa 10 bộ số, có bảng tổng quan so sánh
- ⭐ **Bộ số yêu thích**: lưu tối đa 10 bộ mỗi loại (localStorage)
- 📊 **Thống kê**: số ra nhiều nhất / ít nhất / lâu chưa ra, số lần, tỷ lệ, có nút copy dãy số
- 🎯 **Dự đoán** (giải trí): trung bình cộng theo vị trí, lớn/nhỏ nhất theo vị trí, ra nhiều/ít nhất trong N kỳ tuỳ chọn

## Dữ liệu

Lấy từ [vietvudanh/vietlott-data](https://github.com/vietvudanh/vietlott-data) — repo tự cào và cập nhật hàng ngày qua GitHub Actions. Web fetch trực tiếp file JSONL trên trình duyệt (cache 6 giờ), **không cần server**.

## Chạy local

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # build ra dist/
```

## Deploy GitHub Pages

Repo đã kèm workflow [.github/workflows/deploy.yml](.github/workflows/deploy.yml): push lên nhánh `main` là tự build & deploy. Chỉ cần vào **Settings → Pages → Source** chọn **GitHub Actions** một lần đầu.

## Miễn trừ trách nhiệm

Dự án cá nhân, **không liên kết với Vietlott**. Mọi kết quả, thống kê, dự đoán chỉ mang tính tham khảo/giải trí, không phải căn cứ trả thưởng. Chơi xổ số có trách nhiệm 🍀
# do-ve-so
