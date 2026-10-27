# Changelog - Backlog2Redmine

## [1.8.21] - 2026-10-27
- **✨ Added**: Month picker (`YYYY-MM`) in the Redmine Monthly Log Time modal to preview, log, and delete spent time for any past or current month, plus `#b2r-monthly-log` deep-linking from the extension popup.
- **✨ Added**: Dark-theme synchronization (`data-tb-theme="dark"`) for all injected Backlog/Redmine modals, tables, cards, and banners following `themePreference`.
- **✨ Added**: Keyboard shortcuts (`Escape` to close, `Ctrl+Enter` / `Cmd+Enter` to confirm), debounced Redmine Issue ID lookup, styled migration file-selection cards, and interactive toasts (hover-to-pause, click-to-dismiss, ARIA live regions).
- **✨ Added**: In-place language switching on the Options page without reloading the page or losing unsaved inputs, and Unicode/multi-word Backlog `@mention` autocomplete.
- **🔧 Fixed**: Hardened `normalizeTranslationOutput` to preserve markdown numbered lists and inline `Result:` text, strip B2R sync markers upfront, and pass explicit fallback retry flags.
- **🔧 Fixed**: Chunked `encryptData` base64 encoding to prevent call-stack overflow on large settings payloads and deduplicated concurrent `getUserStorageId` initialization.
- **🔧 Fixed**: Tagged single-report time entries with `[B2R report:<id>]` so monthly deletion accurately cleans them up, and localized all report status badges and summary labels.
- **🔧 Fixed**: Eliminated prefix collisions in Redmine issue-key search (`PROJ-1` vs `PROJ-10`) and migration markers (`_1` vs `_10`), escaped `$` replacement patterns in Redmine attachment markup, and ignored empty/deleted comments during sync dedup.
- **🔧 Fixed**: Validated actual stored AI provider API keys in popup readiness checks, hidden unconfigured donation methods, isolated `baseSettings` in full-comment translation, and kept background settings cache valid across transient storage writes.
- **📝 Docs**: Added unit test suites covering translation output normalization, large-payload encryption, sync marker stripping, Redmine attachment markup, comment sync deduplication, and migration marker matching.


## [1.8.20] - 2026-10-26
- **✨ Added**: Project-scoped glossaries, saved issue mappings, migration preview with comment/file selection, and resumable migration checkpoints.
- **✨ Added**: Configurable translation and reverse-sync modes, project-pair profiles, migration title/search rules, tracker aliases, and custom-field policies.
- **✨ Added**: Monthly log-time rules and project selection, plus a local Redmine sandbox for validation.
- **🔧 Fixed**: Prevent duplicate syncs and migration issues after interrupted requests; preserve completed work and reconcile ambiguous results before retrying.
- **🔧 Fixed**: Validate Redmine destinations, attachments, time-entry plans, and settings before writes; isolate workspace/project data and protect encrypted credentials.
- **📝 Docs**: Expanded setup, Options, migration, recovery, and sandbox guidance; refreshed screenshots and skill documentation.
- **📝 Docs**: Added implementation review and validation notes in `IMPLEMENTATION.md`.


## [1.8.19] - 2026-10-22
- **✨ Added**: One Redmine project selector for issue migration and monthly reports.
- **🔧 Fixed**: Popup setup status now reflects the required API key and AI provider for each sync direction; overall setup accepts either Redmine or Backlog key when an AI provider is selected.
- **🔧 Fixed**: Apply project-specific issue lookup mode, title delimiter, tracker aliases, and Redmine project restriction; avoid selecting unrelated search results.
- **🔧 Fixed**: Use the selected log-time rules consistently in previews, confirmations, and pre-write checks.
- **📝 Docs**: Simplified Options guidance and removed redundant API key and workspace-domain explanations.


## [1.8.18] - 2026-10-02

### Added
- Configure independent source/target languages for Backlog → Redmine and extraction, translation, or original-content modes for Redmine → Backlog.
- Configure daily log-time hours, equal or estimate-based allocation in quarter-hour increments, and API-backed default/testing activities.
- Select workspace-scoped profile Report projects in the monthly log-time dialog.

