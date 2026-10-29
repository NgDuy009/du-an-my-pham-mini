# Checklist triển khai Docker Desktop

## Trước khi build
- [ ] Docker Desktop mở và engine đã sẵn sàng.
- [ ] Mở terminal ở đúng thư mục chứa `compose.yaml`.
- [ ] File `.env` đã được tạo từ `.env.example`.
- [ ] Đã thay các mật khẩu mặc định.
- [ ] Port 3000, 9000 và 9001 chưa bị ứng dụng khác chiếm.

## Build và chạy

```powershell
docker compose config
docker compose up -d --build
docker compose ps
docker compose logs -f application
```

Nếu PostgreSQL chưa sẵn sàng, application sẽ thử kết nối lại. Nếu MinIO chưa sẵn sàng, ứng dụng thử tạo bucket nhiều lần rồi mới dừng khi hết số lần thử.

## Kiểm tra service

- `http://localhost:3000/health`: kiểm tra app và kết nối SQL.
- `http://localhost:3000`: đăng nhập và sử dụng UI.
- `http://localhost:3000/api-docs`: Swagger UI.
- `http://localhost:9001`: MinIO Console.

## Sự cố thường gặp

### Port already allocated
Đổi port bên trái trong `compose.yaml`, ví dụ `3001:3000`, sau đó truy cập cổng mới. Đổi port bên phải chỉ khi ứng dụng trong container được cấu hình dùng port khác.

### Database password authentication failed
Kiểm tra `DB_PASSWORD` và `POSTGRES_PASSWORD`. Nếu volume database đã được tạo trước đó, đổi `.env` không tự thay mật khẩu role bên trong database đã khởi tạo. Đối với dữ liệu demo có thể xóa volume bằng `docker compose down -v` rồi chạy lại, nhưng thao tác này xóa dữ liệu và không dùng trong bài kiểm chứng persistence.

### File không hiển thị sau upload
Xem `docker compose logs application` và `docker compose logs minio`; kiểm tra biến `MINIO_ENDPOINT=minio`, port nội bộ 9000, username/password giống nhau giữa app và service MinIO; kiểm tra bucket đã được tạo.

### Dữ liệu không còn sau restart
Kiểm tra Compose đang khai báo `database-data` và `minio-data`, không dùng `down -v`, và service không mount nhầm thư mục tạm thay cho named volume.

### Trang báo lỗi 500
Đọc log backend. Các lỗi constraint có thể do mã trùng, khóa ngoại không tồn tại hoặc dữ liệu sai định dạng. Không sửa trực tiếp database nếu chưa sao lưu.
