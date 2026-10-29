# Kiến trúc hệ thống

## 1. Phân tầng

1. **Presentation:** EJS templates, CSS và JavaScript trong `src/views` và `src/public`. Giao diện gửi form hoặc fetch HTTP đến ứng dụng; không kết nối trực tiếp PostgreSQL hay MinIO.
2. **Application / REST API:** Express routers xử lý request, xác thực session, phân quyền, kiểm tra dữ liệu, gọi service và trả HTML hoặc JSON với HTTP status phù hợp.
3. **Relational data:** PostgreSQL giữ dữ liệu nghiệp vụ, quan hệ, trạng thái đơn hàng, tồn kho, metadata tệp và audit log.
4. **Object storage:** MinIO lưu nội dung file theo object key duy nhất; bảng `file_metadata` lưu thông tin mô tả file.
5. **Container runtime:** Dockerfile đóng gói ứng dụng; Compose tạo ba service, network riêng và hai named volumes.

## 2. Luồng upload

```text
Browser -> POST /files (multipart/form-data)
        -> multer memory storage (giới hạn byte)
        -> kiểm tra MIME + phần mở rộng
        -> MinIO putObject(bucket, objectKey, content)
        -> PostgreSQL INSERT file_metadata
        -> nếu insert metadata lỗi: cố gắng xóa object đã ghi
        -> redirect và thông báo kết quả
```

Ứng dụng không cung cấp trực tiếp credential MinIO cho browser. Việc xem/tải file đi qua route có xác thực.

## 3. Luồng bán hàng và tính nhất quán tồn kho

1. Kiểm tra product ID và quantity ở server.
2. Mở transaction PostgreSQL.
3. Khóa dòng sản phẩm và các lô còn hàng bằng `FOR UPDATE`.
4. Phân bổ số lượng theo hạn sử dụng trước, rồi ngày nhập (FEFO gần đúng).
5. Nếu tổng tồn không đủ, ném lỗi và rollback toàn bộ đơn.
6. Nếu đủ, tạo order, order items, cập nhật quantity_remaining và ghi stock_movements trong cùng transaction.
7. Commit rồi ghi audit log.

## 4. Quyền

- `ADMIN`: toàn quyền nghiệp vụ, quản lý danh mục/nhãn hàng/nhà cung cấp, điều chỉnh tồn, quản lý tài khoản và xóa dữ liệu.
- `STAFF`: truy cập nghiệp vụ bán hàng, khách hàng, sản phẩm theo các route được mở; không được quản lý tài khoản hoặc gọi các thao tác quản trị.
- Mật khẩu được băm bcrypt với cost factor 12.

## 5. Docker network và volume

`cosmetic-network` là mạng bridge nội bộ. Ứng dụng kết nối database bằng hostname `database` và MinIO bằng `minio`; các container không phụ thuộc địa chỉ IP cố định. `database-data` và `minio-data` là named volumes, độc lập vòng đời container. `docker compose down` xóa container/network nhưng giữ volumes; `docker compose down -v` xóa volumes.

## 6. Giới hạn thiết kế

Ứng dụng phục vụ mục tiêu học tập/demo local. Trước khi triển khai công khai cần bổ sung CSRF, rate limit, session store bền vững, TLS, chính sách quản lý secret, MinIO least-privilege user, backup/restore và giám sát.