### Fixed
- Resolve Redmine destinations using complete, paginated API results instead of first-page HTML hits; match complete Backlog keys and reject ambiguous matches.
- Preserve explicitly empty model selections.
- Distinguish migration attachments by source ID.
- Accept corrected payloads after confirmed failures while preserving completed work and manually corrected issue mappings.
- Restore credentials together with domains when content-script registration fails.
- Remove legacy checkpoints only after successfully storing their replacements.
- Discard monthly report previews when the selected project changes and block log-time writes if the hours/activity plan changes before confirmation.
- Remove fixed time-entry activity-ID fallbacks.

### Improved
- Keep the chosen translation language across provider fallback and glossary prompts; use the target language for translated comment collapse labels while preserving existing default directions.
- Support issue titles without Backlog keys through saved mappings.
- Compact completed checkpoints and scope operation locks and record decryption to the current workspace.
- Require loading a glossary before saving, protect unsaved edits and explicit clearing, and disable editing during requests.

### Verification
- 134 unit tests and 24 browser tests passed, including a real unpacked MV3 extension smoke test.
- Lint, formatting, version synchronization, and build passed.
- Live Backlog/Redmine writes were not exercised.

## [1.8.17] - 2026-09-24

- **Added**: First-run onboarding, sync activity history, preview-only dry run, and clearer AI retry/provider status. Expanded automated coverage for Popup, Options, Backlog, and Redmine flows.
- **Monthly Log Time**: Add a popup shortcut to the Redmine monthly log. Show the tasks, planned hours, and existing entries before logging; require a fresh preview and block unsafe replacement when data has changed.
- **Improved Gemini rotation**: Reserve a model/key slot before each request so concurrent translations start on different slots. Cool down a Gemini key across selected models after a rate-limit response, while keeping model-specific failures scoped to their model/key pair; honor `Retry-After` when provided.
- **Gemini configuration**: Test every configured Gemini key for a selected model and show which key positions fail. Continue to load older settings containing a single Gemini key.
- **Models**: Add Gemini 3.5 Flash Lite, remove Gemini 2.0 models from the selection list, and use the default model when saved selections contain only retired models.
- **Popup**: Restore the localized Monthly Log Time button label and place it above the Redmine and Backlog quick links for clearer navigation.
- **Fixed**: Record failed and partially completed syncs; avoid reposting completed comments on a same-target retry in the same modal; keep successful sends successful when activity storage fails. Require a trusted HTTPS Backlog workspace before sending an API key. Scope AI status to the requesting tab/frame, and tie project caching and connection verification to the current settings.
- **Localization and UI**: Localize remaining Redmine progress and Options text, including dynamic labels, placeholders, alt text, and accessibility labels. Clarify form guidance and monthly log feedback; keep English and Vietnamese message catalogs aligned.
- **Docs**: Refreshed seven English demo screenshots under `output/playwright/` using illustrative data, without real credentials.
- **Verification**: Build, lint, formatting, 56 unit tests, and 9 mocked-browser E2E tests passed. Live Backlog/Redmine accounts were not exercised.


## [1.8.16] - 2026-09-21

### Added
- Include the latest error logs in downloaded, copied, and GitHub bug reports.

### Fixed
- Changed the extension default locale to English.
- Improved the Options page Language and Theme controls with clearer borders and placement.
- Improved dark-mode contrast across settings sections and form controls.
- Localized the Redmine personal account link.
- Fixed screenshot preview handling and added an error state when an image cannot be previewed.
- Giữ nguyên placeholder kiểu `<flow_guide_id>` khi dịch/sync note sang Redmine.
- AI HTML-escape `<>` được decode trước khi gửi Redmine; code fence/inline giữ nguyên entity.
- Textile không còn double-escape placeholder ngoài allowlist.
- Extract Backlog giữ custom tag kiểu `<flow_guide_id>` thay vì nuốt mất.

