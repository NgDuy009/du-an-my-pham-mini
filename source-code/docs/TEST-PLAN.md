# Kế hoạch kiểm thử và biên bản nghiệm thu

> Điền cột kết quả sau khi thực hiện trên máy có Docker Desktop. Không đánh dấu Pass trước khi đã chạy thật.

| ID | Nhóm | Tiền điều kiện | Bước thực hiện | Kết quả mong đợi | Kết quả thực tế |
|---|---|---|---|---|---|
| TC-01 | Khởi động | Docker Desktop đang chạy | `docker compose up -d --build` | Ba service được tạo và chạy | Chưa thực hiện |
| TC-02 | Health | App đã chạy | Mở `/health` | HTTP 200, JSON `status=ok` | Chưa thực hiện |
| TC-03 | Đăng nhập | Có tài khoản demo | Đăng nhập đúng email/password | Chuyển vào dashboard | Chưa thực hiện |
| TC-04 | Đăng nhập | Có tài khoản demo | Nhập mật khẩu sai | Không đăng nhập; thông báo lỗi | Chưa thực hiện |
| TC-05 | Phân quyền | Đăng nhập Staff | Mở `/users` | HTTP 403 / trang lỗi quyền | Chưa thực hiện |
| TC-06 | Danh mục | Đăng nhập Administrator | Tạo danh mục với mã mới | Dữ liệu xuất hiện trong danh sách | Chưa thực hiện |
| TC-07 | Danh mục | Có danh mục | Tạo mã danh mục trùng | Database từ chối; thông báo lỗi | Chưa thực hiện |
| TC-08 | Sản phẩm | Có danh mục, brand và supplier | Tạo sản phẩm hợp lệ | Lưu và hiển thị đúng quan hệ | Chưa thực hiện |
| TC-09 | Sản phẩm | Có sản phẩm | Tìm theo SKU | Danh sách lọc đúng | Chưa thực hiện |
| TC-10 | Sản phẩm | Có sản phẩm | Mở trang chi tiết | Hiện các trường của sản phẩm | Chưa thực hiện |
| TC-11 | CSV | Có dữ liệu | Bấm CSV ở danh sách | Trình duyệt tải file CSV UTF-8 | Chưa thực hiện |
| TC-12 | Lô hàng | Có sản phẩm | Nhập lô có hạn dùng | Lô được lưu; tồn kho tăng | Chưa thực hiện |
| TC-13 | Lô hàng | Có lô | Điều chỉnh số lượng xuống âm | Server từ chối/rollback | Chưa thực hiện |
| TC-14 | Bán hàng | Có lô đủ hàng | Tạo đơn 2 mặt hàng | Đơn và chi tiết được lưu | Chưa thực hiện |
| TC-15 | Bán hàng | Có lô đủ hàng | Kiểm tra tồn sau bán | Số lượng lô giảm chính xác | Chưa thực hiện |
| TC-16 | Bán hàng | Tồn thấp | Bán số lượng lớn hơn tồn | Transaction rollback; không tạo đơn dở | Chưa thực hiện |
| TC-17 | Hóa đơn | Có đơn | Mở chi tiết và in hóa đơn | Nội dung và tổng tiền khớp | Chưa thực hiện |
| TC-18 | Upload | Đăng nhập | Upload ảnh PNG nhỏ | Object và metadata được tạo | Chưa thực hiện |
| TC-19 | Upload | Đăng nhập | Upload PDF nhỏ | Tệp được lưu trong bucket | Chưa thực hiện |
| TC-20 | Upload | Đăng nhập | Upload file EXE đổi đuôi | Bị từ chối | Chưa thực hiện |
| TC-21 | Upload | Đăng nhập | Upload file vượt MAX_UPLOAD_MB | Bị từ chối | Chưa thực hiện |
| TC-22 | Download | Có metadata file | Bấm xem/tải | Nội dung file trả về đúng MIME | Chưa thực hiện |
| TC-23 | API | Đã đăng nhập | GET `/api/products` | JSON có data và pagination | Chưa thực hiện |
| TC-24 | API | Chưa đăng nhập | Gọi `/api/products` | HTTP 401 | Chưa thực hiện |
| TC-25 | API | Staff | DELETE `/api/products/1` | HTTP 403 | Chưa thực hiện |
| TC-26 | Báo cáo | Có đơn hàng | Lọc ngày và xuất CSV | Tổng hợp đúng với đơn hoàn tất | Chưa thực hiện |
| TC-27 | MinIO | Đã upload file | Mở MinIO Console | Object nằm trong bucket | Chưa thực hiện |
| TC-28 | Persistence | Đã tạo bản ghi và upload | `docker compose down` | Container dừng, volume vẫn còn | Chưa thực hiện |
| TC-29 | Persistence | Sau TC-28 | `docker compose up -d` | Bản ghi và object vẫn đọc được | Chưa thực hiện |
| TC-30 | Secret | Repo được chuẩn bị nộp | Kiểm tra `git status` | `.env`, node_modules và secret không bị commit | Chưa thực hiện |

## Lệnh thu thập minh chứng

```powershell
docker compose ps
docker compose logs --tail=100 application
docker compose logs --tail=100 database
docker compose logs --tail=100 minio
docker volume ls
docker network ls
Invoke-RestMethod http://localhost:3000/health
```

## Quy tắc ghi nhận lỗi

Với mỗi lỗi, ghi lại ID test, thời gian, dữ liệu đầu vào, bước tái hiện, kết quả mong đợi, kết quả thực tế, ảnh chụp/log và trạng thái sau khi sửa. Không đưa mật khẩu, cookie session hoặc access key vào ảnh chụp gửi công khai.
