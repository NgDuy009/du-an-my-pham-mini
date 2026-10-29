# Báo cáo đồ án — Lumière Cosmetic

> Bản mẫu học thuật cần được nhóm bổ sung tên thành viên, lớp, giảng viên, ảnh chụp hệ thống chạy thực tế và kết quả kiểm thử trước khi nộp. Không sử dụng các số liệu minh họa như kết quả đo đạc thật.

## Tóm tắt
Lumière Cosmetic là ứng dụng web quản lý cửa hàng mỹ phẩm mini. Hệ thống minh họa kiến trúc web nhiều tầng gồm giao diện người dùng, backend REST API, cơ sở dữ liệu quan hệ PostgreSQL và MinIO Object Storage. Các thành phần được đóng gói và kết nối bằng Docker Compose; database và object storage sử dụng named volume để dữ liệu không mất khi container bị tạo lại.

## 1. Giới thiệu bài toán
Cửa hàng mỹ phẩm nhỏ thường quản lý danh mục, nhãn hàng, nhà cung cấp, khách hàng, tồn kho và đơn hàng bằng sổ ghi chép hoặc nhiều bảng tính tách rời. Cách làm này gây khó khăn khi tra cứu mã sản phẩm, kiểm tra lô hàng và hạn sử dụng, tổng hợp doanh thu, cũng như lưu trữ ảnh sản phẩm và chứng từ. Đồ án xây dựng một hệ thống quản lý thống nhất, có thể khởi chạy trên máy cá nhân để trình diễn kiến thức điện toán đám mây.

## 2. Mục tiêu hệ thống
Mục tiêu chính là xây dựng giao diện có thể sử dụng trên trình duyệt; triển khai REST API; lưu dữ liệu có quan hệ bằng SQL; lưu file qua MinIO; quản lý quyền Administrator/Staff; và chứng minh tính bền vững của dữ liệu bằng Docker volumes. Mục tiêu mở rộng gồm quản lý lô/hạn sử dụng, giao dịch bán hàng có transaction và báo cáo doanh thu.

## 3. Phạm vi
Phạm vi gồm danh mục, sản phẩm, nhãn hàng, nhà cung cấp, khách hàng, lô hàng, đơn hàng, chi tiết đơn, tệp upload, tài khoản, audit log và báo cáo cơ bản. Không nằm trong phạm vi bắt buộc: thanh toán online, nhiều chi nhánh, tích hợp ERP, Kubernetes, cloud công cộng, high availability hoặc microservices.

## 4. Yêu cầu chức năng
Người dùng đăng nhập và đăng xuất; xem dashboard; tìm kiếm dữ liệu theo mã/tên; tạo, xem, cập nhật và xóa các thực thể được phân quyền; nhập lô hàng và theo dõi hạn dùng; tạo đơn hàng và in hóa đơn; upload, xem và tải tệp; xem báo cáo; Administrator quản lý tài khoản và nhật ký. Các biểu mẫu có nhãn, validation cơ bản và thông báo kết quả.

## 5. Yêu cầu phi chức năng
Ứng dụng cần dễ chạy trên Windows với Docker Desktop, có cấu hình thông qua biến môi trường, hạn chế lộ thông tin nhạy cảm, dùng parameterized SQL, hash mật khẩu, xử lý lỗi có thông điệp phù hợp và giao diện co giãn theo kích thước màn hình. Persistence được kiểm chứng bằng việc dừng và chạy lại Compose mà không xóa volume.

## 6. Use Case
Hai actor chính là Administrator và Staff. Cả hai có thể đăng nhập, xem dashboard, tra cứu dữ liệu, thực hiện nghiệp vụ được cấp quyền, bán hàng và quản lý file theo quyền. Administrator có thêm quyền quản lý tài khoản, dữ liệu danh mục và nhật ký. Sơ đồ nguồn nằm tại `docs/diagrams/use-case.mmd`.

