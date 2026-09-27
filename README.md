# B2R - Backlog to Redmine

Chrome extension dịch comment từ Backlog sang tiếng Việt và đồng bộ dữ liệu thông minh sang Redmine. Tên mới: **B2R**.

**Latest Update (1.8.17):** Onboarding lần đầu, lịch sử sync và preview-only dry run; cải thiện retry/fallback AI, xử lý Gemini key rotation và trạng thái retry; hỗ trợ xem trước Log Time theo tháng trước khi ghi; bổ sung bản địa hóa và lưu kết quả sync lỗi hoặc một phần.

---

## 📦 Cấu trúc dự án

```
B2R/
├── src/                         # Source code
│   ├── background.js            # Service worker (API orchestration)
│   ├── content.js               # Backlog content script
│   ├── redmine_content.js       # Redmine content script (sync ngược)
│   ├── constants.js             # Global constants, messages, prompts
│   ├── options.html/js          # Settings page
│   └── modules/
│       ├── services/
│       │   ├── ai.js            # AI translation (Gemini/Groq/Cerebras)
│       │   ├── redmine.js       # Redmine API wrapper
│       │   └── backlog.js       # Backlog API wrapper
│       ├── ui/
│       │   ├── modal.js         # Modal UI management
│       │   ├── toast.js         # Toast notifications
│       │   └── styles.js        # Injected CSS styles
│       └── utils/
│           ├── helpers.js       # Shared utilities (timeoutFetch, etc.)
│           ├── crypto.js        # AES-GCM-256 encryption (per-user salt)
│           └── markdown.js      # HTML → Markdown conversion
├── assets/icons/                # Extension icons (16, 48, 128px)
├── scripts/
│   ├── build.js                 # Build script
│   └── build-zip.js             # Package for Chrome Web Store
├── dist/                        # Build output (generated)
├── manifest.json                # Extension manifest v3
├── package.json                 # NPM dependencies
├── .eslintrc.json              # ESLint config
├── .prettierrc                 # Prettier config
├── README.md                    # This file
└── DEVELOPMENT.md              # Developer guide
```

---

## 🤖 Hệ thống AI hỗ trợ

Phiên bản hiện tại hỗ trợ nhiều nhà cung cấp AI free-tier và cho phép cấu hình primary/fallback linh hoạt:

| Provider | Model mặc định | Vai trò | Ghi chú |
|----------|----------------|---------|---------|
| **Gemini** | Gemini 3.1 Flash Lite | Primary / Fallback | Hỗ trợ thêm danh sách nhiều API key để chia tải |
| **Groq** | Llama 3.3 70B Versatile | Primary / Fallback | Tốc độ phản hồi nhanh, phù hợp dịch comment ngắn |
| **Cerebras** | GPT OSS 120B | Primary / Fallback | Free tier ổn định, phù hợp làm backup |

### AI Configuration Highlights

- ✅ **Groq Support**: Có thể chọn Groq cho cả AI chính và AI dự phòng
- ✅ **Multiple Gemini Keys**: Nhập tối đa 10 Gemini API keys, mỗi dòng một key
- ✅ **Random Key Rotation**: Tự động random Gemini key khi gọi API để giảm lỗi rate limit
- ✅ **Encrypted Storage**: Toàn bộ API keys vẫn được mã hóa trước khi lưu cục bộ
- ✅ **Curated Translation Models**: Danh sách model của Groq/Cerebras đã được lọc theo hướng ưu tiên chất lượng dịch Nhật -> Việt, loại bỏ các model 8B

### Suggested Translation Models

- **Groq**: `llama-3.3-70b-versatile`, `openai/gpt-oss-120b`, `qwen/qwen3-32b`, `openai/gpt-oss-20b`
- **Cerebras**: `gpt-oss-120b`, `qwen-3-235b-a22b-instruct-2507`, `zai-glm-4.7`

---

## ✨ Tính năng nổi bật

### Core Features

- ✅ **Dịch Backlog → Redmine**: Tự động dịch Nhật/Anh → Việt bằng AI
- ✅ **Sync Redmine → Backlog**: Lọc nội dung tiếng Nhật, gửi ngược lại
- ✅ **Migrate Issue**: Tạo issue mới trên Redmine từ Backlog (1-click)
- ✅ **Batch Translate**: Dịch và gửi hàng loạt comments liên tiếp
- ✅ **Image & Video Handling**: Tự động download/upload ảnh và video (.mp4, .mov...). Video có trình phát ngay trên Redmine.
- ✅ **Markdown Preservation**: Giữ nguyên format (bold, italic, lists, tables, code blocks)
- ✅ **Smarter Attachment Detection**: Quét attachment tốt hơn từ changelog/comment links để gom nội dung đầy đủ hơn

### UI/UX

- 🎨 **Cyan-Flow Design**: Giao diện modern, pill-shaped buttons
- 🔔 **Smart Error Handling**: Tự động hiển thị link tới trang cấu hình khi có lỗi API key.
- ⚡ **Quick Settings Access**: Click vào biểu tượng extension để mở nhanh trang Options.
- 📦 **Confirm Modal**: Preview và edit trước khi gửi
- 👁 **Toggle Preview Mode**: Chuyển nhanh giữa textarea và chế độ xem trước HTML trong modal
- 🏃 **Loading States**: Spinner and disabled states rõ ràng

### Security

