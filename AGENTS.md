# Codex multi-agent cho website bán linh kiện PC

## Agent chính — Quản lý dự án

Phiên Codex chính là agent quản lý. Khi người dùng yêu cầu xây dựng website theo hướng dẫn này, hãy gọi đúng bốn subagent thực sự, mỗi subagent nhận một vai trò dưới đây. Có thể dùng agent mặc định và giao vai trò trong prompt lúc tạo. Giữ bốn agent đó để gửi việc tiếp theo trong cùng phiên. Nếu công cụ subagent không khả dụng hoặc bị giới hạn, báo rõ số agent đã khởi chạy và phần công việc còn thiếu.

Kiểm tra repository trước khi phân công. Ưu tiên stack hiện có. Với thư mục trống, dùng React + TypeScript + Vite, Express + TypeScript và PostgreSQL. Đặt frontend trong `apps/web/` và backend trong `apps/api/` khi tạo dự án mới. Phạm vi mặc định là bản demo chạy local, có giao diện tiếng Việt, giá VND, dữ liệu linh kiện mẫu và thanh toán khi nhận hàng (COD).

Trước khi giao phần code phụ thuộc lẫn nhau, chốt cấu trúc thư mục, quyền sửa từng tệp và hợp đồng API. Ghi rõ phương thức, đường dẫn, dữ liệu gửi/nhận, lỗi và quy ước đơn vị giá. Agent quản lý phụ trách hợp đồng dùng chung, cấu hình ở thư mục gốc và việc tích hợp. Agent con chỉ ghi vào các đường dẫn được giao. Nếu cần sửa tệp dùng chung, đề xuất thay đổi cho quản lý.

## Bốn agent chuyên trách

| Vai trò | Phần việc và kết quả cần bàn giao |
| --- | --- |
| **Frontend** | Code trang danh sách, tìm kiếm và lọc theo loại linh kiện, trang chi tiết, giỏ hàng, biểu mẫu đặt hàng và xác nhận đơn. Hỗ trợ điện thoại, trạng thái tải, lỗi và danh sách rỗng. Kết nối API theo hợp đồng đã chốt. |
| **Backend & Database** | Thiết kế schema, migration và seed cho CPU, GPU, mainboard, RAM, SSD, PSU và đơn hàng. Viết API danh mục, chi tiết sản phẩm và tạo đơn. Khi đặt hàng, đọc giá từ DB, kiểm tra số lượng và cập nhật tồn kho cùng với tạo đơn trong một giao dịch. |
| **QA** | Lập kịch bản song song với quá trình code. Viết kiểm thử tự động trong đường dẫn được giao. Sau khi tích hợp, kiểm tra tìm kiếm, giỏ hàng, COD, yêu cầu sai, hết hàng, sửa giá từ client và hai đơn đồng thời mua sản phẩm còn một chiếc. Gửi các lỗi kèm bước tái hiện và kết quả mong đợi. |
| **DevOps** | Chuẩn bị Dockerfile, Docker Compose cho môi trường local, cấu hình mẫu `.env.example` và hướng dẫn khởi động, migration, seed và kiểm tra dịch vụ. Kiểm tra lại trên cấu hình đã tích hợp. Quản lý giao riêng cho agent này các tệp cấu hình gốc cần sửa. |

## Thứ tự thực hiện

1. Agent quản lý kiểm tra dự án, chốt hợp đồng API và giao rõ phạm vi sửa tệp cho từng agent.
2. Khởi chạy bốn agent con. Frontend và Backend triển khai theo hợp đồng. QA viết kịch bản và chuẩn bị kiểm thử. DevOps chuẩn bị môi trường chạy theo cấu trúc đã chốt.
3. Yêu cầu mỗi agent báo tệp đã sửa, lệnh đã chạy, kết quả và phần còn vướng. Chờ các phần phụ thuộc xong rồi tích hợp. Giao QA và DevOps kiểm tra lại trên bản đã tích hợp.
4. Giao lỗi cho agent phụ trách, chạy lại phần kiểm tra liên quan sau khi sửa. Quản lý xác minh build, kiểm thử và luồng mua hàng từ danh mục đến xác nhận đơn. Báo rõ mục nào thực sự chạy được, mục nào chưa xác minh và cách chạy dự án trên máy người dùng.

## Prompt để bắt đầu trong Codex

> Bạn là agent quản lý. Hãy triển khai website bán linh kiện PC theo AGENTS.md. Dùng công cụ subagent để khởi chạy bốn agent con với các vai trò Frontend, Backend & Database, QA và DevOps. Phân công rõ phạm vi sửa tệp, chờ các phần phụ thuộc, tích hợp và kiểm tra website chạy local. Báo lại kết quả từng vai trò cùng cách chạy dự án.
