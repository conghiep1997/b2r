# Redmine local để test Backlog2Redmine

Bộ cấu hình này chỉ chuẩn bị sandbox. Chưa chạy container, chưa tải image và chưa tạo dữ liệu Redmine. Dùng Docker Desktop với Linux containers và Docker Compose v2.

Image chính thức: [Redmine](https://hub.docker.com/_/redmine) 6.1 và [PostgreSQL](https://hub.docker.com/_/postgres) 16. PostgreSQL không mở cổng ra host; Redmine chỉ bind `127.0.0.1:13001`. Database và attachment nằm trong named volumes. Password và session secret được tạo ngẫu nhiên, không commit.

Từ thư mục repo, chuẩn bị cấu hình (không host):

```powershell
node sandbox/redmine/prepare.cjs
docker compose -f sandbox/redmine/compose.yaml config --quiet
```

Khi bạn muốn tự chạy:

```powershell
docker compose -f sandbox/redmine/compose.yaml up -d
docker compose -f sandbox/redmine/compose.yaml ps
docker compose -f sandbox/redmine/compose.yaml logs --tail 80 redmine
```

Mở `http://127.0.0.1:13001`. Lần đầu chờ migration database hoàn tất. Theo image chính thức, tài khoản ban đầu là `admin` / `admin`; đăng nhập và đổi password khi được yêu cầu. Vào Administration → Settings → API, bật REST web service. Tạo project riêng tên `Hipe B2R Sandbox`, identifier `hipe-b2r`, bật Issue tracking và chọn tracker cần thử. Vào My account → API access key để lấy key, nhập trực tiếp vào Options extension.

Trong Options:

- Redmine domain: `http://127.0.0.1:13001` (giữ cùng host khi mở trình duyệt).
- Redmine API key: key của tài khoản local. Bấm Lưu và cho phép truy cập host local.
- Đồng bộ Project, chọn sandbox làm Project mặc định. Không cần Custom Fields nếu local chưa tạo chúng.
- Backlog domain: URL workspace thật của bạn; API key nhập trực tiếp vào Options.
- Project Backlog test: `HIPE_B2R`. Glossary dùng mã `HIPE_B2R`.
- Cài đặt nâng cao: có thể dùng mẫu `[{issueKey}] {summary} / ({translatedSummary})`; dấu phân cách ` / (`. Mapping được ưu tiên trước tìm bằng tiêu đề.

Đổi cổng: copy `.env.example` thành `.env` trong thư mục này và đổi `REDMINE_PORT`; truyền `--env-file sandbox/redmine/.env` trước `-f` trong các lệnh Compose. Không xóa hay thay password database sau khi volume đã khởi tạo.

Dừng sandbox, giữ dữ liệu:

```powershell
docker compose -f sandbox/redmine/compose.yaml down
```

## Thông tin cần cho test thực tế

Bạn đã cung cấp tên project và key `HIPE_B2R`. Còn cần:

- URL workspace Backlog, ví dụ `https://<workspace>.backlog.com`.
- 2–3 mẫu tiêu đề Backlog và tiêu đề Redmine mong muốn; loại issue/tracker tương ứng.
- Issue key cụ thể sau khi tạo issue mẫu; Redmine issue ID sau khi migration.
- Xác nhận giới hạn dữ liệu test và các thao tác được phép: tạo issue, thêm comment, upload file, sửa issue hoặc log time. Không mặc định thực hiện tất cả các thao tác.
- Một AI provider/model đã cấu hình và đã test kết nối nếu muốn thử dịch thật. Không gửi API key/password vào chat hoặc commit.

## Kịch bản test thủ công

| Case | Dữ liệu mẫu | Kết quả mong đợi |
| --- | --- | --- |
| Migration | Issue HIPE_B2R có tiêu đề JP, mô tả và 2 comment | Preview đúng template; tạo một Redmine issue và mapping |
| Chọn nội dung | Bỏ chọn một comment/file | Chỉ chuyển nội dung đã chọn |
| Dịch comment | JP/EN, mention, URL, code, bảng Markdown | Preview giữ cấu trúc; ghi đúng issue |
| Attachment | PNG và TXT nhỏ | File mở được ở destination; lỗi file hiển thị partial |
| Reverse sync | Redmine note có đoạn JP và VN | Chọn đúng Backlog issue, xem trước trước khi gửi |
| Dynamic lookup | Cặp issue tạo thủ công chưa có mapping, dùng separator tùy chọn | Tìm đúng issue trong project đã chọn |
| Chống trùng | Gửi lại cùng revision comment | Không ghi comment lần hai |
| Recovery | Gián đoạn kết nối sau thao tác ghi | Recheck/resume; kiểm tra destination trước khi unlock retry |
| Glossary | Một thuật ngữ dịch và một cụm giữ nguyên | Cụm giữ nguyên không đổi; thuật ngữ dùng theo project |

Mỗi case ghi issue key/ID, trạng thái trước/sau và lỗi đã che key. Không tự tạo dữ liệu trên Backlog thật bằng script trong bộ cấu hình này. Container runtime và các case live chỉ được xác minh sau khi bạn chủ động chạy sandbox và xác nhận thao tác test.