- 🔐 **AES-GCM-256**: Mã hóa API keys trước khi lưu
- 🧂 **Per-User Salt**: Mỗi installation có salt duy nhất
- 🛡️ **Timeout Fetch**: Tránh treo kết nối (15s timeout)

---

## 🚀 Hướng dẫn sử dụng

### Cài đặt nhanh

```bash
# 1. Install dependencies
npm install

# 2. Build extension
npm run build

# 3. Load in Chrome
- Mở chrome://extensions/
- Bật "Developer mode"
- Click "Load unpacked"
- Chọn folder dist/
```

### 1. Di chuyển Issue (Migrate)

1. Mở issue chi tiết trên Backlog
2. Click nút **Di chuyển Issue** (góc trên phải)
3. Extension dịch description, subject và **toàn bộ comment/note** (nếu có) trước khi mở modal
4. Điền thông tin Redmine:
   - Project
   - Tracker
   - Priority
   - Subject
5. Checkbox **Dịch và di chuyển tất cả N bình luận** bật mặc định khi có comment — có thể bỏ tick nếu chỉ muốn tạo issue
6. Preview nội dung → Click **Tạo & Di chuyển toàn bộ**
7. Success modal luôn hiện kèm **link issue Redmine** (không bị tắt bởi tùy chọn ẩn modal của dịch comment)

### 0. Cấu hình AI

1. Mở trang Options của extension
2. Chọn `Primary Provider` và `Fallback Provider`
3. Nếu dùng Gemini:
   - Có thể nhập 1 key ở ô thông thường, hoặc
   - Mở phần **Multiple Gemini Keys** để nhập nhiều key, mỗi dòng một key
4. Nếu dùng Groq hoặc Cerebras: nhập API key tương ứng
5. (Tuỳ chọn) **Hiển thị modal thành công khi dịch/gửi comment sang Redmine** — chỉ áp dụng chức năng dịch comment; Di chuyển Issue luôn hiện modal + link
6. Click **Lưu cấu hình**

### 2. Dịch và Gửi Comment

1. Tìm comment cần dịch trên Backlog
2. Click nút **Redmine** (icon translate)
3. Modal hiện ra với:
   - Redmine Issue ID (auto-fill nếu tìm thấy — ưu tiên khớp key / title JP, kể cả subject có thêm bản dịch VN)
   - Preview nội dung dịch (giữ link Backlog dạng tuyệt đối)
   - Option: Dịch batch (từ vị trí click → cuối)
4. Click **Xác nhận & Gửi**

### 3. Sync ngược (Redmine → Backlog)

1. Mở issue trên Redmine
2. Click nút **Backlog** (share icon)
3. AI lọc phần tiếng Nhật
4. Nhập Backlog Issue Key → Gửi

---

## 🛠️ Development

### Commands

```bash
# Auto bump patch version + create changelog stub
npm run bump

# Bump to a specific version
npm run bump -- 1.7.3

# Check manifest/package version sync
npm run check:version-sync

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Build for production
npm run build

# Create ZIP package
npm run build:zip
```

### Release Notes

- `manifest.json` là source of truth cho version release của extension.
- `npm run bump` sẽ tự tăng patch version, đồng bộ `manifest.json` và `package.json`, đồng thời tạo stub entry mới trong `CHANGELOG.md`.
- CI sẽ fail sớm nếu `manifest.json.version` và `package.json.version` bị lệch.

### Debugging

**Content Script (Backlog/Redmine):**
- F12 → Console → Filter: `[TB-Redmine]`

**Service Worker:**
- `chrome://extensions/` → Details → Service Worker → Inspect

**Options Page:**
- Mở Options → F12 → Console

### Testing Checklist

- [ ] Button xuất hiện đúng vị trí
- [ ] Dịch 1 comment thành công
- [ ] Dịch batch (nhiều comments) thành công
- [ ] Hình ảnh được upload đúng
- [ ] Markdown format được giữ nguyên (bold, lists, tables, code)
- [ ] Settings lưu và load đúng
- [ ] Preview toggle hoạt động đúng ở modal
- [ ] Fallback AI hoạt động khi rate limit
- [ ] Multiple Gemini keys được load và lưu đúng
- [ ] Groq hoạt động khi được chọn làm provider
- [ ] **Lỗi cấu hình hiển thị link tới Options**
- [ ] **Click icon mở Options**

---

## 📊 Performance

| Operation | Avg Time | Notes |
|-----------|----------|-------|
| AI Translation | 1-5s | Depends on model |
| Image Download | ~500ms/image | From Backlog |
| Image Upload | ~300ms/image | To Redmine |
| Issue Lookup | ~1s | HTML search + API fallback |

---

## 🔐 Security

- API keys encrypted với **AES-GCM-256**
- Per-User salt từ `chrome.storage` UUID
- Timeout fetch: 10-15s cho mọi API calls
- Không gửi keys ra ngoài extension

---

## 📜 Nhật ký thay đổi

Chi tiết các thay đổi qua từng phiên bản có thể được xem tại: **[CHANGELOG.md](./CHANGELOG.md)**

---

## 📚 Resources

- [DEVELOPMENT.md](./DEVELOPMENT.md) - Chi tiết kiến trúc và debugging
- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [Gemini API](https://ai.google.dev/gemini-api/docs)
- [Cerebras API](https://docs.cerebras.ai/)
- [Redmine REST API](https://www.redmine.org/projects/redmine/wiki/Rest_api)

---

**Developed by Hipppo** 🦛
