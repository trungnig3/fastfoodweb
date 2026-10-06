using System;
using System.Collections.Generic;
using System.Linq;

namespace FastFoodWeb.Models
{
    /// <summary>
    /// FastFood Database Access Store (Hỗ trợ cả In-Memory Singleton và Entity Framework DbContext)
    /// </summary>
    public class FastFoodDb
    {
        private static readonly Lazy<FastFoodDb> _instance = new Lazy<FastFoodDb>(() => new FastFoodDb());
        public static FastFoodDb Instance => _instance.Value;

        public List<Role> Roles { get; set; } = new List<Role>();
        public List<User> Users { get; set; } = new List<User>();
        public List<Category> Categories { get; set; } = new List<Category>();
        public List<Product> Products { get; set; } = new List<Product>();
        public List<Customer> Customers { get; set; } = new List<Customer>();
        public List<PointHistory> PointHistories { get; set; } = new List<PointHistory>();
        public List<Shift> Shifts { get; set; } = new List<Shift>();
        public List<Order> Orders { get; set; } = new List<Order>();
        public List<OrderDetail> OrderDetails { get; set; } = new List<OrderDetail>();
        public List<Complaint> Complaints { get; set; } = new List<Complaint>();

        private int _nextProductId = 9;
        private int _nextUserId = 4;
        private int _nextShiftId = 2;
        private int _nextOrderId = 3;
        private int _nextDetailId = 4;
        private int _nextCustomerId = 2;
        private int _nextHistoryId = 2;
        private int _nextComplaintId = 1;

        public FastFoodDb()
        {
            SeedInitialData();
        }

