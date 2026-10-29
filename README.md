# Lumière Cosmetic — Website quản lý mỹ phẩm mini

Đồ án cuối kỳ học phần **Điện toán đám mây**. Ứng dụng quản lý cửa hàng mỹ phẩm được đóng gói bằng Docker Compose, gồm giao diện web, REST API, PostgreSQL và MinIO Object Storage.

> **Lưu ý trước khi demo:** source code được tạo để mở bằng VS Code và chạy qua Docker Compose. Cần tạo `.env` từ `.env.example`, đổi mật khẩu demo nếu dùng ngoài máy cá nhân. Trong môi trường tạo source hiện tại chưa có Docker Engine để khởi chạy toàn bộ container, vì vậy hãy thực hiện checklist kiểm thử ở cuối README trên máy có Docker Desktop.

## 1. Chức năng

- Dashboard: số sản phẩm, khách hàng, đơn hàng và doanh thu trong ngày; cảnh báo tồn kho; doanh thu 7 ngày gần nhất.
- Quản lý sản phẩm, danh mục, nhãn hàng, nhà cung cấp và khách hàng: danh sách, tìm kiếm, thêm, sửa, chi tiết, xóa theo quyền.
- Quản lý lô hàng: nhập lô, ngày sản xuất, hạn sử dụng, số lượng tồn, giá nhập; lịch sử biến động kho; điều chỉnh tồn có lý do.
- Bán hàng: tạo đơn, chọn khách hàng, chọn nhiều sản phẩm, kiểm tra tồn và trừ kho theo lô trong một transaction SQL; in hóa đơn.
- Kho tệp: upload ảnh JPG/PNG/WEBP hoặc tài liệu PDF/DOCX lên MinIO; lưu metadata trong PostgreSQL; xem và tải xuống tệp.
- Tài khoản và phân quyền: Administrator và Staff; mật khẩu băm bcrypt; tài khoản có thể khóa/mở khóa.
- Báo cáo: doanh thu theo khoảng ngày, sản phẩm bán chạy, tồn kho thấp, lô sắp hết hạn; xuất CSV.
- REST API, Swagger UI/OpenAPI và Postman Collection.
- Docker Compose với named volumes cho PostgreSQL và MinIO để giữ dữ liệu sau khi container được tạo lại.

## 2. Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Giao diện | EJS server-rendered, HTML5, CSS riêng, JavaScript, Bootstrap Icons |
| Backend | Node.js 22, Express 4, REST API |
| Database | PostgreSQL 16, SQL schema, foreign keys, constraints, indexes |
| Object Storage | MinIO, bucket `cosmetic-files` |
| Xác thực | express-session, bcryptjs, role-based authorization |
| API docs | OpenAPI 3.0, Swagger UI, Postman Collection |
| Đóng gói | Dockerfile, Docker Compose, named volumes, private bridge network |

Chọn phương án **giao diện tích hợp backend** theo PDF: một container ứng dụng phục vụ EJS và REST API, một container PostgreSQL, một container MinIO. Cách này giữ đủ kiến trúc bắt buộc mà không cần thêm container frontend riêng.

## 3. Yêu cầu môi trường

- Windows 10/11 hoặc macOS/Linux.
- Docker Desktop đã cài đặt và đang chạy; Docker Compose v2.
- VS Code (khuyến nghị extension Docker và ESLint).
- RAM khuyến nghị từ 8 GB để chạy đồng thời Docker Desktop và trình duyệt.

Không cần cài PostgreSQL hoặc MinIO trực tiếp trên Windows; chúng chạy trong container.

## 4. Mở dự án và chạy lần đầu

1. Giải nén ZIP vào một thư mục dễ tìm, ví dụ `C:\DoAn\cosmetic-mini`.
2. Mở VS Code → **File → Open Folder...** → chọn thư mục `cosmetic-mini`.
3. Mở Terminal trong VS Code (**Terminal → New Terminal**).
4. Tạo file cấu hình riêng từ mẫu:

   **PowerShell**
   ```powershell
   Copy-Item .env.example .env
   ```

   **Command Prompt**
   ```bat
   copy .env.example .env
   ```

5. Mở `.env` và thay `SESSION_SECRET`, `DB_PASSWORD`, `MINIO_ROOT_PASSWORD`, `ADMIN_PASSWORD`, `STAFF_PASSWORD` bằng giá trị riêng. Không gửi `.env` lên GitHub.
6. Xác nhận Docker đang chạy:
   ```powershell
   docker --version
   docker compose version
   docker info
   ```
7. Build và khởi chạy:
   ```powershell
   docker compose up -d --build
   ```
8. Kiểm tra container:
   ```powershell
   docker compose ps
   docker compose logs -f application
   ```