## 7. Kiến trúc tổng thể
Lựa chọn phương án giao diện tích hợp backend: Node.js/Express phục vụ EJS và REST API trong cùng container. PostgreSQL lưu dữ liệu quan hệ; MinIO lưu nội dung file; Docker Compose khai báo service, environment, network và volumes. Browser chỉ giao tiếp HTTP với ứng dụng và MinIO Console dành cho demo, không kết nối trực tiếp PostgreSQL.

## 8. Thiết kế database
Cơ sở dữ liệu có các bảng users, categories, brands, suppliers, products, product_batches, customers, promotions, orders, order_items, stock_movements, file_metadata và audit_logs. Khóa chính dùng BIGSERIAL; khóa ngoại thể hiện quan hệ; unique constraint chống trùng mã; check constraint ngăn giá/số lượng âm; index hỗ trợ tìm kiếm và tra cứu lịch sử. Chi tiết được định nghĩa trong `database/schema.sql`.

## 9. Quản lý sản phẩm
Mỗi sản phẩm có SKU, tên, danh mục, nhãn hàng, nhà cung cấp, mô tả, thành phần, quy cách, giá nhập, giá bán và ngưỡng cảnh báo tồn. Danh sách cho phép tìm theo SKU hoặc tên; trang chi tiết hiển thị thông tin bản ghi. Giá được lưu dưới dạng NUMERIC để tránh sai số nhị phân của số thực.

## 10. Quản lý lô và hạn sử dụng
Một sản phẩm có thể có nhiều lô nhập. Mỗi lô giữ mã lô, ngày sản xuất, ngày hết hạn, ngày nhận, số lượng nhập, số lượng còn lại và giá nhập. Việc quản lý theo lô giúp xác định sản phẩm sắp hết hạn. Khi bán, hệ thống ưu tiên lô có hạn dùng gần hơn và chỉ sử dụng lô còn hàng, chưa hết hạn.

## 11. Nghiệp vụ đơn hàng
Đơn hàng lưu mã đơn, khách hàng, nhân viên tạo, trạng thái, tạm tính, giảm giá, tổng tiền, phương thức thanh toán và thời điểm hoàn tất. Mỗi chi tiết lưu snapshot SKU/tên, số lượng, giá bán và giá vốn tại thời điểm bán. Việc khóa dòng và cập nhật lô trong transaction giảm nguy cơ bán vượt tồn khi hai thao tác diễn ra đồng thời.

## 12. Upload và Object Storage
Tệp được gửi qua multipart/form-data. Backend giới hạn dung lượng, kiểm tra phần mở rộng và MIME type, sinh object key UUID tránh đè tên, rồi lưu nội dung vào bucket MinIO. PostgreSQL chỉ giữ metadata gồm tên gốc, key, MIME, size, bucket, loại/ID thực thể, người upload và thời gian. Nếu ghi metadata thất bại sau khi upload, ứng dụng cố gắng xóa object vừa tạo để tránh file mồ côi.

## 13. REST API và HTTP status
API cung cấp CRUD cho sản phẩm, danh mục, nhãn hàng, nhà cung cấp và khách hàng; dashboard API trả thống kê; file upload nhận multipart. Các status thường dùng gồm 200, 201, 204, 400, 401, 403, 404 và 500. Tài liệu OpenAPI và Postman Collection được đặt trong thư mục `postman`.

## 14. Xác thực và phân quyền
Ứng dụng dùng session cookie và bcrypt hash. Tài khoản mẫu được tạo lần đầu dựa trên biến môi trường. Administrator được phép quản lý tài khoản và thao tác quản trị; Staff được dùng các màn hình nghiệp vụ đã cho phép. Trong ứng dụng thực tế, cần bổ sung CSRF protection, rate limiting, session store bền vững và quy trình đổi mật khẩu.

## 15. Thiết kế giao diện
Giao diện dùng sidebar, topbar, dashboard cards, bảng dữ liệu, biểu mẫu, trang chi tiết và thông báo. CSS tự thiết kế với màu trung tính, sắc hồng đất và xanh dịu phù hợp chủ đề mỹ phẩm. Trên màn hình nhỏ, sidebar có thể mở/đóng và bảng có vùng cuộn ngang.

