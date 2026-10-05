# HỆ THỐNG WEBSITE & POS BÁN ĐỒ ĂN NHANH (FASTFOOD MANAGEMENT SYSTEM)

Hệ thống bán đồ ăn nhanh đa nền tảng gồm Cửa hàng trực tuyến (Shop), Bàn làm việc thu ngân & Quầy bán hàng cảm ứng (POS), và Bảng điều khiển quản trị (Admin Dashboard) với 3 vai trò phân quyền rõ ràng: **ADMIN**, **THU NGÂN (CASHIER)** và **KHÁCH HÀNG**.

---

## 🌐 TÊN MIỀN WEB HOÀN TOÀN MIỄN PHÍ ĐANG HOẠT ĐỘNG (LIVE CLOUD)

Ứng dụng hiện đã được triển khai sẵn trên máy chủ Cloud tốc độ cao (Google Cloud Run HTTPS) với tên miền hoàn toàn miễn phí, online 24/7:
👉 **[https://ais-pre-f4xembmkob6fksszj2cj6z-174011996207.asia-east1.run.app](https://ais-pre-f4xembmkob6fksszj2cj6z-174011996207.asia-east1.run.app)**

Bất kỳ ai có đường link trên đều có thể truy cập đặt món, thu ngân hoặc quản trị mà bạn không mất bất kỳ chi phí mua tên miền hay máy chủ nào.

---

## 🚀 HƯỚNG DẪN ĐẨY LÊN CÁC NỀN TẢNG HOSTING MIỄN PHÍ KHÁC (RENDER, VERCEL, KOYEB)

Dự án đã được cấu hình sẵn các tệp triển khai tự động `render.yaml` và `vercel.json`:

### 1. Triển khai lên Render.com (Tên miền miễn phí: `your-app.onrender.com`)
1. Đăng ký tài khoản miễn phí tại [render.com](https://render.com) (Đăng nhập bằng tài khoản GitHub).
2. Chọn **New +** -> **Web Service** -> Chọn Repository GitHub của bạn.
3. Cấu hình cài đặt:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free` ($0/tháng)
4. Nhấn **Create Web Service**. Sau 1 - 2 phút, website của bạn sẽ hoạt động với tên miền miễn phí dạng `https://fastfoodweb.onrender.com`.

### 2. Triển khai lên Vercel (Tên miền miễn phí: `your-app.vercel.app`)
1. Đăng ký tài khoản miễn phí tại [vercel.com](https://vercel.com).
2. Nhấn **Add New Project** -> Chọn GitHub Repository.
3. File cấu hình `vercel.json` đã được tạo sẵn trong dự án, Vercel sẽ tự động nhận diện và triển khai với tên miền `*.vercel.app`.

---

## 🚀 HƯỚNG DẪN CÀI ĐẶT & CHẠY LOCAL (TẢI VỀ MÁY)

### 1. Yêu Cầu Hệ Thống
- Đã cài đặt **Node.js** (Khuyến nghị phiên bản LTS từ v18 trở lên).
- Trình quản lý gói `npm` (đi kèm sẵn với Node.js).

### 2. Các Bước Khởi Chạy

```bash
# 1. Cài đặt các thư viện phụ thuộc
npm install

# 2. Khởi chạy server ở chế độ phát triển
npm run dev
```

Sau khi chạy lệnh trên, mở trình duyệt truy cập:
👉 **http://localhost:3000**

---

## 🔑 TÀI KHOẢN ĐĂNG NHẬP HỆ THỐNG

| Vai trò | Tên đăng nhập (Username) | Mật khẩu (Password) | Trang truy cập chính |
| :--- | :--- | :--- | :--- |
| **ADMIN (Quản trị viên)** | `admin` | `123` | `/Admin` (Bảng điều khiển quản trị) |
| **THU NGÂN (Cashier)** | `thungan` | `123` | `/Cashier` (Bàn làm việc ca trực) & `/Pos` (Bán hàng quầy) |
| **KHÁCH HÀNG** | *(Không cần đăng nhập)* | *(Tự do truy cập)* | `/Shop` (Cửa hàng đặt món trực tuyến) |

---

## 📂 DANH SÁCH CÁC TRANG & CHỨC NĂNG CHÍNH

### 1. Khu Vực Khách Hàng (Online Shop)
* **`/Shop`**: Cửa hàng đặt món trực tuyến, lọc danh mục (Gà rán, Burger, Combo, Nước...), giỏ hàng tự động tính phí ship, thanh toán COD hoặc VNPAY QR.
* **`/Shop/VNPayCallback`**: Trang thông báo kết quả giao dịch và mã đơn hàng trực quan.

### 2. Khu Vực Thu Ngân (Cashier & POS)
* **`/Cashier`**: Bàn làm việc thu ngân (Doanh thu ca hiện tại, đối soát tiền mặt, doanh thu VNPAY QR, lịch sử đơn trong ca).
* **`/Pos`**: Màn hình bán hàng cảm ứng (POS), tìm kiếm nhanh, thêm giỏ hàng, tích điểm thành viên qua SĐT, tính tiền thối tự động, in hóa đơn.
* **`/Cashier/Orders`**: Quản lý đơn hàng ca trực, chuyển trạng thái đơn (Pending, Hoàn tất, Đã hủy).
* **`/Cashier/Customers`**: Tra cứu điểm tích lũy thành viên khi khách thanh toán tại quầy.
* **`/Cashier/ShiftSummary`**: Báo cáo tổng kết doanh thu và biên bản ca trực.
* **`/Pos/EndShiftReport`**: Đối soát két tiền và chốt ca làm việc.
* **`/Cashier/Profile`**: Thông tin ca làm việc và tài khoản thu ngân.

### 3. Khu Vực Quản Trị Hệ Thống (Admin)
* **`/Admin`**: Dashboard tổng quan KPI, doanh thu theo ngày, biểu đồ xu hướng, top món ăn bán chạy nhất.
* **`/Admin/Products`**: Quản lý thực đơn (CRUD món ăn, giá bán, mô tả, ảnh, cảnh báo tồn kho).
* **`/Admin/Categories`**: Quản lý danh mục thực đơn (Thêm, sửa, xóa danh mục).
* **`/Admin/Customers`**: Quản lý danh sách khách hàng, điểm thưởng và hạng thẻ thành viên.
* **`/Admin/Orders`**: Quản lý toàn bộ lịch sử đơn hàng của hệ thống và in hóa đơn chi tiết.
* **`/Admin/Inventory`**: Kiểm kê tồn kho, nút tăng giảm kho hàng theo thời gian thực (AJAX).
* **`/Admin/RevenueReport`**: Thống kê doanh thu theo ngày/tháng và phương thức thanh toán.
* **`/Admin/Reports`**: Thống kê món ăn bán chạy, phân tích tỷ trọng nhóm món.
* **`/Admin/Staff`**: Quản lý nhân sự, phân quyền vai trò và mức lương theo giờ.
* **`/Admin/SalaryReport`**: Bảng tính lương tự động dựa trên giờ làm việc thực tế và đối soát quỹ tiền két.
* **`/Admin/Profile`**: Thông tin tài khoản quản trị viên.

---

## 💻 HƯỚNG DẪN MỞ & CHẠY BẰNG VISUAL STUDIO CODE (VS CODE)

Dự án đã được cấu hình sẵn các tệp cài đặt chuyên biệt cho VS Code trong thư mục `.vscode/`:

### Bước 1: Mở thư mục dự án trong VS Code
1. Mở phần mềm **Visual Studio Code**.
2. Chọn menu **File** -> **Open Folder...** (hoặc phím tắt `Ctrl + K, Ctrl + O`).
3. Chọn thư mục chứa dự án `fastfoodweb`.

### Bước 2: Cài đặt thư viện dependencies (Lần đầu tiên)
1. Mở Terminal trong VS Code bằng phím tắt **`Ctrl + \``** (hoặc menu **Terminal** -> **New Terminal**).
2. Chạy lệnh:
   ```bash
   npm install
   ```

### Bước 3: Chạy & Build ứng dụng trên VS Code
Bạn có thể chọn **1 trong các cách sau**:
* **Cách 1 (Nhanh nhất - Phím F5):**
  - Nhấn phím **`F5`** trên bàn phím (hoặc vào tab **Run and Debug** `Ctrl + Shift + D` ở thanh bên trái và bấm nút Play xanh ▶️ **"Chạy FastFood Web & POS (F5)"**).
  - VS Code sẽ tự khởi chạy server và hỗ trợ Debug / Hot restart!
* **Cách 2 (Qua Terminal):**
  ```bash
  npm run dev
  ```
* **Cách 3 (Phím tắt Build `Ctrl + Shift + B`):**
  - Nhấn tổ hợp phím **`Ctrl + Shift + B`** để chạy tác vụ kiểm tra TypeScript (`npm run build`).

Sau khi khởi chạy, mở trình duyệt truy cập:
👉 **http://localhost:3000**

---

## 🛠️ HƯỚNG DẪN XÓA CODE CŨ & ĐẨY CODE MỚI LÊN GITHUB

### Cách 1: Ghi đè (Xóa sạch code cũ trên GitHub và thay bằng code mới)
Nếu bạn đã có một Repository cũ trên GitHub và muốn **xóa toàn bộ code cũ để thay thế bằng bản mới này**, mở Terminal (Command Prompt / Git Bash / VS Code Terminal) tại thư mục dự án và thực hiện:

```bash
# 1. Đảm bảo toàn bộ code mới đã được đưa vào Git commit
git add .
git commit -m "feat: Replace old code with complete FastFood Web & POS system"

# 2. Đổi tên nhánh mặc định thành main
git branch -M main

# 3. Kết nối tới Repository GitHub của bạn (thay URL bằng repo của bạn)
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/<USERNAME>/<TÊN-REPO>.git

# 4. Ghi đè toàn bộ code mới lên GitHub (Force Push - Xóa sạch code cũ trên repo)
git push -u origin main --force
```

### Cách 2: Tạo một Repository mới hoàn toàn trên GitHub
1. Truy cập [github.com/new](https://github.com/new) và tạo một Repository mới (ví dụ: `fastfood-system`). **Lưu ý: Không tích chọn Initialize with README**.
2. Copy đường dẫn Repo (dạng `https://github.com/username/fastfood-system.git`).
3. Chạy các lệnh sau trong Terminal:
```bash
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/<USERNAME>/fastfood-system.git
git branch -M main
git push -u origin main
```

Sau khi đẩy xong, bất kỳ ai hoặc máy tính nào cũng có thể tải về chạy chỉ với:
```bash
git clone https://github.com/<USERNAME>/<TÊN-REPO>.git
cd <TÊN-REPO>
npm install
npm run dev
```