9. Mở các địa chỉ:
   - Website: http://localhost:3000
   - Health check: http://localhost:3000/health
   - Swagger UI: http://localhost:3000/api-docs
   - MinIO Console: http://localhost:9001

Lần đầu có thể cần một chút thời gian để tải image. Backend tự đợi PostgreSQL, tạo tài khoản demo nếu chưa tồn tại và tạo bucket MinIO nếu chưa có.

## 5. Tài khoản demo

Các tài khoản được tạo từ biến môi trường khi ứng dụng khởi động lần đầu:

- Administrator: `admin@cosmetic.local` / `Admin@12345`
- Staff: `staff@cosmetic.local` / `Staff@12345`

Đây là thông tin **demo cho máy cá nhân**, không dùng cho môi trường thật. Đổi mật khẩu trong `.env` trước lần chạy đầu tiên. Nếu database đã có tài khoản thì thay đổi `.env` không tự đặt lại mật khẩu tài khoản cũ.

## 6. MinIO Object Storage

- Console: http://localhost:9001
- Access key / username: giá trị `MINIO_ROOT_USER` trong `.env`.
- Secret key / password: giá trị `MINIO_ROOT_PASSWORD` trong `.env`.
- Bucket: `MINIO_BUCKET` (mặc định `cosmetic-files`).
- Tệp upload: JPG, JPEG, PNG, WEBP, PDF, DOCX; giới hạn mặc định 5 MB.

Nội dung file được lưu trong MinIO, không ghi blob vào PostgreSQL. Bảng `file_metadata` lưu tên gốc, object key, MIME type, dung lượng, bucket, loại/ID thực thể liên quan, người tải lên và thời điểm tải lên. Truy cập file thông qua ứng dụng để áp dụng xác thực.

## 7. REST API

API cần session đăng nhập. Đăng nhập trên website trước rồi thử trong cùng browser, hoặc truyền cookie `cosmetic.sid` trong Postman.

| Method | Endpoint | Mục đích |
|---|---|---|
| GET | `/api/dashboard` | Thống kê tổng quan |
| GET | `/api/products?q=serum&page=1&limit=20` | Tìm kiếm và phân trang sản phẩm |
| GET | `/api/products/:id` | Chi tiết sản phẩm |
| POST | `/api/products` | Tạo sản phẩm |
| PUT | `/api/products/:id` | Cập nhật sản phẩm |
| DELETE | `/api/products/:id` | Xóa sản phẩm (Administrator) |
| GET / POST / PUT / DELETE | `/api/categories` và `/api/categories/:id` | CRUD danh mục |
| GET / POST / PUT / DELETE | `/api/brands` và `/api/brands/:id` | CRUD nhãn hàng |
| GET / POST / PUT / DELETE | `/api/suppliers` và `/api/suppliers/:id` | CRUD nhà cung cấp |
| GET / POST / PUT / DELETE | `/api/customers` và `/api/customers/:id` | CRUD khách hàng |
| POST | `/files/api/upload` | Upload multipart/form-data |
| GET | `/files/:id/download` | Tải file đã lưu |

Swagger: `postman/openapi.yaml`, UI tại `/api-docs`. Collection: `postman/Cosmetic-Mini.postman_collection.json`.

Một số thao tác CRUD qua giao diện dùng POST form để đơn giản hóa; REST API sử dụng HTTP verbs phù hợp. HTTP status dự kiến gồm 200, 201, 204, 400, 401, 403, 404 và 500.

## 8. Cấu trúc thư mục

```text
cosmetic-mini/
├── src/
│   ├── config/          # PostgreSQL pool, MinIO client
│   ├── middleware/      # Auth, validation, error handler
│   ├── routes/          # Web routes và REST API
│   ├── services/        # Auth, audit
│   ├── utils/           # Format, errors, async wrapper
│   ├── views/           # EJS templates
│   └── public/          # CSS, JS
├── database/
│   ├── schema.sql       # Tables, relationships, constraints, indexes
│   └── seed.sql         # Data mẫu
├── postman/             # OpenAPI + Postman Collection
├── tests/               # Unit/syntax tests
├── docs/                # Báo cáo, kiến trúc, checklist
├── Dockerfile
├── compose.yaml
├── .env.example
├── .gitignore
└── README.md
```

## 9. Các bảng dữ liệu chính

`users`, `categories`, `brands`, `suppliers`, `products`, `product_batches`, `customers`, `promotions`, `orders`, `order_items`, `stock_movements`, `file_metadata`, `audit_logs`.

