# Design System — Tinh Giản (Streamlined Modern Palette)

> **Triết lý thiết kế:** Tương tự các sản phẩm hiện đại phổ biến (Linear, GitHub, Stripe, Vercel), hệ thống giao diện loại bỏ hoàn toàn việc dùng hàng chục mã màu lẻ tẻ, không dùng viền dải màu cầu vồng hay icon mỗi cái một màu. Toàn bộ extension được tinh giản về **3 nhóm cốt lõi**:
> 1. **Màu thương hiệu duy nhất:** Dusk Blue (`#3E5BA3`) cho mọi hành động chính, active tab, và link.
> 2. **Hệ bề mặt trung tính (Slate Neutrals):** 5 bậc màu đá Slate tự nhiên cho nền, card, viền và chữ.
> 3. **3 màu trạng thái ngữ nghĩa chuẩn:** Thành công (Xanh lá), Cảnh báo (Hổ phách), Lỗi (Đỏ san hô).

---

## 1. Bảng Màu Tinh Giản Tối Đa (Core Color Palette)

### A. Màu thương hiệu (Brand / Primary Action)
| Token Name | Light Mode | Dark Mode | Ứng Dụng |
| :--- | :--- | :--- | :--- |
| **`--primary`** | **`#3E5BA3`** | **`#3E5BA3`** | Nút **Lưu cấu hình**, Nút **Log Time Tháng Này**, Nút **Sync to Redmine**, Link ticket, Active tab highlight, Focus ring. |
| **`--primary-hover`** | `#324B88` | `#4A6BB8` | Hover trên nút chính & link. |
| **`--primary-surface`** | `#EEF2F9` | `rgba(62, 91, 163, 0.20)` | Nền tab active, nền chip model AI, nền nút toggle xem trước, nền icon tổng quan. |
| **`--on-primary`** | `#FFFFFF` | `#FFFFFF` | Màu chữ và icon trên nền nút chính (Luôn tương phản sắc nét). |

---

### B. Hệ Bề Mặt Trung Tính (Slate Neutrals)
| Token Name | Light Mode | Dark Mode | Ứng Dụng |
| :--- | :--- | :--- | :--- |
| **`--bg`** | `#F8FAFC` *(Slate 50)* | `#0F172A` *(Slate 900)* | Nền canvas toàn bộ màn hình Options & Popup. |
| **`--panel`** | `#FFFFFF` | `#1E293B` *(Slate 800)* | Nền thẻ cài đặt, Dialog modal, Bảng Monthly log time, Ô input/textarea. |
| **`--panel-subtle`**| `#F1F5F9` *(Slate 100)* | `#27354A` | Nền thanh segmented tab bar, header bảng dữ liệu, nền input readonly. |
| **`--border`** | `#E2E8F0` *(Slate 200)* | `#334155` *(Slate 700)* | Viền card, viền input, đường kẻ ngăn cách hàng. |
| **`--border-hover`**| `#CBD5E1` *(Slate 300)* | `#475569` *(Slate 600)* | Viền khi rê chuột vào input/card. |
| **`--text`** | `#0F172A` *(Slate 900)* | `#F8FAFC` *(Slate 50)* | Tiêu đề chính, văn bản chính, số liệu. |
| **`--muted`** | `#64748B` *(Slate 500)* | `#94A3B8` *(Slate 400)* | Phụ đề, text giải thích phụ, icon thứ cấp, ô ngày cuối tuần. |

---

### C. 3 Màu Trạng Thái Chuẩn (Semantic Alerts)
*Chỉ hiển thị khi thực sự có trạng thái cần phản hồi, không lạm dụng tô màu linh tinh.*

| Trạng Thái | Light Mode (Text / Surface) | Dark Mode (Text / Surface) | Khi Nào Sử Dụng |
| :--- | :--- | :--- | :--- |
| **Success (Xanh lá)** | Text `#16A34A` / Nền `#DCFCE7` | Text `#4ADE80` / Nền `rgba(74, 222, 128, 0.15)` | Lưu thành công, Kết nối Redmine/Backlog OK, Model AI đã kích hoạt. |
| **Warning (Hổ phách)**| Text `#B45309` / Nền `#FEF3C7` | Text `#FBBF24` / Nền `rgba(251, 191, 36, 0.15)` | Ngày log thiếu giờ / vượt 8h, Cảnh báo ghi đè. |
| **Danger (Đỏ)** | Text `#DC2626` / Nền `#FEE2E2` | Text `#F87171` / Nền `rgba(248, 113, 113, 0.15)` | Thiếu API Key, Lỗi kết nối, Nút xóa dữ liệu (`.tb-btn-danger`). |

---

## 2. Những Cải Tiến Tinh Giản Đã Thực Hiện

1. **Xóa bỏ dải màu cầu vồng ở các khối cài đặt (Options Page)**:
   - Trước đây: Mỗi mục có một dải màu riêng (Đỏ, Xanh lá, Xanh dương, Tím, Xám).
   - Hiện tại: Tất cả các thẻ cài đặt đều dùng viền trung tính `1px solid var(--border)`, tinh tế và thanh lịch như Stripe/GitHub Settings.
2. **Hợp nhất icon trên Popup**:
   - Trước đây: 3 icon có 3 màu khác nhau (Xanh lá, Xanh dương, Tím).
   - Hiện tại: Đồng bộ toàn bộ icon về tone nền `--primary-subtle` với icon `--primary` Dusk Blue.
3. **Chuẩn hóa ô nhập giờ & badge trong Monthly Log Time**:
   - Trước đây: Ô nhập số giờ có viền xanh lá, hover xanh lá đậm, text xanh lá mạ (7 sắc xanh lá khác nhau).
   - Hiện tại: Ô nhập số giờ là ô input số chuẩn (`#FFFFFF` viền `#CBD5E1`), focus viền Dusk Blue `#3E5BA3`.
   - Các badge kết quả chỉ dùng 3 màu chuẩn: Success (`#16A34A`), Warning (`#B45309`), Muted (`#64748B`).
4. **Nút Lưu cấu hình & Nút Log time tháng**:
   - Chuẩn hoá M3 Filled Pill Button với nền Dusk Blue `#3E5BA3` đồng nhất trên cả Light Mode và Dark Mode.
5. **Chuyển đổi chọn Giao diện (Theme) sang Segmented Toggle Switch**:
   - Trước đây: Dropdown `<select>` chiếm diện tích và mất 2 thao tác để đổi theme.
   - Hiện tại: Segmented Toggle pill gồm 3 nút icon trực quan: Light (☀️ Sáng), System (💻 Theo hệ thống), Dark (🌙 Tối), chuyển đổi 1-click tức thì.
6. **Cập nhật icon Tải lại dự án (Refresh Project)**:
   - Chuyển sang chuẩn icon `refresh` Google Material Symbols (FILL 0, wght 400, GRAD 0, opsz 24).
   - Bảo toàn hiệu ứng xoay loading (`.is-loading`), trạng thái thành công/thất bại và khôi phục icon chuẩn sau khi tải xong.