### Improved
- Prompt giữ nguyên placeholder `<id>` / `<flow_guide_id>`.
- Bổ sung helper `decodeHtmlEntitiesOutsideCode`, `buildRedmineUploadUrl`, và `normalizeBacklogOrigin`.
- Thêm unit test cho decode angle brackets, Textile placeholder, và extract custom tag.

### Docs
- Documented the Options page, screenshot preview, localization, and error-log report improvements.
- Cập nhật `CHANGELOG.md` cho bản 1.8.16.

## [1.8.15] - 2026-09-20

### Added
- Bổ sung i18n cho popup, Options và luồng Log Time Redmine với tiếng Việt/English.
- Thêm lựa chọn ngôn ngữ thủ công và theme Sáng/Tối/Theo hệ thống, lưu cục bộ.
- Thêm luồng Báo lỗi end-user: mô tả, bước tái hiện, URL, môi trường, log gần nhất và ảnh chụp tùy chọn.
- Cho phép tải report JSON + ảnh, sao chép report hoặc mở GitHub Issue đã điền sẵn.
- Tạo skill dùng chung `extension-ui` cho các extension tiếp theo: design tokens, theme, accessibility, i18n và bug-report privacy.
- Hoàn thiện catalog locale đồng bộ toàn bộ message keys giữa tiếng Việt và tiếng Anh cho popup, Options và modal/report UI.

### Improved
- Popup được chuyển thành dashboard trạng thái với message keys và fallback locale.
- Redmine Log Time dùng locale cho trạng thái, modal, bảng kết quả và lỗi.
- Options bổ sung card hỗ trợ, xem trước ảnh và cảnh báo dữ liệu trước khi gửi bug report.

### Security / Privacy
- Bug report không tự động upload dữ liệu; người dùng chủ động tải xuống hoặc mở GitHub.
- Ảnh đính kèm giới hạn 5 MB và chỉ nhận PNG/JPEG/WebP.
- API key không được đưa vào popup hoặc metadata report.

### Verification
- `npm run lint` đạt.
- `npm run check:version-sync` đạt.
- Locale JSON và manifest hợp lệ.
- `npm test` bị môi trường Windows chặn với `spawn EPERM` trước khi chạy assertion.


## [1.8.14] - 2026-09-19

### Added
- Thêm popup cho extension khi click icon, hiển thị trạng thái cấu hình và project Redmine hiện tại.
- Thêm khu vực Donate coffee với tab ngân hàng, MoMo và PayPal.
- Thêm icon mới cho extension và các icon trực quan cho thao tác trong popup.

### Fixed
- Đồng bộ kích thước button, layout popup và modal donate để tránh text bị cắt/tràn.
- Hiển thị rõ luồng đang hoạt động `Backlog → Redmine`; đánh dấu `Redmine → Backlog` chưa sẵn sàng.
- Popup lấy tên project Redmine qua background service thay vì hiển thị ID cho end-user.
- Bổ sung validation cho message `GET_DEFAULT_PROJECT_SUMMARY` và validate URL trước khi mở tab.
- Giảm thông tin trùng lặp giữa status card và project card.

### Improved
- Popup sử dụng thiết kế phẳng, màu hài hòa, icon rõ ràng và hierarchy dễ quét hơn.
- Giữ API key không hiển thị trong popup; request lấy project chỉ được phép từ extension pages.

### Docs
- Cập nhật changelog cho popup, project summary, donate và icon mới.
- **✨ Added**:
- **🔧 Fixed**:
- **📝 Docs**:


## [1.8.13] - 2026-09-18

> Fix sync attachment Backlog → Redmine (đặc biệt file video `.mp4` / tên tiếng Nhật).