Quan hệ tiêu biểu:
- Danh mục 1—N sản phẩm; nhãn hàng 1—N sản phẩm; nhà cung cấp 1—N lô hàng/sản phẩm.
- Sản phẩm 1—N lô hàng; đơn hàng 1—N chi tiết đơn; chi tiết đơn tham chiếu sản phẩm và có thể tham chiếu lô đã xuất.
- Khách hàng 1—N đơn hàng; người dùng tạo nhiều đơn và bản ghi kiểm toán.
- Metadata file liên kết tới loại/ID thực thể; object key trỏ đến object trong bucket MinIO.

## 10. Kiểm chứng dữ liệu bền vững — bắt buộc cho demo

1. Chạy `docker compose up -d --build`.
2. Đăng nhập website; tạo một sản phẩm hoặc khách hàng mới.
3. Vào **Kho tệp MinIO**, upload một ảnh/PDF nhỏ và xác nhận file xuất hiện.
4. Chạy:
   ```powershell
   docker compose down
   docker compose up -d
   ```
5. Mở lại website, kiểm tra bản ghi vẫn tồn tại; vào kho tệp và xem/tải lại file đã upload.
6. Mở MinIO Console để chứng minh object vẫn nằm trong bucket.

**Không dùng `docker compose down -v` trong bài kiểm chứng này** vì `-v` xóa named volumes và có thể làm mất dữ liệu. Chỉ dùng lệnh đó nếu thực sự muốn xóa toàn bộ dữ liệu demo.

## 11. Kiểm thử

Kiểm tra cú pháp và unit test nếu đã cài Node.js/npm trên máy:

```powershell
npm install
npm test
npm run lint:syntax
```

Kiểm tra chạy container:

```powershell
docker compose ps
docker compose logs --tail=100 application
docker compose logs --tail=100 database
docker compose logs --tail=100 minio
Invoke-RestMethod http://localhost:3000/health
```

Các ca kiểm thử đề xuất để ghi vào báo cáo:
1. Đăng nhập đúng và sai mật khẩu.
2. Staff truy cập được nghiệp vụ bán hàng nhưng không quản lý tài khoản.
3. Tạo/sửa/xóa danh mục, nhãn hàng, nhà cung cấp, sản phẩm, khách hàng.
4. Tìm kiếm theo mã và tên.
5. Tạo đơn có tồn kho đủ; xác nhận số lượng lô giảm.
6. Thử bán vượt tồn; hệ thống từ chối và rollback giao dịch.
7. Upload tệp hợp lệ; xem và tải xuống.
8. Upload sai định dạng hoặc vượt dung lượng; hệ thống từ chối.
9. `docker compose down` rồi `docker compose up -d`; dữ liệu SQL và MinIO vẫn còn.
10. Thử endpoint không đăng nhập và endpoint cần Administrator.

## 12. Docker network và liên hệ VPC/subnet

`cosmetic-network` là bridge network riêng, cho phép các container giao tiếp bằng tên service như `database` và `minio`. Cổng PostgreSQL không publish ra host; browser chỉ truy cập ứng dụng và MinIO Console qua các cổng đã publish. Điều này có nét tương đồng về mục tiêu cô lập và kiểm soát đường đi mạng với VPC/subnet, nhưng **Docker bridge network không phải VPC cloud đầy đủ**: nó không cung cấp toàn bộ routing, IAM, security groups, subnet routing hay dịch vụ cloud tương đương.

## 13. Lệnh hữu ích

```powershell
# Khởi động / build lại
docker compose up -d --build

# Theo dõi log
docker compose logs -f application

# Dừng nhưng giữ dữ liệu
docker compose down

# Xóa container và named volumes (xóa dữ liệu demo)
docker compose down -v

# Kiểm tra volumes
docker volume ls

# Kiểm tra network
docker network ls
```

## 14. Hạn chế và hướng phát triển

- Session store mặc định phù hợp demo; triển khai thật nên dùng session store bền vững (ví dụ PostgreSQL/Redis), HTTPS, CSRF protection, rate limiting, chính sách mật khẩu và sao lưu.
- Cấu hình MinIO dùng root credential trong mạng Docker để đơn giản hóa đồ án; hệ thống thực tế nên tạo user/policy chỉ có quyền cần thiết, không cấp root cho ứng dụng.
- Đơn hàng áp dụng FIFO/FEFO theo hạn dùng còn hiệu lực, nhưng chưa hỗ trợ hủy/hoàn đơn, thanh toán online hay quản lý nhiều chi nhánh.
- Báo cáo lợi nhuận cần quy tắc kế toán và xử lý hoàn hàng rõ ràng trước khi sử dụng thực tế.
- Dữ liệu demo và tài khoản demo phải được thay đổi trước khi chia sẻ repo.

## 15. Danh sách kiểm tra trước khi nộp

