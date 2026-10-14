# HƯỚNG DẪN MỞ VÀ CHẠY DỰ ÁN TRÊN VISUAL STUDIO (ASP.NET C#)

Dự án FastFoodExpress đã được chuyển đổi hoàn chỉnh sang chuẩn **ASP.NET Web Application (.NET Framework / C#)** chạy trực tiếp trên **Visual Studio (2019 / 2022)**.

---

## 📁 CẤU TRÚC SOLUTION C# (.SLN)
```text
visual_studio_solution/
├── FastFoodExpress.sln             # File Solution mở trực tiếp bằng Visual Studio
└── FastFoodExpress/
    ├── FastFoodExpress.csproj       # File dự án C# ASP.NET MVC
    ├── Web.config                  # File cấu hình ASP.NET (.NET Framework 4.8)
    ├── Global.asax                 # Khởi tạo ứng dụng ASP.NET
    ├── Global.asax.cs
    ├── App_Start/
    │   └── RouteConfig.cs          # Cấu hình Route URL mặc định (Shop/Index)
    ├── Controllers/
    │   ├── ShopController.cs       # Controller Đặt món & Tra cứu khách hàng C#
    │   ├── PosController.cs        # Controller Thu ngân POS & Mở két C#
    │   ├── AccountController.cs    # Controller Đăng nhập & Đăng ký C#
    │   └── AdminController.cs      # Controller Quản trị hệ thống C#
    ├── Models/
    │   ├── Product.cs              # Model Món ăn C#
    │   ├── Category.cs             # Model Danh mục C#
    │   ├── Customer.cs             # Model Khách hàng & Tích điểm C#
    │   ├── Shift.cs                # Model Ca làm việc & Mở két C#
    │   ├── Order.cs                # Model Hóa đơn C#
    │   ├── User.cs                 # Model Tài khoản C#
    │   └── DatabaseContext.cs      # Repository dữ liệu mẫu C#
    └── Views/
        ├── Shop/Index.cshtml       # Giao diện Razor cửa hàng online
        ├── Pos/Index.cshtml        # Giao diện Razor quầy POS
        ├── Account/Login.cshtml    # Giao diện Razor Đăng nhập
        └── Shared/_Layout.cshtml   # Layout Razor chung
```

---

## 🚀 HƯỚNG DẪN CHẠY BẰNG VISUAL STUDIO (F5)

1. **Mở Visual Studio**:
   - Khởi động Visual Studio (phiên bản 2019, 2022).
   - Chọn **Open a project or solution**.
   - Trỏ tới thư mục `visual_studio_solution/` và chọn file **`FastFoodExpress.sln`**.

2. **Khôi phục thư viện (NuGet Restore)**:
   - Nhấp chuột phải vào Solution `FastFoodExpress` -> Chọn **Restore NuGet Packages**.

3. **Chạy ứng dụng (Press F5)**:
   - Nhấn phím **F5** (hoặc nút **IIS Express** trên thanh công cụ).
   - Visual Studio sẽ tự động biên dịch C# và khởi chạy trình duyệt trên cổng localhost của IIS Express.

---

## 🎯 CÁC TÍNH NĂNG ĐÃ ĐƯỢC CHUYỂN ĐỔI CHUẨN C# ASP.NET:
1. **Kiểm tra Mở Két Ca Làm Việc (C#)**:
   - Logic kiểm tra `SaveStartingCash` trong `PosController.cs` bắt buộc số tiền mở két trùng khớp 100% với số tiền ca trước bàn giao (`ExpectedPreviousCash`).
2. **Menu Chức Năng & Slide Bar Món Ăn (Razor & C#)**:
   - Render danh mục và slider marquee tự động qua Razor `ViewBag.Products` và C# LINQ.
3. **Thanh toán & Tích điểm thành viên (C#)**:
   - Xử lý khấu trừ điểm và tính điểm thưởng tự động trong `ShopController.cs` và `PosController.cs`.