### Fixed
- Upload Redmine gửi đủ `?filename=` trên `/uploads.json` (tránh 422 khi server bật lọc extension; hỗ trợ tên file tiếng Nhật như `3653_API呼び出しあり.mp4`).
- Chuẩn hóa Backlog origin khi fallback download web (không còn ghép `https://https://...` khi domain lấy từ settings).
- Từ chối blob download không hợp lệ (HTML login / JSON lỗi / rỗng) trước khi upload.
- Scrape thêm link `downloadAttachment/` và `ViewAttachmentVideo` cho comment và description.
- Thông báo `[Attachment Error: …]` kèm lý do ngắn (status/upload failed) để dễ debug (ví dụ vượt max file size trên Redmine).

### Improved
- Helper `normalizeBacklogOrigin` / `buildRedmineUploadUrl`; unit test cho URL upload + normalize domain.

### Docs
- Cập nhật `CHANGELOG.md` cho bản 1.8.13.


## [1.8.12] - 2026-09-15

> Lookup theo title JP (bỏ qua bản dịch VN), migrate kèm comment mặc định, giữ link Backlog khi sync sang Redmine.

### Added
- Lookup Redmine tách phần title tiếng Nhật trước ` / (…)` để khớp dù bản dịch VN khác.
- HTML/API search thử **riêng** issue key và title JP (không AND cả hai); API dùng `subject=~` + `status_id=*`.
- **Di chuyển Issue** dịch sẵn và bật mặc định di chuyển toàn bộ comment/note bên dưới (nếu có).
- Migrate luôn hiện success modal kèm link Redmine (`forceShow`), không phụ thuộc tùy chọn ẩn modal.
- Absolutize link Backlog tương đối (`/view/KEY`) và convert sang Textile `"label":url` khi gửi Redmine.
- Unit test cho match JP/VN bilingual subject, relative Backlog links, và drop `javascript:` links.

### Fixed
- Không còn miss issue Redmine khi subject dạng `【調査】… / ([Điều tra] …)` không chứa Backlog key.
- Link issue trong comment không còn mất / hiện raw Markdown `[KEY](/view/KEY)` trên Redmine.
- Dịch 1 comment lỗi không chặn cả flow migrate (fallback text gốc).
- Chỉ coi `/user/` trên host Backlog là profile link; chỉ emit Textile link `http/https`.

### Improved
- Options: copy “Hiển thị modal thành công…” làm rõ **chỉ áp dụng dịch/gửi comment**; Di chuyển Issue luôn hiện modal + link.
- Checkbox “Không hiển thị lại” trên success modal ghi chú chỉ ảnh hưởng dịch comment.

### Docs
- Cập nhật `CHANGELOG.md`, `README.md` (migrate + options), skill `cross-platform-sync` / `extension-ui`.


## [1.8.11] - 2026-08-27

> Ưu tiên tracker khi lookup Redmine, giữ đúng format Markdown, hotfix migrate/batch/security P0.

### Added
- Ưu tiên tìm issue Redmine theo tracker dựa trên Backlog issue type (`QA` → `Q/A`/`Q&A`).
- Convert thêm underline, màu chữ/nền (`&color`/`<mark>`), và task list checkbox từ Backlog sang Markdown.
- Thêm unit test cho `extractBacklogContent` (code fence, inline code đặc biệt, underline/color/task list).
- Proxy `REDMINE_AUTHORIZED_FETCH` để content script Redmine gọi API qua service worker (không nhận plaintext API key).
- Thống nhất copy UI tiếng Việt (bỏ lẫn EN cứng trong modal/content; giữ tên riêng Redmine/Backlog/Issue).

