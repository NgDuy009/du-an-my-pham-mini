# Hướng dẫn sử dụng nhanh

## Administrator

1. Đăng nhập bằng tài khoản quản trị demo được cấu hình trong `.env`.
2. Tại dashboard, xem số sản phẩm, khách hàng, đơn hôm nay, doanh thu và cảnh báo tồn.
3. Tạo danh mục trước, sau đó tạo nhãn hàng/nhà cung cấp và sản phẩm để liên kết dữ liệu hợp lệ.
4. Vào **Lô hàng & hạn sử dụng**, nhập ít nhất một lô còn hàng cho mỗi sản phẩm cần bán.
5. Vào **Khách hàng** để thêm hồ sơ khách mua nếu cần.
6. Vào **Đơn hàng → Tạo đơn hàng**, chọn sản phẩm, số lượng, khách hàng và phương thức thanh toán. Hoàn tất để tạo hóa đơn.
7. Vào **Kho tệp MinIO** để tải ảnh hoặc tài liệu lên; mở file xem/tải để xác nhận.
8. Vào **Báo cáo** để lọc khoảng ngày, xem sản phẩm bán chạy, tồn kho thấp và lô sắp hết hạn.
9. Vào **Tài khoản** để tạo Staff; tài khoản không hoạt động có thể bị khóa/mở khóa.
10. Vào **Nhật ký hoạt động** để kiểm tra một số thao tác đã được ghi nhận.

## Staff

Staff có thể dùng các màn hình nghiệp vụ đã được cấp quyền. Các thao tác quản trị tài khoản và xóa dữ liệu bị giới hạn ở phía server. Nếu gặp lỗi 403, đăng nhập Administrator hoặc nhờ người quản trị thực hiện thao tác.

## Quy tắc tồn kho

- Sản phẩm mới tạo chưa có số lượng bán được cho đến khi nhập lô.
- Nhập lô cần mã lô riêng cho từng sản phẩm, số lượng dương và giá nhập không âm.
- Khi bán, ứng dụng chỉ dùng lô còn số lượng và chưa hết hạn.
- Nếu tổng số lượng không đủ, toàn bộ transaction bị rollback; kiểm tra lại tồn trước khi tạo đơn.
- Điều chỉnh tồn cần ghi lý do để thuận tiện đối chiếu.

## Tệp đính kèm

Tệp hợp lệ: JPG/JPEG, PNG, WEBP, PDF và DOCX. Dung lượng tối đa lấy từ `MAX_UPLOAD_MB`. Nội dung file nằm trong MinIO, metadata nằm trong PostgreSQL. Nếu xóa một metadata row thủ công trong database, object tương ứng có thể trở thành file mồ côi; nên thao tác qua UI.