## 16. Dockerfile và Compose
Dockerfile dùng Node.js Alpine, cài dependency production, copy source và khởi chạy ứng dụng. Compose có ba service: application, database và minio. `cosmetic-network` là bridge network riêng. `database-data` và `minio-data` là named volumes. Các thông số nhạy cảm được đọc từ `.env`, trong khi `.env.example` chỉ cung cấp tên biến và giá trị mẫu.

## 17. Liên hệ VPC/subnet
Docker bridge network tạo vùng giao tiếp nội bộ cho các container. Ứng dụng gọi database bằng DNS service `database` và gọi MinIO bằng `minio`, không cần IP tĩnh. Mục tiêu cô lập có điểm tương đồng với VPC/subnet nhưng không thể xem Docker network là VPC hoàn chỉnh: nó không thay thế route table, security group, IAM hay các dịch vụ mạng cloud.

## 18. Kiểm thử
Cần kiểm thử đăng nhập, phân quyền, CRUD, tìm kiếm, tạo đơn, từ chối bán vượt tồn, upload file hợp lệ/không hợp lệ, xem/tải file, xuất CSV và persistence. Chạy unit test bằng `npm test`, kiểm tra cú pháp bằng `npm run lint:syntax`, kiểm tra container bằng `docker compose ps` và endpoint `/health`. Ảnh chụp và kết quả thật phải được nhóm bổ sung sau khi chạy trên Docker Desktop.

## 19. Kiểm chứng persistence
Sau khi tạo một bản ghi và upload file, chạy `docker compose down`, sau đó `docker compose up -d`. Bản ghi phải còn trong giao diện; file phải còn trong danh sách và có thể tải lại; object vẫn xuất hiện trong MinIO Console. Không dùng `docker compose down -v` trong bước này vì lệnh đó xóa volumes.

## 20. Hướng dẫn demo
Trình bày theo thứ tự: bài toán; kiến trúc; khởi chạy Compose; đăng nhập; CRUD tối thiểu ba thực thể; tìm kiếm; tạo lô; bán đơn và in hóa đơn; upload/download; Swagger/Postman; mở MinIO Console; trình bày ERD và Deployment Diagram; cuối cùng chứng minh persistence. Tất cả thành viên nên hiểu phần mình phụ trách và lý do sử dụng volume/network.

## 21. Hạn chế
Phiên bản đồ án chưa xử lý đầy đủ đổi trả, hủy đơn, khuyến mãi nâng cao, nhiều chi nhánh, kế toán, backup tự động hoặc triển khai công khai. MinIO đang dùng root credential trong mạng demo; production cần user/policy tối thiểu quyền. Session store mặc định không phù hợp nhiều replica. Đây là các giới hạn cần nêu trung thực khi bảo vệ.

## 22. Hướng phát triển và kết luận
Có thể mở rộng kiểm thử tích hợp, CSRF, rate limiting, audit đầy đủ hơn, nhập/xuất CSV sản phẩm, hoàn đơn, quản lý chương trình khuyến mãi, báo cáo lợi nhuận, backup định kỳ và triển khai lên VM cloud nếu được yêu cầu. Đồ án minh họa được kiến trúc nhiều tầng, SQL quan hệ, Object Storage, Dockerfile, Compose, biến môi trường và persistence. Trước khi nộp cần xác nhận chạy thành công trên máy nhóm và bổ sung minh chứng thật.

## Tài liệu tham khảo
1. Tài liệu yêu cầu đồ án cuối kỳ học phần Điện toán đám mây do giảng viên cung cấp.
2. Docker Docs — Docker Compose: https://docs.docker.com/compose/
3. PostgreSQL Documentation: https://www.postgresql.org/docs/
4. MinIO Documentation: https://min.io/docs/
5. Express Documentation: https://expressjs.com/