### Fixed
- Không còn phá code fence ` ``` ` khi cleanup Markdown (trước đây ``+/g làm mất format code block trên Redmine).
- Giữ nguyên ký tự đặc biệt trong code (`--`, `/*`, `;`, `0x...`) khi convert và khi AI dịch.
- Map tracker migrate `QA` sang `Q/A` (kèm fallback `Q&A`) thay vì chỉ khớp `Q&A`.
- Migrate comments dùng `memoizedBatchNotes` (trước đây `currentNotesList.slice(1)` luôn rỗng).
- Batch notes không còn nhân đôi note đầu do lệch contract `mergeTranslatedBatchNotes`.
- `fixed_version_id` được gửi khi create issue Redmine.
- Lookup API không còn fallback `issues[0]` khi tracker không khớp preference.
- Báo lỗi rõ khi một phần comment migrate thất bại.
- Origin allowlist cho privileged handlers (Backlog / Redmine / Options).

### Improved
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
### Fixed
- Restore update checks when the backend version routes return 404 by falling back to GitHub Releases.
- Keep GitHub release publishing successful when optional backend version registration is unavailable.
- Let Options save API keys that are still typed in the input without requiring Enter first.
- Render markdown preview paragraphs, lists, task lists, tables, strikethrough, and fenced code blocks reliably.

### Improved
- Restore the full default Custom Fields mapping for migrate and merge missing defaults into saved JSON.
- Polish markdown preview spacing and styles for lists, tables, blockquotes, and code blocks.
- Extend format checks to scripts, tests, manifest, and package metadata.

## [1.8.09] - 2026-07-05

> Tăng cường bảo mật, độ ổn định và khả năng kết nối với Redmine domain tùy chỉnh.
### Fixed
  - Inject lại custom Redmine content scripts vào tab đang mở sau extension update.
  - Cô lập lỗi query/inject từng tab để không làm gián đoạn service-worker lifecycle.


### Fixed
  - Inject custom Redmine content scripts vào tab đang mở ngay sau khi cấp permission.
  - Dùng isolated-world marker để tránh inject trùng và lỗi redeclare globals.


### Fixed
  - Tách dedupe scope theo sender origin để không gộp request giữa các Backlog workspace.
  - Rollback domain/registration khi cập nhật custom Redmine thất bại.
  - Tự đồng bộ dynamic content script khi extension được install hoặc update.


### Added
  - Hỗ trợ Redmine domain tùy chỉnh bằng optional host permission và dynamic content script.
### Fixed
  - Chuẩn hóa Redmine domain về origin và gỡ permission/script cũ khi đổi domain.


### Improved
  - Gộp các request gửi comment giống hệt đang chạy đồng thời để tránh double-submit.
  - Cho phép gửi lại bình thường ngay sau khi request trước hoàn tất.


### Improved
  - Xóa privileged handlers `LIST_MODELS` và `TEST_MODEL` không còn caller.
  - Bắt buộc domain/API key/provider/model cho các Options API messages trước khi xử lý.


### Improved
  - Chuyển Redmine project sync và AI model test từ Options page sang privileged background handlers.
  - Giới hạn các handler nhận API key chưa lưu chỉ cho sender là trang Options của extension.


### Fixed
  - Tự động sanitize error logs cũ khi extension khởi động hoặc được cập nhật.
  - Chặn message không hợp lệ, sender ngoài extension và payload vượt giới hạn trước privileged handlers.


### Fixed
  - Ngăn API key/token xuất hiện trong timeout errors và persistent error logs.
  - Bổ sung host permissions cho Groq và OpenRouter.
  - Loại bỏ HTML injection từ model labels và settings error messages.
### Docs
  - Xóa các tham chiếu lỗi thời tới Google Sheet Testcase Converter khỏi repo guidance.
  - Đồng bộ trách nhiệm formatting giữa Prettier và ESLint để build output không còn warning nhiễu.


### Fixed
  - Cấp đúng host permission cho API kiểm tra phiên bản.
  - Chỉ xử lý click từ notification cập nhật của B2R và bỏ qua version response không hợp lệ.
  - Tránh dùng cache Redmine issue cũ khi domain, issue summary hoặc settings thay đổi.
### Improved
  - Dùng chung logic kiểm tra phiên bản giữa service worker và trang options.
  - Bổ sung unit test cho so sánh phiên bản và loại bỏ web-accessible resource không tồn tại.
  - Giới hạn settings trả cho content script theo đúng nhu cầu và xác thực origin trước khi cấp Redmine credential.

## [1.8.07] - 2026-05-20
### Added
  - Tích hợp chức năng "Google Sheet Testcase Converter" giúp chuyển đổi dữ liệu testcase sang định dạng mới.
  - Hỗ trợ giao diện Standalone Page và Sidebar nổi (Floating Sidebar Button) trực tiếp trên Google Sheets.
  - Cho phép tùy chỉnh Column Mapping (A, B, C, D...) để chuyển đổi cột linh hoạt.
  - Bổ sung hướng dẫn tự động tạo OAuth2 Client ID và chèn snippet manifest động trên giao diện.
### Fixed
  - Khắc phục cảnh báo ESLint, whitelisted các biến toàn cục Sheets API và Testcase Converter.


## [1.8.06] - 2026-05-11
### Added
- Thêm regex để phân tách notes trong modal, cải thiện parsing cho batch notes
- Thêm hỗ trợ multi-select cho fallback models và keys trong trang Options
- Thêm các function quản lý provider models và keys với mã hóa/giải mã
### Changed
- Cập nhật options.html: xóa dropdown model cũ, thêm cấu hình fallback Gemini mới
- Cải thiện UX với cập nhật UI động dựa trên provider và models được chọn
### Refactored
- Refactor logic xử lý notes trong openConfirmModal để sử dụng function parsing mới
- Cải thiện options.js để hỗ trợ multi-select và render models/keys được chọn

## [1.8.05] - 2026-05-08
### Removed
- Xóa bỏ hoàn toàn chức năng "Đồng bộ tất cả comments sang Backlog" do lỗi hiển thị và không cần thiết ở thời điểm hiện tại

## [1.8.04] - 2024-05-24
### Added
- Thêm hỗ trợ cho các mô hình "Generative Enhanced Models" (GEM) tùy chỉnh
- Tạo mục cấu hình riêng cho "Custom GEM", cho phép chỉ định API endpoint và API key
### Fixed
- Sửa lỗi nghiêm trọng trong chức năng "Migrate Issue" khi xử lý file đính kèm
- Cải thiện ghi log lỗi cho chức năng migrate với đầy đủ payload
- Khắc phục lỗi lưu API key, ngăn lưu giá trị ******
### Refactored
- Dọn dẹp và tái cấu trúc file background.js để loại bỏ code trùng lặp
### Chore
- Sửa tất cả lỗi và cảnh báo từ ESLint

## [1.8.03] - 2024-04-26
### Added
- Flow Redmine → Backlog: đồng bộ ngược từ Redmine sang Backlog
- Attachment handling: tự động extract và upload file đính kèm
- Batch sync: nút "Đồng bộ tất cả comments" với progress tracking
- Smart @mentions với dropdown gợi ý users khi gõ @
- Project-specific user loading từ API /api/v2/projects/{key}/users
- Lazy user loading chỉ khi nhập issue key hợp lệ
### Fixed
- Sửa lỗi userId: null khiến không tag được users
- Sửa lỗi modal không hiển thị user suggestions khi gõ @
- Sửa lỗi auto-load users với project key sai
- Thêm null checks cho user data
### Changed
- Không auto-load users khi mở modal
- Hiển thị hint rõ ràng khi chưa có issue key
- Cải thiện UX: chỉ hiển thị dropdown khi có data users hợp lệ
### Docs
- Cập nhật README.md với hướng dẫn flow Redmine → Backlog

## [1.8.02] - 2024-04-23
### Improved
- Tối ưu translateBatch với Promise.all batch 5
- Thêm cleanup handlers để tránh memory leak
- Giới hạn MutationObserver scope vào container cụ thể
- Thêm projects caching 5 phút và debounce 500ms
- Thêm debounce và throttle utility functions
### Fixed
- Sửa reportProjectId dropdown không populate data
- Sửa lỗi status message bị mất sau khi lưu cấu hình
### Changed
- Chuẩn hóa code style: đổi single quotes sang double quotes

## [1.8.01] - 2024-04-23
### Added
- Triển khai danh sách "Tứ trụ" AI mạnh mẽ (Gemma 3/4, Gemini 3.1)
- Cơ chế Load Balancing: xáo trộn random Model & Key
- Tự động nhận diện Gemma để sửa lỗi Error 400
### Fixed
- Khôi phục logic tìm kiếm Redmine ổn định
- Sửa lỗi hiển thị "Model ma" và cải thiện UI chọn model
- Vá lỗi cú pháp HTML trong trang Options

## [1.8.00] - 2024-04-23
### Added
- Cải thiện giao diện Options với collapsible sections
- Multiple Gemini Models dạng button clickable
- Multiple Gemini Keys gộp chung với Models
- Default chọn 5 models đầu tiên khi chưa có cấu hình
### Changed
- Xóa dropdown Model cũ
- Fallback provider mặc định là "none"
- Loại bỏ Gemma 12B khỏi danh sách model
### Improved
- Tối ưu margin/padding
- Đưa Custom Fields vào section Redmine
- Cải thiện hiệu năng AI với caching layer
- Tối ưu batch translation
- Cải thiện Redmine formatting trong preview
- Refactor AI service cho Gemma models
- Ổn định cấu hình "Tứ trụ" AI models
### Fixed
- Sửa logic load models mặc định khi không có cấu hình
- Clean up code thừa

## [1.7.02] - 2024-04-22
### Added
- Thêm lệnh npm run bump để tự tăng patch version
- Tự động tạo stub entry trong CHANGELOG.md khi bump
- Script check:version-sync kiểm tra đồng bộ version
- Multiple Gemini Models trong Options
- Cập nhật danh sách Gemini models lên series 2.5
- Cải thiện AI fallback cho lỗi 503
### Changed
- Đổi màu giao diện từ đỏ sang xanh cho đồng nhất Cyan-Flow
- Primary Provider cố định là Gemini
### Fixed
- Khắc phục rủi ro CI/CD dùng version cũ
- Thêm fail-fast trong workflow
### Docs
- Loại bỏ version hardcoded khỏi README.md
- Cập nhật .skills/agent_workflow.md và DEVELOPMENT.md

## [1.7.01] - 2024-04-22
### Added
- Thêm qwen/qwen3-32b vào danh sách model của Groq
### Changed
- Curate lại danh sách model Groq và Cerebras
- Loại bỏ model 8B khỏi dropdown
### Fixed
- Sửa model ID của Cerebras Qwen thành qwen-3-235b-a22b-instruct-2507

## [1.7.00] - 2024-04-22
### Added
- Thêm Groq làm lựa chọn cho cả AI chính và dự phòng
- Multiple Gemini Keys trong trang Options
- Toggle preview trong modal
- Khối nhập Groq API Key cho cả primary và fallback
- Nút + Thêm Key để nhập nhanh Gemini keys
### Changed
- Điều chỉnh bố cục form migrate
- Hoàn thiện dropdown model Groq
- Cập nhật danh sách Cerebras theo docs mới
### Fixed
- Mở rộng validate cấu hình và luồng đọc settings
- Cải thiện logic quét attachment
- Nới giới hạn chuẩn hóa xuống 2 dòng trống liên tiếp

## [1.6.01] - 2024-04-21
### Added
- Thêm tên người tạo và thời gian tạo comment vào bản ghi
- Tích hợp trường Target Version trong Modal Migrate
- Cơ chế "Look-Ahead" gộp file media
- Tự động tìm và gộp file đính kèm
### Changed
- Chuyển Gemini làm AI chính và Cerebras làm fallback
- Cập nhật model mặc định: Gemini 3.1 Flash Lite, Cerebras GPT OSS 120B
- Giá trị mặc định Due Date là 3 ngày làm việc tiếp theo
- AI tự động nhận diện định dạng べ cavity original Japanese
### Fixed
- Sửa lỗi không hiển thị "Saved" khi nhập Cerebras API Key
- Sửa lỗi mất dòng trống trong comment
- Sửa lỗi Ordered List và Blockquotes
- Đảm bảo đường dẫn dạng link click được
- Fix linting và parsing error
- Tối ưu khai báo global variables

## [1.6.00] - 2024-04-20
### Added
- Hiệu ứng làm mờ và Spinner khi đang migrate
- Nút Đồng bộ Project cập nhật danh sách dự án
### Changed
- Tự động đóng Modal sau khi nhấn "Xem trên Redmine"
- Việt hóa và làm đẹp khu vực Logs
- Cache attachment (Deduplication)
### Fixed
- Xử lý triệt để lỗi AI làm sai định dạng ảnh
- Nhận diện Marker linh hoạt hơn
- Khắc phục lỗi hiển thị Due Date tràn dòng

## [1.5.01] - 2024-04-19
### Fixed
- Sửa lỗi kỹ thuật trong mã nguồn để code sạch hơn

## [1.5.00] - 2024-04-19
### Added
- Thông báo lỗi cấu hình rõ ràng kèm link Options
- Nhấp vào biểu tượng extension mở thẳng trang Options
### Changed
- Đổi tên extension thành B2R

## [1.4.07] - 2024-04-19
### Added
- Cơ chế tự động đồng bộ API Key giữa các provider
### Changed
- Hợp nhất khối cấu hình Redmine vào giao diện đồng nhất
- Tối ưu logic hiển thị nút Migrate Issue

## [1.4.06] - 2024-04-18
### Improved
- Chuyển sang OAuth2 Refresh Token để khắc phục quota Service Account

## [1.4.05] - 2024-04-18
### Added
- Hỗ trợ đính kèm Video (.mp4, .mov, .webm) và các loại tệp tin
- Video hiển thị bằng trình phát nội bộ
### Changed
- Nâng cấp hệ thống quét attachment tự động
- Khôi phục và bổ sung hướng dẫn lấy API key
### Fixed
- Fix toàn bộ lỗi linting

## [1.4.04] - 2024-04-18
### Fixed
- Điều chỉnh cấu trúc thư mục trong bản build khớp với Manifest

## [1.4.03] - 2024-04-18
### Added
- Thêm Qwen 3 235B và GPT OSS 120B vào danh sách Cerebras
### Changed
- Chuyển Primary Model mặc định về Llama 3.1 8B

## [1.4.02] - 2024-04-18
### Changed
- Chuyển model chính mặc định sang Llama 3.1 70B
- Thêm quy tắc AI không thay đổi tag ảnh và code blocks
### Fixed
- Mở rộng quyền truy cập và gửi kèm session cookies

## [1.4.01] - 2024-04-18
### Changed
- Đặt Llama 3.1 70B làm model chính và Gemma 3 27B IT làm fallback
- Nâng cấp prompt và logic giữ nguyên code blocks
### Docs
- Viết lại Changelog súc tích và cập nhật README

## [1.4.00] - 2024-04-18
### Added
- Nút tạo nhanh Issue Redmine từ Header của Backlog
- Chọn nhà cung cấp AI chính/phụ độc lập với failover
### Changed
- Giao diện Cyan-Flow hiện đại
- Tái cấu trúc service-based

## [1.3.00] - 2024-04-18
### Added
- Di chuyển tất cả bình luận cùng lúc
- Tự động lấy danh sách Dự án, Tracker, Priority từ Redmine

## [1.2.00] - 2024-04-17
### Added
- Thiết lập hệ thống kỹ năng cho AI Agent
### Fixed
- Sửa lỗi hiển thị Blockquote và định dạng tag tên người dùng
- Khắc phục lỗi UI hover và modal

## [1.1.00] - 2024-04-16
### Added
- Thêm bộ chọn model và cải thiện tìm kiếm Issue Redmine
### Security
- Mã hóa API key khi lưu trữ cục bộ

## [1.0.01] - 2024-04-15
### Added
- Phiên bản đầu tiên: dịch tiếng Nhật sang Việt và đồng bộ Backlog → Redmine
