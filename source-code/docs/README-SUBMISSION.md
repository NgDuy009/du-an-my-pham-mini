# Chuẩn bị gói nộp theo PDF

Gói phát hành được bố trí theo yêu cầu: `source-code/`, `documents/`, `demo/screenshots/` và `link-github.txt`.

## Trước khi nộp
1. Điền tên nhóm, mã sinh viên, lớp, giảng viên và phân công trong báo cáo/slide.
2. Chạy ứng dụng trên Docker Desktop, hoàn thành bảng kiểm thử và thay các trạng thái `Chưa thực hiện` bằng kết quả thực tế.
3. Chụp ảnh dashboard, CRUD, API, MinIO và kiểm chứng persistence vào `demo/screenshots/`.
4. Đọc lại báo cáo 20–25 trang và kiểm tra hình ảnh/sơ đồ đã chèn.
5. Không nộp `.env`, `node_modules`, `target`, `bin`, `obj`, `.vs`, `.idea`, key hoặc token.
6. Chạy `docker compose down` rồi `docker compose up -d` để chứng minh volumes. Không dùng `down -v` trong bước kiểm chứng.
7. Nếu tạo GitHub repository, kiểm tra `.gitignore` và quét secret trước khi push.
