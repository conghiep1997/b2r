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

---

## 3. Hệ Thống Nhận Diện Thương Hiệu & App Icon (B2R Brand Icon System)

### A. Triết Lý Biểu Trưng (Design Semantics)
Biểu tượng thương hiệu **B2R (Backlog to Redmine)** đại diện cho sự luân chuyển và đồng bộ dữ liệu hai chiều liên tục, mượt mà giữa hai nền tảng quản lý công việc hàng đầu (**Backlog ⇄ Redmine**).
- **Nguyên lý thiết kế**: Tối giản hình khối thuần túy (Pure Geometry), trường tồn (timeless), nói KHÔNG với các chi tiết rườm rà hay AI cliché (sao lấp lánh, đũa phép, nhồi nhãn chữ nhỏ li ti).
- **Đồng bộ triết lý sản phẩm**: Tương thích hoàn hảo với phong cách của các công cụ developer/SaaS cao cấp như Linear, Stripe, Docker, Vercel và hệ thống Google Material 3.

### B. Cấu Trúc Khối & Tỷ Lệ Hình Học
- **Khung chứa Squircle (Superellipse)**: Canvas lưới chuẩn `128x128`, tỷ lệ bo góc mượt mà `rx="28"` (22% bán kính) theo ngôn ngữ Material 3 và macOS/iOS app icon container.
- **Nền Deep Dusk Navy**: Dải chuyển sắc từ `#1A2644` xuống `#0B111D` tạo độ sâu quang học sang trọng, không chói mắt trên cả Dark Toolbar (`#202124`) và Light Toolbar (`#FFFFFF`).
- **Viền phản quang (Rim Light & Frame)**:
  - Viền ngoại vi: 2.5px viền màu Dusk Blue `#3E5BA3`.
  - Viền nội vi: 1.2px viền phản quang vi mô `rgba(255, 255, 255, 0.12)` tạo hiệu ứng thủy tinh nổi khối 2.5D.

### C. Giải Phẫu Hình Học Liền Khối Google M3 (Continuous Sync Streams)
- **Hình học đúc liền (Single Continuous Path)**: Thân cung tròn và đầu mũi tên được kiến tạo từ giải phẫu toán học chuẩn mực của Google Material Symbols `sync`, loại bỏ 100% hiện tượng lệch tiếp tuyến hay hở mối nối của cách vẽ ghép khối thông thường.
- **Luồng tiến (Backlog → Redmine)**:
  - Cung xoay đồng bộ góc 90° mượt mà.
  - Gradient chuyển sắc: Sky Blue (`#38BDF8`) sang Electric Indigo (`#818CF8`).
  - Đầu mũi tên hướng về phía trước thể hiện chiều chuyển giao dữ liệu từ Backlog sang Redmine.
- **Luồng lùi (Redmine → Backlog)**:
  - Cung xoay đối xứng góc 270°.
  - Gradient chuyển sắc: Rose Coral (`#FB7185`) sang Crimson (`#F43F5E`).
  - Đầu mũi tên hướng ngược lại thể hiện chiều phản hồi cập nhật và đồng bộ trạng thái issue.

### D. Không Gian Âm Khoáng Đạt (Negative Space Core)
- Loại bỏ hoàn toàn hộp chữ nhật đè ở tâm và vi mô text không đọc được ở 16px.
- Vùng không gian âm ở trung tâm tạo độ cân xứng hoàn hảo, giúp icon giữ nguyên độ sắc nét đỉnh cao ở mọi kích thước, từ 128px đến 16px trên Chrome Toolbar.