        private void SeedInitialData()
        {
            // Roles
            Roles.Add(new Role { RoleId = 1, RoleName = "Admin" });
            Roles.Add(new Role { RoleId = 2, RoleName = "Cashier" });
            Roles.Add(new Role { RoleId = 3, RoleName = "Customer" });

            // Users
            Users.Add(new User { UserId = 1, Username = "admin", PasswordHash = "123", FullName = "Quản Trị Viên (Admin)", RoleId = 1, HourlyRate = 45000, IsActive = true, PhoneNumber = "0900000001", Email = "admin@fastfoodexpress.vn" });
            Users.Add(new User { UserId = 2, Username = "thungan", PasswordHash = "123", FullName = "Nguyễn Thu Ngân", RoleId = 2, HourlyRate = 25000, IsActive = true, PhoneNumber = "0900000002", Email = "thungan@fastfoodexpress.vn" });
            Users.Add(new User { UserId = 3, Username = "khachhang", PasswordHash = "123", FullName = "Nguyễn Văn Khách", RoleId = 3, HourlyRate = 0, IsActive = true, PhoneNumber = "0987654321", Email = "khachhang@gmail.com" });

            // Categories
            Categories.Add(new Category { CategoryId = 1, CategoryName = "Món Chính & Gà Rán" });
            Categories.Add(new Category { CategoryId = 2, CategoryName = "Combo Siêu Tiết Kiệm" });
            Categories.Add(new Category { CategoryId = 3, CategoryName = "Đồ Uống & Tráng Miệng" });

            // Products
            Products.Add(new Product { ProductId = 1, ProductName = "Gà Rán Giòn Cay (1 Miếng)", Description = "Miếng gà tươi ướp gia vị cay nồng đặc trưng, chiên ngập dầu giòn rụm bên ngoài mọng nước bên trong.", Price = 45000, ImageURL = "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=500", IsCombo = false, IsActive = true, CategoryId = 1, StockQuantity = 50 });
            Products.Add(new Product { ProductId = 2, ProductName = "Burger Bò Phô Mai Nướng", Description = "Bánh burger vỏ mềm rắc mè, nhân thịt bò tươi xay nướng than kèm phô mai cheddar tan chảy và sốt BBQ.", Price = 55000, ImageURL = "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500", IsCombo = false, IsActive = true, CategoryId = 1, StockQuantity = 40 });
            Products.Add(new Product { ProductId = 3, ProductName = "Khoai Tây Chiên Pháp (L)", Description = "Khoai tây vàng giòn kiểu Pháp, rắc muối tiêu biển thơm lừng, dùng kèm tương ớt hoặc sốt mayonnaise.", Price = 30000, ImageURL = "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=500", IsCombo = false, IsActive = true, CategoryId = 1, StockQuantity = 60 });
            Products.Add(new Product { ProductId = 4, ProductName = "Nước Ngọt Pepsi Lạnh", Description = "Nước ngọt có gas Pepsi ướp lạnh sảng khoái, xua tan cảm giác ngấy và tiếp thêm năng lượng.", Price = 15000, ImageURL = "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=500", IsCombo = false, IsActive = true, CategoryId = 3, StockQuantity = 100 });
            Products.Add(new Product { ProductId = 5, ProductName = "Combo 1: Gà Rán + Khoai + Pepsi", Description = "Phần ăn tiết kiệm bao gồm 1 miếng gà rán giòn cay, 1 phần khoai tây chiên cỡ vừa và 1 ly Pepsi mát lạnh.", Price = 80000, ImageURL = "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=500", IsCombo = true, IsActive = true, CategoryId = 2, StockQuantity = 35 });
            Products.Add(new Product { ProductId = 6, ProductName = "Combo 2: Burger Bò + Khoai + Pepsi", Description = "Combo bán chạy nhất: 1 burger bò phô mai béo ngậy, 1 khoai tây chiên vàng giòn và 1 ly Pepsi mát lạnh.", Price = 90000, ImageURL = "https://images.unsplash.com/photo-1561758033-d89a9ad46330?w=500", IsCombo = true, IsActive = true, CategoryId = 2, StockQuantity = 30 });
            Products.Add(new Product { ProductId = 7, ProductName = "Combo Gia Đình (2 Gà + 2 Burger + 2 Pepsi)", Description = "Bữa tiệc no nê cho nhóm và gia đình: 2 miếng gà rán giòn rụm, 2 burger bò phô mai đậm đà và 2 lon Pepsi mát lạnh.", Price = 180000, ImageURL = "https://images.unsplash.com/photo-1550547660-d9450f859349?w=500", IsCombo = true, IsActive = true, CategoryId = 2, StockQuantity = 20 });
            Products.Add(new Product { ProductId = 8, ProductName = "Kem Sundae Dâu Tây Giòn", Description = "Kem tươi vani sánh mịn phủ sốt dâu tây chua ngọt tự nhiên và bánh quế giòn tan (hiện tạm hết hàng trong kho).", Price = 25000, ImageURL = "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=500", IsCombo = false, IsActive = true, CategoryId = 3, StockQuantity = 0 });

            // Customers
            Customers.Add(new Customer { CustomerId = 1, Phone = "0987654321", FullName = "Nguyễn Văn Khách", TotalPoints = 35, MembershipTier = "Bạc" });
            PointHistories.Add(new PointHistory { HistoryId = 1, CustomerId = 1, Points = 35, Description = "Cộng điểm mở tài khoản thành viên", CreatedAt = DateTime.Now.AddDays(-3) });

            // Shift
            Shifts.Add(new Shift { ShiftId = 1, UserId = 2, StartTime = DateTime.Now.AddHours(-4), StartingCash = 500000, ActualCash = 625000, CashDifference = 0, TotalHours = 4, StandardHours = 4, TotalSalary = 4 * 25000 });

            // Orders
            var order1 = new Order
            {
                OrderId = 1,
                OrderCode = "HD" + DateTime.Now.ToString("yyMMdd") + "1001",
                CashierId = 2,
                CustomerId = 1,
                OrderDate = DateTime.Now.AddHours(-3),
                OrderStatus = "Hoàn tất",
                PaymentMethod = "Tiền mặt",
                SubTotal = 125000,
                TotalAmount = 125000,
                ShippingAddress = "Mua tại quầy (POS)"
            };
            Orders.Add(order1);
            OrderDetails.Add(new OrderDetail { DetailId = 1, OrderId = 1, ProductId = 1, Quantity = 1, UnitPrice = 45000, Product = Products[0] });
            OrderDetails.Add(new OrderDetail { DetailId = 2, OrderId = 1, ProductId = 5, Quantity = 1, UnitPrice = 80000, Product = Products[4] });

            var order2 = new Order
            {
                OrderId = 2,
                OrderCode = "ONLINE" + DateTime.Now.ToString("yyMMdd") + "1002",
                CashierId = 1,
                OrderDate = DateTime.Now.AddHours(-1),
                OrderStatus = "Hoàn tất",
                PaymentMethod = "VNPAY QR",
                SubTotal = 90000,
                TotalAmount = 105000,
                ShippingAddress = "123 Cầu Giấy, Hà Nội",
                ShipperName = "Nguyễn Văn Giao",
                ShipperPhone = "0901234567",
                ShippingStatus = "Đang chuẩn bị món"
            };
            Orders.Add(order2);
            OrderDetails.Add(new OrderDetail { DetailId = 3, OrderId = 2, ProductId = 6, Quantity = 1, UnitPrice = 90000, Product = Products[5] });
        }

        public User GetUser(string username) =>
            Users.FirstOrDefault(u => u.Username.Equals(username?.Trim(), StringComparison.OrdinalIgnoreCase) && u.IsActive);

