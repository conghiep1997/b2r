# Nhật ký thay đổi (Changelog) - Backlog2Redmine

Tất cả các thay đổi đáng chú ý của dự án Backlog2Redmine (B2R) sẽ được ghi lại trong tệp này.
Định dạng dựa trên [Keep a Changelog](https://keepachangelog.com/).
(Bản tiếng Anh chính thức: [CHANGELOG.md](./CHANGELOG.md))

## [1.8.22] - 2026-10-28
- **✨ Thêm mới**: Hàng đợi ngoại tuyến & tự động thử lại (`retryQueue` / `tb_retry_queue`) tự động lưu lại các bình luận và tác vụ di chuyển thất bại khi mất mạng, lắng nghe sự kiện `online` để tự động gửi lại khi có kết nối mạng, cùng giao diện quản lý queue trong tab Nâng cao của trang Options (xem danh sách chờ, thử lại thủ công, xóa hàng đợi).
- **✨ Thêm mới**: Kiểm tra kết nối trực tiếp cho Backlog và nhà cung cấp AI chính ngay trong trang Cài đặt, hiển thị kết quả xác thực inline và tự động kiểm tra khi lưu thông tin đăng nhập; thanh Lưu (Save) dạng nổi cố định với hiệu ứng vi mô (đang lưu, đã lưu) và phím tắt `Ctrl+S` / `Cmd+S`.
- **✨ Thêm mới**: Bộ nhớ đệm bản dịch bền vững (`translationCache`) phản hồi 0ms với LRU in-memory kết hợp lưu trữ cục bộ, có công tắc bật/tắt và nút xóa bộ nhớ đệm trong Options.
- **✨ Thêm mới**: Xuất/nhập cấu hình dự án an toàn dưới dạng file JSON (`configTransfer`), loại bỏ hoàn toàn nguy cơ rò rỉ API key, hỗ trợ cả hai chế độ Gộp (Merge) và Ghi đè (Replace).
- **✨ Thêm mới**: Tùy chỉnh phong cách/giọng văn dịch thuật (`technical` [Kỹ thuật - mặc định], `formal` [Trang trọng], `concise` [Ngắn gọn]) đưa trực tiếp vào prompt AI.
- **✨ Thêm mới**: Bộ lọc tìm kiếm nhanh cài đặt (`#optionsSearchInput`) trên trang Options với tính năng khớp thời gian thực, tự động mở rộng mục `<details>`, chuyển tab thông minh và phím tắt (`/` để tìm kiếm, `Esc` để xóa).
- **🔧 Sửa lỗi**: Cho phép đóng/mở hướng dẫn cài đặt từ thanh điều hướng trên cùng, duy trì trạng thái đóng mở giữa các lần mở trang; cải thiện phản hồi giao diện nút lưu cho các trạng thái chờ, thành công và vô hiệu hóa.
- **🔧 Sửa lỗi**: Thêm tiền tố `tb_retry_queue` vào danh sách transient storage trong service worker để không xóa nhầm bộ nhớ đệm cài đặt đã giải mã; đăng ký xác thực message contracts cho hàng đợi thử lại.
- **📝 Tài liệu**: Cập nhật nhãn song ngữ Anh - Việt cho hướng dẫn thiết lập, cache bản dịch, xuất nhập cấu hình, phong cách dịch, tìm kiếm cài đặt và hàng đợi thử lại; bổ sung bộ unit test toàn diện (182 tests đều vượt qua).


## [1.8.21] - 2026-10-27
- **✨ Thêm mới**: Bộ chọn tháng (`YYYY-MM`) trong modal Redmine Monthly Log Time cho phép xem trước, ghi nhận và xóa thời gian đã log cho bất kỳ tháng nào trong quá khứ hoặc hiện tại, kèm liên kết sâu `#b2r-monthly-log` từ popup extension.
- **✨ Thêm mới**: Đồng bộ theme tối (`data-tb-theme="dark"`) cho toàn bộ modal, bảng dữ liệu, thẻ card và banner được inject vào Backlog/Redmine theo tùy chọn `themePreference`.
- **✨ Thêm mới**: Phím tắt điều hướng (`Escape` để đóng, `Ctrl+Enter` / `Cmd+Enter` để xác nhận), debounce tìm kiếm Issue ID Redmine, thẻ chọn file đính kèm trực quan khi di chuyển issue, và thông báo toast tương tác (rê chuột tạm dừng, nhấp để tắt, hỗ trợ ARIA live regions).
- **✨ Thêm mới**: Chuyển đổi ngôn ngữ giao diện tức thì trên trang Options không cần tải lại trang và không làm mất dữ liệu đang nhập dở; tự động gợi ý autocomplete `@mention` Backlog với ký tự Unicode và tên nhiều từ.
- **🔧 Sửa lỗi**: Cải thiện hàm `normalizeTranslationOutput` nhằm giữ nguyên danh sách đánh số Markdown và văn bản `Result:` inline, lọc bỏ sớm các đánh dấu đồng bộ B2R và truyền cờ thử lại fallback rõ ràng.
- **🔧 Sửa lỗi**: Chia nhỏ chuỗi base64 khi gọi `encryptData` để tránh lỗi tràn ngăn xếp (call-stack overflow) khi mã hóa khối cấu hình lớn, loại bỏ trùng lặp khi khởi tạo song song `getUserStorageId`.
- **🔧 Sửa lỗi**: Gắn thẻ các bản ghi log time đơn lẻ với tiền tố `[B2R report:<id>]` giúp việc xóa dữ liệu hàng tháng dọn dẹp chính xác, đồng thời bản địa hóa toàn bộ nhãn trạng thái và tóm tắt báo cáo.
- **🔧 Sửa lỗi**: Loại bỏ xung đột tiền tố khi tìm mã issue Redmine (`PROJ-1` vs `PROJ-10`) và các đánh dấu di chuyển (`_1` vs `_10`), xử lý ký tự thay thế `$` trong định dạng file đính kèm Redmine, bỏ qua bình luận rỗng/đã xóa khi chống trùng lặp.
- **🔧 Sửa lỗi**: Kiểm tra API key AI thực tế đã lưu trong quy trình kiểm tra trạng thái của popup, ẩn các phương thức donate chưa cấu hình, cô lập `baseSettings` khi dịch toàn bộ bình luận và giữ cache cấu hình background ổn định khi ghi storage tạm thời.
- **📝 Tài liệu**: Bổ sung các bộ unit test bao phủ chuẩn hóa kết quả dịch, mã hóa dữ liệu lớn, loại bỏ marker đồng bộ, định dạng file đính kèm Redmine, khử trùng bình luận và khớp marker di chuyển.


## [1.8.20] - 2026-10-26
- **✨ Thêm mới**: Thuật ngữ chuyên ngành (glossary) theo từng dự án, lưu ánh xạ issue tương ứng, xem trước di chuyển kèm chọn lọc bình luận/tệp tin, và điểm khôi phục (checkpoint) cho phép tiếp tục di chuyển khi bị gián đoạn.
- **✨ Thêm mới**: Cấu hình chế độ dịch và đồng bộ ngược tùy chỉnh, hồ sơ liên kết cặp dự án, quy tắc tìm kiếm/tiêu đề di chuyển, bí danh tracker (tracker aliases) và chính sách trường tùy chỉnh (custom field policies).
- **✨ Thêm mới**: Quy tắc log time theo tháng và chọn dự án báo cáo, bổ sung môi trường sandbox Redmine cục bộ để kiểm thử.
- **🔧 Sửa lỗi**: Ngăn chặn đồng bộ và tạo issue trùng lặp khi bị ngắt kết nối giữa chừng; bảo toàn phần việc đã hoàn thành và đối soát kết quả chưa rõ ràng trước khi thử lại.
- **🔧 Sửa lỗi**: Xác thực đích đến Redmine, tệp đính kèm, kế hoạch log time và cấu hình trước khi ghi; cô lập dữ liệu workspace/project và bảo vệ thông tin đăng nhập đã mã hóa.
- **📝 Tài liệu**: Mở rộng tài liệu hướng dẫn thiết lập, trang Options, quy trình di chuyển, phục hồi lỗi và sandbox; cập nhật ảnh chụp màn hình và tài liệu kỹ năng agent.
- **📝 Tài liệu**: Thêm phần đánh giá triển khai và ghi chú xác thực trong `IMPLEMENTATION.md`.


## [1.8.19] - 2026-10-22
- **✨ Thêm mới**: Bộ chọn dự án Redmine duy nhất dùng chung cho cả di chuyển issue và báo cáo tháng.
- **🔧 Sửa lỗi**: Trạng thái cài đặt trên popup phản ánh chính xác API key và nhà cung cấp AI bắt buộc cho từng chiều đồng bộ; luồng tổng thể chấp nhận khóa Redmine hoặc Backlog khi đã cấu hình AI.
- **🔧 Sửa lỗi**: Áp dụng chế độ tra cứu issue riêng theo dự án, ký tự phân cách tiêu đề, alias tracker và giới hạn phạm vi dự án Redmine; tránh chọn nhầm kết quả tìm kiếm không liên quan.
- **🔧 Sửa lỗi**: Áp dụng nhất quán quy tắc log time đã chọn trong xem trước, xác nhận và kiểm tra trước khi ghi dữ liệu.
- **📝 Tài liệu**: Đơn giản hóa hướng dẫn trên trang Options, loại bỏ các giải thích trùng lặp về API key và domain workspace.


## [1.8.18] - 2026-10-02

### Thêm mới
- Cấu hình độc lập cặp ngôn ngữ nguồn/đích cho chiều Backlog → Redmine và chế độ trích xuất, dịch thuật hoặc giữ nguyên nội dung gốc cho chiều Redmine → Backlog.
- Cấu hình số giờ log time mỗi ngày, phân bổ đều hoặc theo ước lượng (estimate) theo bước 15 phút, và thiết lập hoạt động mặc định/kiểm thử từ API.
- Chọn dự án Báo cáo theo hồ sơ workspace trong hộp thoại ghi nhận thời gian hàng tháng.

### Sửa lỗi
- Tra cứu đích đến Redmine bằng kết quả API phân trang đầy đủ thay vì chỉ trang HTML đầu tiên; khớp chính xác Backlog key và từ chối các kết quả mơ hồ.
- Giữ nguyên cấu hình khi người dùng chủ động bỏ chọn model.
- Phân biệt tệp đính kèm di chuyển theo ID nguồn.
- Chấp nhận payload đã sửa sau lỗi xác nhận trong khi vẫn giữ nguyên các phần việc đã hoàn thành và ánh xạ issue sửa thủ công.
- Khôi phục thông tin đăng nhập cùng với tên miền khi việc đăng ký content script thất bại.
- Chỉ xóa checkpoint cũ sau khi đã lưu thành công checkpoint thay thế mới.
- Hủy bản xem trước báo cáo tháng khi thay đổi dự án và chặn ghi log time nếu kế hoạch giờ/hoạt động thay đổi trước khi bấm xác nhận.
- Loại bỏ fallback cứng ID hoạt động thời gian.

### Cải tiến
- Duy trì ngôn ngữ dịch đã chọn qua các bước fallback nhà cung cấp và prompt thuật ngữ; dùng ngôn ngữ đích cho nhãn thu gọn bình luận đã dịch.
- Hỗ trợ tiêu đề issue không chứa Backlog key thông qua bảng ánh xạ đã lưu.
- Tối ưu checkpoint đã hoàn thành, giới hạn phạm vi khóa thao tác và giải mã dữ liệu theo workspace hiện tại.
- Yêu cầu nạp glossary trước khi lưu, bảo vệ các chỉnh sửa chưa lưu và cấm chỉnh sửa khi đang gửi request.

### Xác thực
- Vượt qua 134 unit tests và 24 browser tests, bao gồm bài kiểm tra khói với extension MV3 thực tế.
- Lint, format, đồng bộ phiên bản và build đều hoàn tất thành công.


## [1.8.17] - 2026-09-24

- **Thêm mới**: Hướng dẫn cho người dùng mới lần đầu mở extension, lịch sử đồng bộ, chế độ chạy thử (dry run) chỉ xem trước, và hiển thị trạng thái thử lại/nhà cung cấp AI rõ ràng hơn. Mở rộng kiểm thử tự động cho Popup, Options, Backlog và Redmine.
- **Monthly Log Time**: Thêm lối tắt từ popup đến Redmine monthly log. Hiển thị danh sách task, số giờ dự kiến và các mục đã log trước khi ghi; yêu cầu xem trước mới và chặn ghi đè không an toàn khi dữ liệu bị thay đổi.
- **Cải tiến xoay vòng Gemini**: Đặt trước một slot model/key trước mỗi request để các lượt dịch đồng thời chạy trên các slot khác nhau. Đưa Gemini key vào thời gian hồi (cooldown) sau khi nhận mã lỗi rate limit, giữ lỗi theo cặp model/key; tuân thủ header `Retry-After` khi server trả về.
- **Cấu hình Gemini**: Kiểm tra từng khóa Gemini đã thiết lập cho model được chọn và hiển thị vị trí khóa bị lỗi. Vẫn tương thích với cài đặt cũ chỉ chứa một khóa Gemini đơn lẻ.
- **Mô hình AI**: Bổ sung Gemini 3.5 Flash Lite, loại bỏ dòng Gemini 2.0 khỏi danh sách chọn, tự động dùng model mặc định khi cấu hình cũ chỉ chứa các model đã ngừng hỗ trợ.
- **Popup**: Khôi phục nhãn nút "Monthly Log Time" đã bản địa hóa và đưa lên trên các liên kết nhanh của Redmine/Backlog giúp điều hướng thuận tiện hơn.
- **Sửa lỗi**: Ghi nhận các lượt đồng bộ thất bại và hoàn thành một phần; tránh đăng lại bình luận đã gửi khi thử lại trên cùng modal; giữ trạng thái thành công khi lưu lịch sử thất bại. Yêu cầu workspace Backlog phải chạy HTTPS đáng tin cậy trước khi gửi API key. Giới hạn trạng thái AI theo đúng tab/frame yêu cầu, gắn cache dự án và kiểm tra kết nối với cấu hình hiện tại.
- **Bản địa hóa & UI**: Bản địa hóa toàn bộ tiến trình Redmine và văn bản trên trang Options, bao gồm nhãn động, placeholder, văn bản thay thế và nhãn trợ năng (accessibility). Đồng bộ danh mục tin nhắn tiếng Anh và tiếng Việt.
- **Tài liệu & Xác thực**: Cập nhật ảnh chụp màn hình demo; vượt qua build, lint, format, 56 unit tests và 9 mocked-browser E2E tests.


## [1.8.16] - 2026-09-21

### Thêm mới
- Đính kèm các bản ghi nhật ký lỗi mới nhất vào báo cáo lỗi khi tải xuống, sao chép hoặc mở GitHub Issue.

### Sửa lỗi
- Đổi ngôn ngữ mặc định của extension sang tiếng Anh.
- Cải thiện nút chọn Ngôn ngữ và Giao diện trên trang Options với viền và bố cục rõ ràng hơn.
- Cải thiện độ tương phản giao diện tối (dark mode) trên các mục cấu hình và form điều khiển.
- Bản địa hóa liên kết tài khoản cá nhân Redmine.
- Sửa lỗi xử lý xem trước ảnh chụp màn hình và thêm thông báo lỗi khi ảnh không hiển thị được.
- Giữ nguyên placeholder dạng `<flow_guide_id>` khi dịch/đồng bộ ghi chú sang Redmine.
- Tự động decode ký tự `<>` bị AI escape HTML trước khi gửi sang Redmine; giữ nguyên thực thể trong khối mã code fence/inline.
- Textile không còn bị double-escape placeholder ngoài allowlist.
- Trích xuất nội dung Backlog giữ nguyên thẻ tùy chỉnh dạng `<flow_guide_id>` thay vì làm mất.

### Cải tiến
- Prompt AI bảo vệ nguyên vẹn các placeholder `<id>` / `<flow_guide_id>`.
- Bổ sung các hàm tiện ích `decodeHtmlEntitiesOutsideCode`, `buildRedmineUploadUrl`, và `normalizeBacklogOrigin`.
- Thêm unit test cho giải mã dấu ngoặc nhọn, placeholder Textile và trích xuất thẻ tùy chỉnh.

### Tài liệu
- Cập nhật tài liệu cho trang Options, xem trước ảnh màn hình, bản địa hóa và báo cáo lỗi kèm log.
- Cập nhật `CHANGELOG.md` cho bản 1.8.16.


## [1.8.15] - 2026-09-20

### Thêm mới
- Bổ sung i18n cho popup, Options và luồng Log Time Redmine với tiếng Việt/English.
- Thêm lựa chọn ngôn ngữ thủ công và theme Sáng/Tối/Theo hệ thống, lưu cục bộ.
- Thêm luồng Báo lỗi end-user: mô tả, bước tái hiện, URL, môi trường, log gần nhất và ảnh chụp tùy chọn.
- Cho phép tải report JSON + ảnh, sao chép report hoặc mở GitHub Issue đã điền sẵn.
- Tạo skill dùng chung `extension-ui` cho các extension tiếp theo: design tokens, theme, accessibility, i18n và bug-report privacy.
- Hoàn thiện catalog locale đồng bộ toàn bộ message keys giữa tiếng Việt và tiếng Anh cho popup, Options và modal/report UI.

### Cải tiến
- Popup được chuyển thành dashboard trạng thái với message keys và fallback locale.
- Redmine Log Time dùng locale cho trạng thái, modal, bảng kết quả và lỗi.
- Options bổ sung card hỗ trợ, xem trước ảnh và cảnh báo dữ liệu trước khi gửi bug report.

### Bảo mật & Quyền riêng tư
- Bug report không tự động upload dữ liệu; người dùng chủ động tải xuống hoặc mở GitHub.
- Ảnh đính kèm giới hạn 5 MB và chỉ nhận PNG/JPEG/WebP.
- API key không được đưa vào popup hoặc metadata report.

### Xác thực
- `npm run lint` đạt.
- `npm run check:version-sync` đạt.
- Locale JSON và manifest hợp lệ.


## [1.8.14] - 2026-09-19

### Thêm mới
- Thêm popup cho extension khi click icon, hiển thị trạng thái cấu hình và project Redmine hiện tại.
- Thêm khu vực Donate coffee với tab ngân hàng, MoMo và PayPal.
- Thêm icon mới cho extension và các icon trực quan cho thao tác trong popup.

### Sửa lỗi
- Đồng bộ kích thước button, layout popup và modal donate để tránh text bị cắt/tràn.
- Hiển thị rõ luồng đang hoạt động `Backlog → Redmine`; đánh dấu `Redmine → Backlog` chưa sẵn sàng.
- Popup lấy tên project Redmine qua background service thay vì hiển thị ID cho end-user.
- Bổ sung validation cho message `GET_DEFAULT_PROJECT_SUMMARY` và validate URL trước khi mở tab.
- Giảm thông tin trùng lặp giữa status card và project card.

### Cải tiến
- Popup sử dụng thiết kế phẳng, màu hài hòa, icon rõ ràng và hierarchy dễ quét hơn.
- Giữ API key không hiển thị trong popup; request lấy project chỉ được phép từ extension pages.

### Tài liệu
- Cập nhật changelog cho popup, project summary, donate và icon mới.


## [1.8.13] - 2026-09-18

> Sửa đồng bộ file đính kèm Backlog → Redmine (đặc biệt file video `.mp4` / tên tiếng Nhật).

### Sửa lỗi
- Upload Redmine gửi đủ `?filename=` trên `/uploads.json` (tránh lỗi 422 khi server bật lọc extension; hỗ trợ tên file tiếng Nhật như `3653_API呼び出しあり.mp4`).
- Chuẩn hóa Backlog origin khi fallback download web (không còn ghép `https://https://...` khi domain lấy từ settings).
- Từ chối blob download không hợp lệ (HTML login / JSON lỗi / rỗng) trước khi upload.
- Scrape thêm link `downloadAttachment/` và `ViewAttachmentVideo` cho comment và description.
- Thông báo `[Attachment Error: …]` kèm lý do ngắn (status/upload failed) để dễ debug (ví dụ vượt max file size trên Redmine).

### Cải tiến
- Helper `normalizeBacklogOrigin` / `buildRedmineUploadUrl`; unit test cho URL upload + normalize domain.

### Tài liệu
- Cập nhật `CHANGELOG.md` cho bản 1.8.13.


## [1.8.12] - 2026-09-15

> Lookup theo title JP (bỏ qua bản dịch VN), migrate kèm comment mặc định, giữ link Backlog khi sync sang Redmine.

### Thêm mới
- Lookup Redmine tách phần title tiếng Nhật trước ` / (…)` để khớp dù bản dịch VN khác.
- HTML/API search thử **riêng** issue key và title JP (không AND cả hai); API dùng `subject=~` + `status_id=*`.
- **Di chuyển Issue** dịch sẵn và bật mặc định di chuyển toàn bộ comment/note bên dưới (nếu có).
- Migrate luôn hiện success modal kèm link Redmine (`forceShow`), không phụ thuộc tùy chọn ẩn modal.
- Absolutize link Backlog tương đối (`/view/KEY`) và convert sang Textile `"label":url` khi gửi Redmine.
- Unit test cho match JP/VN bilingual subject, relative Backlog links, và drop `javascript:` links.

### Sửa lỗi
- Không còn miss issue Redmine khi subject dạng `【調査】… / ([Điều tra] …)` không chứa Backlog key.
- Link issue trong comment không còn mất / hiện raw Markdown `[KEY](/view/KEY)` trên Redmine.
- Dịch 1 comment lỗi không chặn cả flow migrate (fallback text gốc).
- Chỉ coi `/user/` trên host Backlog là profile link; chỉ emit Textile link `http/https`.

### Cải tiến
- Options: copy “Hiển thị modal thành công…” làm rõ **chỉ áp dụng dịch/gửi comment**; Di chuyển Issue luôn hiện modal + link.
- Checkbox “Không hiển thị lại” trên success modal ghi chú chỉ ảnh hưởng dịch comment.

### Tài liệu
- Cập nhật `CHANGELOG.md`, `README.md` (migrate + options), skill `cross-platform-sync` / `extension-ui`.


## [1.8.11] - 2026-08-27

> Ưu tiên tracker khi lookup Redmine, giữ đúng format Markdown, hotfix migrate/batch/security P0.

### Thêm mới
- Ưu tiên tìm issue Redmine theo tracker dựa trên Backlog issue type (`QA` → `Q/A`/`Q&A`).
- Convert thêm underline, màu chữ/nền (`&color`/`<mark>`), và task list checkbox từ Backlog sang Markdown.
- Thêm unit test cho `extractBacklogContent` (code fence, inline code đặc biệt, underline/color/task list).
- Proxy `REDMINE_AUTHORIZED_FETCH` để content script Redmine gọi API qua service worker (không nhận plaintext API key).
- Thống nhất copy UI tiếng Việt (bỏ lẫn EN cứng trong modal/content; giữ tên riêng Redmine/Backlog/Issue).

### Sửa lỗi
- Không còn phá code fence ` ``` ` khi cleanup Markdown (trước đây ``+/g làm mất format code block trên Redmine).
- Giữ nguyên ký tự đặc biệt trong code (`--`, `/*`, `;`, `0x...`) khi convert và khi AI dịch.
- Map tracker migrate `QA` sang `Q/A` (kèm fallback `Q&A`) thay vì chỉ khớp `Q&A`.
- Migrate comments dùng `memoizedBatchNotes` (trước đây `currentNotesList.slice(1)` luôn rỗng).
- Batch notes không còn nhân đôi note đầu do lệch contract `mergeTranslatedBatchNotes`.
- `fixed_version_id` được gửi khi create issue Redmine.
- Lookup API không còn fallback `issues[0]` khi tracker không khớp preference.
- Báo lỗi rõ khi một phần comment migrate thất bại.
- Origin allowlist cho privileged handlers (Backlog / Redmine / Options).

### Cải tiến
- Truyền `backlogIssueType` vào lookup/cache để phân biệt đúng issue khi cùng title có cả Task và Q/A.
- Rút gọn SYSTEM prompt (~giảm phí token cố định) và bổ sung bảo vệ `[[TB_FILE]]`.
- Empty Backlog issue type / type lạ không ép prefer tracker (no preference).
- Map Backlog `要望` / `要望（実装）` / `タスク` → Redmine `Task` (tránh lookup nhầm Q/A cùng title).
- Convert Markdown → Textile khi gửi note/description lên Redmine.
- Preview modal: Xem trước (Markdown) / Redmine (MD → Textile → HTML gần note thật).
- Không gọi `closeModal()` sau confirm để tránh che success modal.
- Prompt: cấm bọc @mention bằng link; đã Việt thì chỉ chỉnh nhẹ.
- Create-issue error giữ đúng HTTP status khi sanitize.
- Toast partial migrate kèm index comment lỗi và lý do đầu tiên.


## [1.8.10] - 2026-07-07

### Sửa lỗi
- Khôi phục kiểm tra bản cập nhật khi endpoint phiên bản backend trả về 404 bằng cơ chế fallback sang GitHub Releases.
- Giữ quy trình xuất bản GitHub release thành công ngay cả khi đăng ký phiên bản backend tùy chọn không khả dụng.
- Cho phép trang Options lưu API key vừa nhập trực tiếp mà không bắt buộc phải nhấn phím Enter trước.
- Hiển thị bản xem trước Markdown ổn định cho các đoạn văn, danh sách, danh sách việc cần làm (task list), bảng dữ liệu, gạch ngang và khối mã code block.

### Cải tiến
- Khôi phục cấu hình ánh xạ Trường tùy chỉnh (Custom Fields) mặc định cho tính năng di chuyển issue và gộp các giá trị mặc định còn thiếu vào JSON đã lưu.
- Tinh chỉnh khoảng cách và kiểu dáng hiển thị xem trước Markdown cho danh sách, bảng biểu, trích dẫn khối và khối mã code block.
- Mở rộng kiểm tra định dạng code style (format check) cho các thư mục scripts, tests, manifest và siêu dữ liệu package.


## [1.8.09] - 2026-07-05

> Tăng cường bảo mật, độ ổn định và khả năng kết nối với Redmine domain tùy chỉnh.

### Thêm mới
- Hỗ trợ Redmine domain tùy chỉnh bằng optional host permission và dynamic content script.

### Sửa lỗi
- Inject lại custom Redmine content scripts vào tab đang mở sau extension update.
- Cô lập lỗi query/inject từng tab để không làm gián đoạn service-worker lifecycle.
- Inject custom Redmine content scripts vào tab đang mở ngay sau khi cấp permission.
- Dùng isolated-world marker để tránh inject trùng và lỗi redeclare globals.
- Tách dedupe scope theo sender origin để không gộp request giữa các Backlog workspace.
- Rollback domain/registration khi cập nhật custom Redmine thất bại.
- Tự đồng bộ dynamic content script khi extension được install hoặc update.
- Chuẩn hóa Redmine domain về origin và gỡ permission/script cũ khi đổi domain.
- Tự động sanitize error logs cũ khi extension khởi động hoặc được cập nhật.
- Chặn message không hợp lệ, sender ngoài extension và payload vượt giới hạn trước privileged handlers.
- Ngăn API key/token xuất hiện trong timeout errors và persistent error logs.
- Bổ sung host permissions cho Groq và OpenRouter.
- Loại bỏ HTML injection từ model labels và settings error messages.
- Cấp đúng host permission cho API kiểm tra phiên bản.
- Chỉ xử lý click từ notification cập nhật của B2R và bỏ qua version response không hợp lệ.
- Tránh dùng cache Redmine issue cũ khi domain, issue summary hoặc settings thay đổi.

### Cải tiến
- Gộp các request gửi comment giống hệt đang chạy đồng thời để tránh double-submit.
- Cho phép gửi lại bình thường ngay sau khi request trước hoàn tất.
- Xóa privileged handlers `LIST_MODELS` và `TEST_MODEL` không còn caller.
- Bắt buộc domain/API key/provider/model cho các Options API messages trước khi xử lý.
- Chuyển Redmine project sync và AI model test từ Options page sang privileged background handlers.
- Giới hạn các handler nhận API key chưa lưu chỉ cho sender là trang Options của extension.
- Dùng chung logic kiểm tra phiên bản giữa service worker và trang options.
- Bổ sung unit test cho so sánh phiên bản và loại bỏ web-accessible resource không tồn tại.
- Giới hạn settings trả cho content script theo đúng nhu cầu và xác thực origin trước khi cấp Redmine credential.

### Tài liệu
- Xóa các tham chiếu lỗi thời tới Google Sheet Testcase Converter khỏi repo guidance.
- Đồng bộ trách nhiệm formatting giữa Prettier và ESLint để build output không còn warning nhiễu.


## [1.8.07] - 2026-05-20

### Thêm mới
- Tích hợp chức năng "Google Sheet Testcase Converter" giúp chuyển đổi dữ liệu testcase sang định dạng mới.
- Hỗ trợ giao diện Standalone Page và Sidebar nổi (Floating Sidebar Button) trực tiếp trên Google Sheets.
- Cho phép tùy chỉnh Column Mapping (A, B, C, D...) để chuyển đổi cột linh hoạt.
- Bổ sung hướng dẫn tự động tạo OAuth2 Client ID và chèn snippet manifest động trên giao diện.

### Sửa lỗi
- Khắc phục cảnh báo ESLint, whitelisted các biến toàn cục Sheets API và Testcase Converter.


## [1.8.06] - 2026-05-11

### Thêm mới
- Thêm regex để phân tách notes trong modal, cải thiện parsing cho batch notes
- Thêm hỗ trợ multi-select cho fallback models và keys trong trang Options
- Thêm các function quản lý provider models và keys với mã hóa/giải mã

### Thay đổi
- Cập nhật options.html: xóa dropdown model cũ, thêm cấu hình fallback Gemini mới
- Cải thiện UX với cập nhật UI động dựa trên provider và models được chọn

### Tái cấu trúc
- Refactor logic xử lý notes trong openConfirmModal để sử dụng function parsing mới
- Cải thiện options.js để hỗ trợ multi-select và render models/keys được chọn


## [1.8.05] - 2026-05-08

### Loại bỏ
- Xóa bỏ hoàn toàn chức năng "Đồng bộ tất cả comments sang Backlog" do lỗi hiển thị và không cần thiết ở thời điểm hiện tại


## [1.8.04] - 2024-05-24

### Thêm mới
- Thêm hỗ trợ cho các mô hình "Generative Enhanced Models" (GEM) tùy chỉnh
- Tạo mục cấu hình riêng cho "Custom GEM", cho phép chỉ định API endpoint và API key

### Sửa lỗi
- Sửa lỗi nghiêm trọng trong chức năng "Migrate Issue" khi xử lý file đính kèm
- Cải thiện ghi log lỗi cho chức năng migrate với đầy đủ payload
- Khắc phục lỗi lưu API key, ngăn lưu giá trị ******

### Tái cấu trúc
- Dọn dẹp và tái cấu trúc file background.js để loại bỏ code trùng lặp

### Công việc định kỳ (Chore)
- Sửa tất cả lỗi và cảnh báo từ ESLint


## [1.8.03] - 2024-04-26

### Thêm mới
- Flow Redmine → Backlog: đồng bộ ngược từ Redmine sang Backlog
- Attachment handling: tự động extract và upload file đính kèm
- Batch sync: nút "Đồng bộ tất cả comments" với progress tracking
- Smart @mentions với dropdown gợi ý users khi gõ @
- Project-specific user loading từ API /api/v2/projects/{key}/users
- Lazy user loading chỉ khi nhập issue key hợp lệ

### Sửa lỗi
- Sửa lỗi userId: null khiến không tag được users
- Sửa lỗi modal không hiển thị user suggestions khi gõ @
- Sửa lỗi auto-load users với project key sai
- Thêm null checks cho user data

### Thay đổi
- Không auto-load users khi mở modal
- Hiển thị hint rõ ràng khi chưa có issue key
- Cải thiện UX: chỉ hiển thị dropdown khi có data users hợp lệ

### Tài liệu
- Cập nhật README.md với hướng dẫn flow Redmine → Backlog


## [1.8.02] - 2024-04-23

### Cải tiến
- Tối ưu translateBatch với Promise.all batch 5
- Thêm cleanup handlers để tránh memory leak
- Giới hạn MutationObserver scope vào container cụ thể
- Thêm projects caching 5 phút và debounce 500ms
- Thêm debounce và throttle utility functions

### Sửa lỗi
- Sửa reportProjectId dropdown không populate data
- Sửa lỗi status message bị mất sau khi lưu cấu hình

### Thay đổi
- Chuẩn hóa code style: đổi single quotes sang double quotes


## [1.8.01] - 2024-04-23

### Thêm mới
- Triển khai danh sách "Tứ trụ" AI mạnh mẽ (Gemma 3/4, Gemini 3.1)
- Cơ chế Load Balancing: xáo trộn random Model & Key
- Tự động nhận diện Gemma để sửa lỗi Error 400

### Sửa lỗi
- Khôi phục logic tìm kiếm Redmine ổn định
- Sửa lỗi hiển thị "Model ma" và cải thiện UI chọn model
- Vá lỗi cú pháp HTML trong trang Options


## [1.8.00] - 2024-04-23

### Thêm mới
- Cải thiện giao diện Options với collapsible sections
- Multiple Gemini Models dạng button clickable
- Multiple Gemini Keys gộp chung với Models
- Default chọn 5 models đầu tiên khi chưa có cấu hình

### Thay đổi
- Xóa dropdown Model cũ
- Fallback provider mặc định là "none"
- Loại bỏ Gemma 12B khỏi danh sách model

### Cải tiến
- Tối ưu margin/padding
- Đưa Custom Fields vào section Redmine
- Cải thiện hiệu năng AI với caching layer
- Tối ưu batch translation
- Cải thiện Redmine formatting trong preview
- Refactor AI service cho Gemma models
- Ổn định cấu hình "Tứ trụ" AI models

### Sửa lỗi
- Sửa logic load models mặc định khi không có cấu hình
- Clean up code thừa


## [1.7.02] - 2024-04-22

### Thêm mới
- Thêm lệnh npm run bump để tự tăng patch version
- Tự động tạo stub entry trong CHANGELOG.md khi bump
- Script check:version-sync kiểm tra đồng bộ version
- Multiple Gemini Models trong Options
- Cập nhật danh sách Gemini models lên series 2.5
- Cải thiện AI fallback cho lỗi 503

### Thay đổi
- Đổi màu giao diện từ đỏ sang xanh cho đồng nhất Cyan-Flow
- Primary Provider cố định là Gemini

### Sửa lỗi
- Khắc phục rủi ro CI/CD dùng version cũ
- Thêm fail-fast trong workflow

### Tài liệu
- Loại bỏ version hardcoded khỏi README.md
- Cập nhật .skills/agent_workflow.md và DEVELOPMENT.md


## [1.7.01] - 2024-04-22

### Thêm mới
- Thêm qwen/qwen3-32b vào danh sách model của Groq

### Thay đổi
- Curate lại danh sách model Groq và Cerebras
- Loại bỏ model 8B khỏi dropdown

### Sửa lỗi
- Sửa model ID của Cerebras Qwen thành qwen-3-235b-a22b-instruct-2507


## [1.7.00] - 2024-04-22

### Thêm mới
- Thêm Groq làm lựa chọn cho cả AI chính và dự phòng
- Multiple Gemini Keys trong trang Options
- Toggle preview trong modal
- Khối nhập Groq API Key cho cả primary và fallback
- Nút + Thêm Key để nhập nhanh Gemini keys

### Thay đổi
- Điều chỉnh bố cục form migrate
- Hoàn thiện dropdown model Groq
- Cập nhật danh sách Cerebras theo docs mới

### Sửa lỗi
- Mở rộng validate cấu hình và luồng đọc settings
- Cải thiện logic quét attachment
- Nới giới hạn chuẩn hóa xuống 2 dòng trống liên tiếp


## [1.6.01] - 2024-04-21

### Thêm mới
- Thêm tên người tạo và thời gian tạo comment vào bản ghi
- Tích hợp trường Target Version trong Modal Migrate
- Cơ chế "Look-Ahead" gộp file media
- Tự động tìm và gộp file đính kèm

### Thay đổi
- Chuyển Gemini làm AI chính và Cerebras làm fallback
- Cập nhật model mặc định: Gemini 3.1 Flash Lite, Cerebras GPT OSS 120B
- Giá trị mặc định Due Date là 3 ngày làm việc tiếp theo
- AI tự động nhận diện định dạng gốc tiếng Nhật

### Sửa lỗi
- Sửa lỗi không hiển thị "Saved" khi nhập Cerebras API Key
- Sửa lỗi mất dòng trống trong comment
- Sửa lỗi Ordered List và Blockquotes
- Đảm bảo đường dẫn dạng link click được
- Fix linting và parsing error
- Tối ưu khai báo global variables


## [1.6.00] - 2024-04-20

### Thêm mới
- Hiệu ứng làm mờ và Spinner khi đang migrate
- Nút Đồng bộ Project cập nhật danh sách dự án

### Thay đổi
- Tự động đóng Modal sau khi nhấn "Xem trên Redmine"
- Việt hóa và làm đẹp khu vực Logs
- Cache attachment (Deduplication)

### Sửa lỗi
- Xử lý triệt để lỗi AI làm sai định dạng ảnh
- Nhận diện Marker linh hoạt hơn
- Khắc phục lỗi hiển thị Due Date tràn dòng


## [1.5.01] - 2024-04-19

### Sửa lỗi
- Sửa lỗi kỹ thuật trong mã nguồn để code sạch hơn


## [1.5.00] - 2024-04-19

### Thêm mới
- Thông báo lỗi cấu hình rõ ràng kèm link Options
- Nhấp vào biểu tượng extension mở thẳng trang Options

### Thay đổi
- Đổi tên extension thành B2R


## [1.4.07] - 2024-04-19

### Thêm mới
- Cơ chế tự động đồng bộ API Key giữa các provider

### Thay đổi
- Hợp nhất khối cấu hình Redmine vào giao diện đồng nhất
- Tối ưu logic hiển thị nút Migrate Issue


## [1.4.06] - 2024-04-18

### Cải tiến
- Chuyển sang OAuth2 Refresh Token để khắc phục quota Service Account


## [1.4.05] - 2024-04-18

### Thêm mới
- Hỗ trợ đính kèm Video (.mp4, .mov, .webm) và các loại tệp tin
- Video hiển thị bằng trình phát nội bộ

### Thay đổi
- Nâng cấp hệ thống quét attachment tự động
- Khôi phục và bổ sung hướng dẫn lấy API key

### Sửa lỗi
- Fix toàn bộ lỗi linting


## [1.4.04] - 2024-04-18

### Sửa lỗi
- Điều chỉnh cấu trúc thư mục trong bản build khớp với Manifest


## [1.4.03] - 2024-04-18

### Thêm mới
- Thêm Qwen 3 235B và GPT OSS 120B vào danh sách Cerebras

### Thay đổi
- Chuyển Primary Model mặc định về Llama 3.1 8B


## [1.4.02] - 2024-04-18

### Thay đổi
- Chuyển model chính mặc định sang Llama 3.1 70B
- Thêm quy tắc AI không thay đổi tag ảnh và code blocks

### Sửa lỗi
- Mở rộng quyền truy cập và gửi kèm session cookies


## [1.4.01] - 2024-04-18

### Thay đổi
- Đặt Llama 3.1 70B làm model chính và Gemma 3 27B IT làm fallback
- Nâng cấp prompt và logic giữ nguyên code blocks

### Tài liệu
- Viết lại Changelog súc tích và cập nhật README


## [1.4.00] - 2024-04-18

### Thêm mới
- Nút tạo nhanh Issue Redmine từ Header của Backlog
- Chọn nhà cung cấp AI chính/phụ độc lập với failover

### Thay đổi
- Giao diện Cyan-Flow hiện đại
- Tái cấu trúc service-based


## [1.3.00] - 2024-04-18

### Thêm mới
- Di chuyển tất cả bình luận cùng lúc
- Tự động lấy danh sách Dự án, Tracker, Priority từ Redmine


## [1.2.00] - 2024-04-17

### Thêm mới
- Thiết lập hệ thống kỹ năng cho AI Agent

### Sửa lỗi
- Sửa lỗi hiển thị Blockquote và định dạng tag tên người dùng
- Khắc phục lỗi UI hover và modal


## [1.1.00] - 2024-04-16

### Thêm mới
- Thêm bộ chọn model và cải thiện tìm kiếm Issue Redmine

### Bảo mật
- Mã hóa API key khi lưu trữ cục bộ


## [1.0.01] - 2024-04-15

### Thêm mới
- Phiên bản đầu tiên: dịch tiếng Nhật sang Việt và đồng bộ Backlog → Redmine