### E. Danh Mục File & Kích Thước Xuất Bản
| Tệp Tin | Kích Thước | Ứng Dụng |
| :--- | :--- | :--- |
| `assets/icons/icon.svg` | Vector (128x128) | Tệp thiết kế nguồn, dễ dàng mở rộng và trích xuất. |
| `assets/icons/icon-128.png` | 128x128 px | Chrome Web Store, biểu tượng giới thiệu chi tiết tiện ích. |
| `assets/icons/icon-48.png` | 48x48 px | Header cửa sổ Popup, trang Quản lý tiện ích (chrome://extensions), Hero Options. |
| `assets/icons/icon-16.png` | 16x16 px | Thanh công cụ trình duyệt (Chrome Toolbar Action), Favicon trang Options. |

---

## 4. Chuẩn Hóa Trải Nghiệm Giao Diện Mới Nhất

1. **Thanh Tab Options (Navigation Tab Bar)**:
   - Tab active được cấp nền `var(--primary)`, màu chữ và fill icon `#FFFFFF` trắng thuần khiết kèm đổ bóng `box-shadow: 0 2px 8px rgba(0, 0, 0, 0.45)`, loại bỏ hoàn toàn hiện tượng chữ xanh tối chìm trên nền đen.
2. **Thẻ Chọn Model AI (Model Chips & Verification)**:
   - Thiết lập `gap: 8px 10px` và margin đệm chống dính viền, phân cách thoáng đãng giữa các model.
   - Toàn bộ trạng thái test model chuyển từ ký tự emoji sang icon SVG Google Material Symbols chuẩn (`SCIENCE`, `SPINNER`, `CHECK`, `CLOSE`).
3. **Đồng Bộ Trạng Thái Tự Động (Auto-Verification & Self-Healing)**:
   - Tự động gửi yêu cầu kiểm tra ngầm khi nhập key (debounce 700ms) hoặc blur trường dữ liệu, không bắt buộc người dùng bấm nút thủ công.
   - Tự động đồng bộ trạng thái "Đã kết nối và lưu" giữa Options và Popup khi tải trang.
4. **Header Đồng Nhất Thương Hiệu**:
   - Trang Options trang bị khối Hero Brand với Logo B2R 48px, nhãn phiên bản `.version-badge` và mô tả chức năng đồng nhất với Popup.

---

## 5. Quy Chuẩn Month Picker & Điều Hướng Thời Gian (Redmine Log Time)

1. **Kích Thước & Tỷ Lệ Đồng Bộ (28px Standard Height)**:
   - Các nút chevron điều hướng lùi/tiến (`#tb-month-prev`, `#tb-month-next`), ô nhập tháng (`#tb-monthly-log-month`), và nút "Tháng này" (`#tb-month-today`) đều có chiều cao cố định **`28px`**, tạo thành một cụm điều khiển segmented gọn gàng, liền mạch.
2. **Biểu Tượng Chevron Vector SVG Chuẩn**:
   - Thay thế hoàn toàn ký tự thô `‹` và `›` bằng icon SVG Google Material Symbols chuẩn: `TB_ICONS.CHEVRON_LEFT` và `TB_ICONS.CHEVRON_RIGHT` (16x16px, căn giữa quang học).
3. **Hiển Thị Lịch Trình Duyệt trong Dark Mode**:
   - Áp dụng bộ lọc nghịch đảo màu `filter: invert(0.85);` cho biểu tượng lịch mặc định của trình duyệt (`::-webkit-calendar-picker-indicator`), hover tăng lên `invert(1)`, đảm bảo biểu tượng lịch luôn hiển thị rõ ràng trên nền tối mà không phụ thuộc vào OS.
4. **Chuẩn Hóa Focus Ring (M3 Focus-Visible)**:
   - Triệt tiêu hoàn toàn viền trắng mặc định của trình duyệt: `outline: 2px solid #3E5BA3` (Light Mode) và `outline: 2px solid #9BB4F5` (Dark Mode) với `outline-offset: 1px`.

---

## 6. Quy Chuẩn Loại Bỏ AI Cliché & Làm Sạch Ngôn Ngữ Hệ Thống

1. **Tuyệt Đối Không Dùng AI Cliché**:
   - Loại bỏ hoàn toàn icon ngôi sao lấp lánh 4 cánh (`AUTO_AWESOME`), đũa phép thần kỳ hay các biểu tượng ma thuật. Tiện ích Backlog2Redmine là công cụ kỹ thuật đồng bộ và tự động hóa chuyên nghiệp, trung tính và thực dụng.
   - Thay thế toàn bộ bằng các biểu tượng chức năng thuần túy: `TB_ICONS.TRANSLATE` (Chuyển ngữ), `TB_ICONS.SYNC` (Đồng bộ), `TB_ICONS.SETTINGS` (Cấu hình).
2. **Không Lạm Dụng Emoji Trong Nút & Tiêu Đề**:
   - Tiêu đề section và nút bấm không nhồi nhét emoji glyphs (`🤖`, `🔄`, `🐞`, `📥`, `🗑️`, `🔔`, `🔍`, `☕`, `🚀`, `🔑`, `💡`).
   - Sử dụng Text thuần túy kết hợp nhãn ngữ nghĩa chuẩn hoặc icon SVG từ danh mục `TB_ICONS`.
3. **Tính Toàn Vẹn Của Mã Hóa UTF-8**:
   - Toàn bộ các file HTML, JS và catalogs đa ngôn ngữ (`_locales/`) phải giữ nguyên encoding UTF-8 chuẩn. Nghiêm cấm để lọt các chuỗi mã hóa kép (Mojibake như `Cáº¥u hÃ¬nh`, `Ä iá» u gÃ¬`).
   - Mọi nút bấm, nhãn và tab điều hướng phải gắn thuộc tính `data-i18n` để tự động chuyển ngữ theo locale người dùng chọn.

---

## 7. Tiêu Chuẩn Ảnh Chụp Màn Hình Cửa Hàng (Chrome Web Store Assets)

1. **Quy Cách Kỹ Thuật (Chrome Web Store Guidelines)**:
   - **Kích thước chuẩn**: `1280 x 800 px` (Tỷ lệ 16:10).
   - **Định dạng**: PNG 24-bit sắc nét, không viền rách, kết xuất qua Headless Chrome với lệnh `node scripts/generate-cws-screenshots.js`.
   - **Số lượng**: Tối đa 5 ảnh, tập trung vào 5 giá trị then chốt của tiện ích.
2. **Bố Cục Trình Diễn 3 Tầng Hiện Đại**:
   - **Tầng 1 (Category Badge)**: Pill tag trên cùng mang màu thương hiệu (`#38BDF8` với chấm phát quang 6px).
   - **Tầng 2 (Typography Hierarchy)**: Tiêu đề H1 (32px, bold 800, chuyển sắc trắng sáng) và phụ đề giải thích giá trị thực tế (15px, Slate 400).
   - **Tầng 3 (Window Mockup Canvas)**: Khung trình duyệt macOS-style với traffic lights (`#EF4444`, `#F59E0B`, `#10B981`), thanh URL thanh lịch, và khung hiển thị giao diện độ nét cao kèm đổ bóng đa lớp `box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.7)`.
3. **Danh Mục 5 Ảnh Cốt Lõi**:
   | Thứ Tự | Tính Năng Trọng Tâm | Tệp Tiếng Việt (`screenshots_vi/`) | Tệp Quốc Tế (`screenshots_en/`) |
   | :---: | :--- | :--- | :--- |
   | **01** | **Đồng bộ bình luận 2 chiều & Dịch AI** | `01_bi_directional_sync.png` | `01_bi_directional_sync.png` |
   | **02** | **Báo cáo & Ghi log thời gian tháng** | `02_redmine_monthly_worklog.png` | `02_redmine_monthly_worklog.png` |
   | **03** | **Popup điều khiển nhanh & Sức khỏe API** | `03_quick_popup.png` | `03_quick_popup.png` |
   | **04** | **Chuyển đổi Issue & Liên kết 2 chiều** | `04_issue_migration.png` | `04_issue_migration.png` |
   | **05** | **Đa AI Model & Bảo mật AES-GCM** | `05_multi_ai_security.png` | `05_multi_ai_security.png` |