- [ ] `docker compose up -d --build` chạy thành công.
- [ ] Website có kết nối backend và database thật.
- [ ] CRUD ít nhất 3 thực thể; tìm kiếm; trang chi tiết.
- [ ] Upload/download qua UI và xác nhận object trong MinIO.
- [ ] Có REST API và Swagger/Postman.
- [ ] Phân quyền Administrator / Staff; không lưu plaintext password.
- [ ] Có Dockerfile, compose.yaml, `.env.example`, `.gitignore`, README.
- [ ] Kiểm chứng persistence bằng `down` rồi `up -d` (không thêm `-v`).
- [ ] Bổ sung tên thành viên, phân công, ảnh chụp màn hình, báo cáo 20–25 trang và slide bảo vệ.
- [ ] Kiểm tra ZIP không chứa `.env`, `node_modules`, key hoặc mật khẩu cá nhân.

## 16. Tài liệu đã chuẩn bị kèm source

- `documents/BaoCao_DoAn_Mau.pdf`: báo cáo mẫu PDF 25 trang theo cấu trúc yêu cầu; cần điền thành viên, ảnh chụp và kết quả thực tế.
- `documents/BaoCao_DoAn_Mau.docx`: bản báo cáo có thể chỉnh sửa.
- `documents/Slide_BaoVe_Mau.pptx`: slide bảo vệ mẫu có thể chỉnh sửa.
- `documents/UseCaseDiagram.png`, `ERD_or_ClassDiagram.png`, `DeploymentDiagram.png`: sơ đồ PNG; source Mermaid nằm trong `docs/diagrams/`.
- `docs/TEST-PLAN.md`: bảng test cases cần thực hiện.
- `docs/USER-GUIDE.md`: hướng dẫn sử dụng theo vai trò.
- `docs/DEPLOYMENT-CHECKLIST.md`: checklist chạy và xử lý lỗi Docker.

Báo cáo và slide là bản mẫu, không phải bằng chứng hệ thống đã chạy trên máy nhóm. Bổ sung ảnh chụp và kết quả kiểm thử thật trước khi nộp.


## Khách hàng, sản phẩm và ảnh sản phẩm

- Khách hàng: vào **Khách hàng** để tìm kiếm, thêm mới, xem chi tiết, chỉnh sửa và xuất CSV.
- Sản phẩm: vào **Sản phẩm** để thêm/cập nhật SKU, danh mục, nhãn hàng, nhà cung cấp, giá, ngưỡng tồn, mô tả và thành phần.
- Ảnh sản phẩm: trong biểu mẫu thêm/sửa sản phẩm, chọn JPG/PNG/WEBP (tối đa `MAX_UPLOAD_MB`, mặc định 5 MB). Ảnh được lưu trong MinIO, metadata trong PostgreSQL; danh sách và trang chi tiết hiển thị ảnh mới nhất.
- Với database đã khởi tạo, cập nhật index bằng lệnh trong `database/migrations/002_product_image_support.sql`. Có thể chạy: `Get-Content .\database\migrations\002_product_image_support.sql -Raw | docker compose exec -T database psql -U cosmetic_app -d cosmetic_mini` (điều chỉnh user/database nếu `.env` của bạn khác).
- Sau khi thay source, chạy `docker compose up -d --build`. Nếu project của bạn đang dùng schema SQL tối thiểu được tạo thủ công trong quá trình sửa lỗi, hãy sao lưu và khôi phục `database/schema.sql` đầy đủ từ gói ZIP này trước khi reset môi trường mới; không xóa volume database hiện có nếu cần giữ dữ liệu.


## Tài khoản khách hàng (mới)

- Truy cập `/register` để khách tự tạo tài khoản bằng họ tên, email và mật khẩu tối thiểu 10 ký tự.
- Tài khoản khách có vai trò `CUSTOMER`, được liên kết với hồ sơ trong bảng `customers`.
- Sau khi đăng nhập, khách chỉ vào được `/shop` (danh mục sản phẩm đang bán) và `/my-orders` (đơn hàng gắn với chính hồ sơ khách hàng đó).
- Khách không được truy cập dashboard quản trị, danh sách khách hàng, kho, báo cáo, tài khoản nhân viên hoặc API quản trị; các URL này bị chuyển hướng về khu vực khách hàng.
- Đơn hàng được nhân viên tạo cho đúng hồ sơ khách hàng sẽ xuất hiện trong lịch sử đơn hàng của tài khoản đó. Đăng ký tài khoản không tự tạo đơn hàng và chưa có checkout trực tuyến.
- Khi khởi động, ứng dụng tự áp dụng thay đổi schema tương thích (role `CUSTOMER` và `users.customer_id`) mà không xóa volume. Migration tương ứng nằm tại `database/migrations/003_customer_accounts.sql`.
