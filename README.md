# 🎮 CyberHub - Hệ Thống Quản Lý Phòng Net & Cyber Game Chuyên Nghiệp

![CyberHub Banner](https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2070&auto=format&fit=crop)

**🔗 Live Demo (Client):** [https://client-eight-beta-96.vercel.app](https://client-eight-beta-96.vercel.app)

**CyberHub** là một nền tảng quản lý phòng net (Cyber Game) toàn diện, mang đến trải nghiệm tuyệt vời cho cả Khách hàng và Người Quản Trị (Admin). Với giao diện hiện đại (Modern UI), tương tác mượt mà và các tính năng Real-time, CyberHub giúp việc điều hành quán Net trở nên dễ dàng và đẳng cấp hơn bao giờ hết.

## ✨ Tính năng nổi bật

### 👑 Dành cho Quản Trị Viên (Admin)
- 📊 **Tổng quan (Dashboard):** Thống kê doanh thu theo thời gian thực, xem trạng thái các máy đang hoạt động, lượng khách hàng và quản lý đơn hàng nhanh chóng với biểu đồ doanh thu sống động.
- 💻 **Quản lý thiết bị:** Theo dõi tình trạng máy (Trống, Đang sử dụng, Bảo trì) theo thời gian thực.
- 🍔 **Quản lý Dịch vụ & Đơn hàng:** Tạo, chỉnh sửa sản phẩm (đồ ăn, nước uống). Xử lý đơn hàng từ khách với thông báo thời gian thực.
- 💬 **Hỗ trợ Khách hàng Real-time:** Tích hợp tính năng Chat trực tuyến để tiếp nhận yêu cầu và hỗ trợ khách hàng không cần rời khỏi màn hình quản lý.
- 🕒 **Giao Ca (Shifts):** Quản lý ca trực của nhân viên chuyên nghiệp, dễ dàng đối soát doanh thu, tiền mặt, và lịch sử bàn giao ca.
- 🎨 **Giao diện hiện đại & Tối ưu UI/UX:** Cấu trúc bảng điều khiển thông minh, hỗ trợ thu phóng (collapse) Sidebar, chế độ thiết kế Glassmorphism sang trọng, và các hiệu ứng Animations cao cấp.

### 👤 Dành cho Khách Hàng
- 📱 **Giao diện trực quan:** Tối ưu hóa UI/UX trên cả Desktop và Mobile. Xem thời gian sử dụng, số dư tài khoản dễ dàng.
- 💸 **Nạp tiền tự động (VietQR):** Nạp tiền tiện lợi và hoàn toàn tự động thông qua mã VietQR, không cần phải gọi nhân viên. Thông tin được nhúng trực tiếp ngay trên trang chủ để tối đa hóa trải nghiệm mượt mà.
- 🎁 **Đổi điểm lấy quà:** Tích điểm thông qua việc sử dụng dịch vụ và đổi lấy các phần quà hấp dẫn ngay trên giao diện trực quan.
- 🛒 **Gọi món tại ghế (Order In-Seat):** Đặt thức ăn/đồ uống từ xa và gửi trực tiếp đến quầy thu ngân.
- 🛎️ **Yêu cầu hỗ trợ:** Trò chuyện trực tiếp với nhân viên (Staff/Admin) để nhận hỗ trợ kỹ thuật hoặc dịch vụ ngay tại chỗ.

## 🛠️ Công nghệ sử dụng
Dự án được xây dựng trên cấu trúc **MERN Stack** mở rộng (Sử dụng MySQL thay vì MongoDB):
- **Frontend:** React.js, Vite, Axios, Chart.js, CSS thuần (Glassmorphism & CSS Animations).
- **Backend:** Node.js, Express.js.
- **Cơ sở dữ liệu:** MySQL (Thiết kế cơ sở dữ liệu chặt chẽ, an toàn).

## 🚀 Hướng dẫn cài đặt (Local Deployment)

### Yêu cầu hệ thống:
- [Node.js](https://nodejs.org/en/) (phiên bản 16.x trở lên)
- [MySQL Server](https://dev.mysql.com/downloads/installer/)

### Các bước triển khai:

**1. Clone dự án**
```bash
git clone https://github.com/Khoi12122005/QuanlyphongNet.git
cd QuanlyphongNet
```

**2. Khởi tạo Cơ sở dữ liệu**
- Import file `database/schema.sql` vào MySQL để tạo CSDL và chèn dữ liệu mẫu (Seed Data).
- Database name mặc định: `cyberhub_db`.

**3. Cấu hình Backend**
Tạo file `.env` trong thư mục `server/` và thiết lập các thông số kết nối:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=cyberhub_db
PORT=5000
JWT_SECRET=your_jwt_secret_key
```
Sau đó cài đặt các gói thư viện:
```bash
cd server
npm install
```

**4. Khởi chạy toàn bộ hệ thống**
Hệ thống đã được thiết lập để có thể Serve cả Backend và Frontend thông qua một cổng duy nhất ở chế độ Production.
```bash
# Build frontend
cd ../client
npm install
npm run build

# Chạy server ở chế độ Production
cd ../server
npm start
```
Truy cập vào trình duyệt:
👉 **Trang Khách:** `http://localhost:5000`
👉 **Trang Quản trị (Admin):** `http://localhost:5000/admin`

> **Tài khoản Admin mặc định:** 
> Tên đăng nhập: `admin` | Mật khẩu: `admin123`

---
*Dự án được thiết kế với tâm huyết nhằm mang lại trải nghiệm tối ưu nhất cho cả Game thủ và Người vận hành.*