        public User GetUserByEmail(string email)
        {
            if (string.IsNullOrWhiteSpace(email)) return null;
            var clean = email.Trim();
            return Users.FirstOrDefault(u => !string.IsNullOrEmpty(u.Email) && u.Email.Equals(clean, StringComparison.OrdinalIgnoreCase) && u.IsActive);
        }

        public User GetUserByPhone(string phone)
        {
            if (string.IsNullOrWhiteSpace(phone)) return null;
            var clean = phone.Trim().Replace(" ", "").Replace(".", "").Replace("-", "");
            return Users.FirstOrDefault(u => !string.IsNullOrEmpty(u.PhoneNumber) && 
                u.PhoneNumber.Trim().Replace(" ", "").Replace(".", "").Replace("-", "") == clean && u.IsActive);
        }

        public User GetUserByEmailOrPhone(string query)
        {
            if (string.IsNullOrWhiteSpace(query)) return null;
            var clean = query.Trim();
            return GetUserByEmail(clean) ?? GetUserByPhone(clean) ?? GetUser(clean);
        }

        public User GetUserById(int id) => Users.FirstOrDefault(u => u.UserId == id);
        public Role GetRoleById(int id) => Roles.FirstOrDefault(r => r.RoleId == id);

        public User CreateUser(User user)
        {
            user.UserId = _nextUserId++;
            Users.Add(user);
            return user;
        }

        public Product GetProductById(int id) => Products.FirstOrDefault(p => p.ProductId == id);
        public Product CreateProduct(Product p)
        {
            p.ProductId = _nextProductId++;
            Products.Add(p);
            return p;
        }
        public bool UpdateProduct(int id, Product data)
        {
            var p = GetProductById(id);
            if (p == null) return false;
            p.ProductName = data.ProductName;
            p.Price = data.Price;
            p.StockQuantity = data.StockQuantity;
            p.CategoryId = data.CategoryId;
            p.ImageURL = data.ImageURL;
            p.IsCombo = data.IsCombo;
            p.IsActive = data.IsActive;
            p.Description = data.Description;
            return true;
        }
        public bool DeleteProduct(int id)
        {
            var p = GetProductById(id);
            if (p == null) return false;
            return Products.Remove(p);
        }

        public Customer GetCustomerByPhone(string phone) =>
            Customers.FirstOrDefault(c => c.Phone == phone?.Trim());

        public Customer GetCustomerById(int id) =>
            Customers.FirstOrDefault(c => c.CustomerId == id);

        public Customer CreateCustomer(string phone, string fullName)
        {
            var c = new Customer
            {
                CustomerId = _nextCustomerId++,
                Phone = phone?.Trim(),
                FullName = fullName?.Trim(),
                TotalPoints = 0,
                MembershipTier = "Đồng"
            };
            Customers.Add(c);
            return c;
        }

        public PointHistory AddPointHistory(int customerId, int points, string description)
        {
            var h = new PointHistory
            {
                HistoryId = _nextHistoryId++,
                CustomerId = customerId,
                Points = points,
                Description = description,
                CreatedAt = DateTime.Now
            };
            PointHistories.Add(h);
            return h;
        }

        public List<PointHistory> GetPointHistory(int customerId) =>
            PointHistories.Where(h => h.CustomerId == customerId).OrderByDescending(h => h.CreatedAt).ToList();

        public string CalculateMembershipTier(int points)
        {
            if (points >= 300) return "Kim Cương";
            if (points >= 150) return "Vàng";
            if (points >= 50) return "Bạc";
            return "Đồng";
        }

        public Order CreateOrder(Order order)
        {
            order.OrderId = _nextOrderId++;
            Orders.Add(order);
            return order;
        }

        public OrderDetail AddOrderDetail(OrderDetail detail)
        {
            detail.DetailId = _nextDetailId++;
            detail.Product = GetProductById(detail.ProductId);
            OrderDetails.Add(detail);
            return detail;
        }

        public List<OrderDetail> GetOrderDetails(int orderId) =>
            OrderDetails.Where(d => d.OrderId == orderId).ToList();

        public Shift GetActiveShift(int userId) =>
            Shifts.Where(s => s.UserId == userId && s.EndTime == null).OrderByDescending(s => s.StartTime).FirstOrDefault();

        public Shift CreateShift(int userId, decimal startingCash = 0)
        {
            var s = new Shift
            {
                ShiftId = _nextShiftId++,
                UserId = userId,
                StartTime = DateTime.Now,
                StartingCash = startingCash
            };
            Shifts.Add(s);
            return s;
        }

        public Complaint AddComplaint(Complaint c)
        {
            c.ComplaintId = _nextComplaintId++;
            c.CreatedAt = DateTime.Now;
            Complaints.Add(c);
            return c;
        }
    }
}
