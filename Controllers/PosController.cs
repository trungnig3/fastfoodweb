using Microsoft.AspNetCore.Mvc;
using FastFoodWeb.Data;
using FastFoodWeb.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using FastFoodWeb.Services;
using System.Linq;
using System.Collections.Generic;
using System;

namespace FastFoodWeb.Controllers
{
    [Authorize(Roles = "Cashier,Admin")]
    public class CheckoutRequest
    {
        public List<CartItemRequest> Items { get; set; }
        public int? CustomerId { get; set; } 
        public string PaymentMethod { get; set; } 
        public string CustomerPhone { get; set; } 
        public bool UsePoints { get; set; } // Thêm cờ xác nhận sử dụng điểm tích lũy
    }

    public class CartItemRequest
    {
        public int Id { get; set; }
        public int Quantity { get; set; }
    }

    public class PosController : Controller
    {
        private readonly ApplicationDbContext _context;
        private readonly IConfiguration _configuration;

        public PosController(ApplicationDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        public IActionResult Index()
        {
            string currentUsername = User.Identity?.Name ?? "";
            var currentUser = _context.Users.FirstOrDefault(u => u.Username == currentUsername);
            ViewBag.CashierName = currentUser != null ? currentUser.FullName : "Admin";

            if (currentUser != null)
            {
                var activeShift = _context.Shifts
                    .OrderByDescending(s => s.StartTime)
                    .FirstOrDefault(s => s.UserId == currentUser.UserId && s.EndTime == null);

                if (activeShift == null)
                {
                    activeShift = new Shift
                    {
                        UserId = currentUser.UserId,
                        StartTime = DateTime.Now,
                        StartingCash = 0 
                    };
                    _context.Shifts.Add(activeShift);
                    _context.SaveChanges();
                }

                ViewBag.ShowStartCashModal = (activeShift.StartingCash == 0);
            }

            var catCombo = _context.Categories.FirstOrDefault(c => c.CategoryName == "Combo Tiết Kiệm");
            if (catCombo == null)
            {
                var catSingle = new Category { CategoryName = "Đồ ăn nhanh" };
                catCombo = new Category { CategoryName = "Combo Tiết Kiệm" };
                
                _context.Categories.AddRange(catSingle, catCombo);
                _context.SaveChanges();

                var fakeProducts = new List<Product>
                {
                    new Product { ProductName = "Gà Rán Giòn Cay", Price = 45000, CategoryId = catSingle.CategoryId, IsCombo = false, IsActive = true },
                    new Product { ProductName = "Burger Bò Phô Mai", Price = 55000, CategoryId = catSingle.CategoryId, IsCombo = false, IsActive = true },
                    new Product { ProductName = "Khoai Tây Chiên (L)", Price = 30000, CategoryId = catSingle.CategoryId, IsCombo = false, IsActive = true },
                    new Product { ProductName = "Nước Ngọt Pepsi", Price = 15000, CategoryId = catSingle.CategoryId, IsCombo = false, IsActive = true },
                    
                    new Product { ProductName = "Combo 1: Gà Rán + Khoai + Pepsi", Price = 80000, CategoryId = catCombo.CategoryId, IsCombo = true, IsActive = true },
                    new Product { ProductName = "Combo 2: Burger Bò + Khoai + Pepsi", Price = 90000, CategoryId = catCombo.CategoryId, IsCombo = true, IsActive = true },
                    new Product { ProductName = "Combo Gia Đình (2 Gà + 2 Burger + 2 Pepsi)", Price = 180000, CategoryId = catCombo.CategoryId, IsCombo = true, IsActive = true }
                };
                _context.Products.AddRange(fakeProducts);
                _context.SaveChanges();
            }

            ViewBag.Categories = _context.Categories.ToList();
            var products = _context.Products.Include(p => p.Category).Where(p => p.IsActive == true).ToList();
            return View(products);
        }

        [HttpPost]
        public IActionResult SaveStartingCash(decimal startingCash)
        {
            string currentUsername = User.Identity?.Name ?? "";
            var currentUser = _context.Users.FirstOrDefault(u => u.Username == currentUsername);
            if (currentUser != null)
            {
                var activeShift = _context.Shifts
                    .OrderByDescending(s => s.StartTime)
                    .FirstOrDefault(s => s.UserId == currentUser.UserId && s.EndTime == null);

                if (activeShift != null)
                {
                    activeShift.StartingCash = startingCash;
                    _context.SaveChanges();
                    return Json(new { success = true });
                }
            }
            return Json(new { success = false, message = "Không tìm thấy ca làm việc hợp lệ!" });
        }

        [HttpPost]
        public IActionResult CloseShift(decimal actualCash)
        {
            string currentUsername = User.Identity?.Name ?? "";
            var user = _context.Users.FirstOrDefault(u => u.Username == currentUsername);
            if (user == null) return Json(new { success = false, message = "Lỗi xác thực" });

            var activeShift = _context.Shifts
                .OrderByDescending(s => s.StartTime)
                .FirstOrDefault(s => s.UserId == user.UserId && s.EndTime == null);
                
            if (activeShift != null)
            {
                var shiftOrders = _context.Orders
                    .Where(o => o.CashierId == user.UserId && o.OrderDate >= activeShift.StartTime && o.PaymentMethod == "Tiền mặt")
                    .ToList();
                
                decimal cashRevenue = shiftOrders.Sum(o => o.TotalAmount);
                decimal expectedCash = activeShift.StartingCash + cashRevenue;

                // Lưu đối soát tiền
                activeShift.ActualCash = actualCash;
                activeShift.CashDifference = actualCash - expectedCash;
                activeShift.EndTime = DateTime.Now;

                // Chốt giờ và tính lương cơ bản + tăng ca
                double totalHours = (activeShift.EndTime.Value - activeShift.StartTime).TotalHours;
                activeShift.TotalHours = totalHours;
                double standardHours = totalHours > 8 ? 8 : totalHours;
                activeShift.OvertimeHours = totalHours > 8 ? totalHours - 8 : 0;
                activeShift.OvertimeBonus = (decimal)activeShift.OvertimeHours * user.HourlyRate * 1.5m;
                
                decimal calculatedSalary = ((decimal)standardHours * user.HourlyRate) + activeShift.OvertimeBonus;

                // 🌟 TÍNH NĂNG MỚI: Nếu đếm thiếu tiền trong két (CashDifference < 0), tự động trừ vào tiền lương
                if (activeShift.CashDifference < 0)
                {
                    calculatedSalary += activeShift.CashDifference; // Do CashDifference là số âm nên cộng vào sẽ trừ đi số tiền thiếu
                    if (calculatedSalary < 0) calculatedSalary = 0; // Không để lương âm
                }

                activeShift.TotalSalary = calculatedSalary;
                
                _context.SaveChanges();
                return Json(new { success = true });
            }
            return Json(new { success = false, message = "Không tìm thấy ca làm việc đang mở!" });
        }

        [HttpGet]
        public IActionResult EndShiftReport()
        {
            string currentUsername = User.Identity?.Name ?? "";
            var user = _context.Users.FirstOrDefault(u => u.Username == currentUsername);
            
            if (user == null) return RedirectToAction("Login", "Account");

            var shift = _context.Shifts
                .OrderByDescending(s => s.StartTime)
                .FirstOrDefault(s => s.UserId == user.UserId);

            if (shift == null) return RedirectToAction("Index");

            var shiftOrders = _context.Orders
                .Include(o => o.OrderDetails).ThenInclude(od => od.Product)
                .Where(o => o.CashierId == user.UserId && o.OrderDate >= shift.StartTime && o.OrderDate <= (shift.EndTime ?? DateTime.Now))
                .ToList();

            ViewBag.StartingCash = shift.StartingCash;
            ViewBag.CashRevenue = shiftOrders.Where(o => o.PaymentMethod == "Tiền mặt").Sum(o => o.TotalAmount);
            ViewBag.TransferRevenue = shiftOrders.Where(o => o.PaymentMethod.Contains("VNPAY")).Sum(o => o.TotalAmount);
            ViewBag.ExpectedCashInDrawer = shift.StartingCash + ViewBag.CashRevenue;
            
            ViewBag.ActualCash = shift.ActualCash;
            ViewBag.CashDifference = shift.CashDifference;

            var itemsSold = shiftOrders.SelectMany(o => o.OrderDetails)
                .GroupBy(od => od.Product != null ? od.Product.ProductName : "Món đã xóa")
                .Select(g => new { ProductName = g.Key, Quantity = g.Sum(od => od.Quantity) })
                .ToList();

            ViewBag.ItemsSold = itemsSold;
            ViewBag.StartTime = shift.StartTime;
            ViewBag.EndTime = shift.EndTime ?? DateTime.Now;

            return View();
        }

        [HttpPost]
        public IActionResult Checkout([FromBody] CheckoutRequest request)
        {
            if (request.Items == null || !request.Items.Any())
                return Json(new { success = false, message = "Giỏ hàng đang trống!" });

            foreach (var item in request.Items)
            {
                var checkProduct = _context.Products.Find(item.Id);
                if (checkProduct != null)
                {
                    if (!checkProduct.IsActive)
                        return Json(new { success = false, message = $"❌ Lỗi: Món '{checkProduct.ProductName}' hiện đang NGỪNG BÁN." });

                    if (item.Quantity > checkProduct.StockQuantity)
                        return Json(new { success = false, message = $"❌ Lỗi: Món '{checkProduct.ProductName}' chỉ còn {checkProduct.StockQuantity} phần trong kho." });
                }
            }

            decimal totalAmount = 0;
            foreach (var item in request.Items)
            {
                var product = _context.Products.Find(item.Id);
                if (product != null) totalAmount += (product.Price * item.Quantity);
            }

            // Tìm thông tin khách hàng tích điểm trước tiên
            Customer targetCustomer = null;
            if (request.CustomerId.HasValue) targetCustomer = _context.Customers.Find(request.CustomerId.Value);
            else if (!string.IsNullOrEmpty(request.CustomerPhone))
            {
                targetCustomer = _context.Customers.FirstOrDefault(c => c.Phone == request.CustomerPhone);
                if (targetCustomer == null)
                {
                    targetCustomer = new Customer { Phone = request.CustomerPhone, FullName = "Khách hàng (" + request.CustomerPhone + ")", TotalPoints = 0, MembershipTier = "Đồng" };
                    _context.Customers.Add(targetCustomer);
                    _context.SaveChanges();
                }
            }

            // 🌟 TÍNH NĂNG MỚI: Xử lý sử dụng điểm tích lũy thanh toán (1 điểm = 1.000đ)
            int pointsUsed = 0;
            decimal discountAmount = 0;
            if (request.UsePoints && targetCustomer != null && targetCustomer.TotalPoints > 0)
            {
                pointsUsed = targetCustomer.TotalPoints;
                discountAmount = pointsUsed * 1000m; // Quy đổi: 1 điểm = 1.000đ

                if (discountAmount > totalAmount)
                {
                    decimal excessDiscount = discountAmount - totalAmount;
                    int excessPoints = (int)(excessDiscount / 1000m);
                    pointsUsed -= excessPoints;
                    discountAmount = totalAmount;
                }

                targetCustomer.TotalPoints -= pointsUsed;
                totalAmount -= discountAmount; // Giảm trừ trực tiếp vào tổng tiền thanh toán

                _context.PointHistories.Add(new PointHistory { 
                    CustomerId = targetCustomer.CustomerId, 
                    Points = -pointsUsed, 
                    Description = $"Sử dụng {pointsUsed} điểm thanh toán hóa đơn" 
                });
            }

            string orderCode = "HD" + DateTime.Now.ToString("yyMMddHHmmss");
            string currentUsername = User.Identity?.Name ?? "";
            var cashier = _context.Users.FirstOrDefault(u => u.Username == currentUsername);
            
            if (cashier == null)
            {
                var role = _context.Roles.FirstOrDefault(r => r.RoleName == "Cashier") ?? new Role { RoleName = "Cashier" };
                if (role.RoleId == 0) { _context.Roles.Add(role); _context.SaveChanges(); }

                cashier = new User { Username = "thungan_auto", PasswordHash = "123", FullName = "Thu Ngân Mặc Định", RoleId = role.RoleId, IsActive = true };
                _context.Users.Add(cashier);
                _context.SaveChanges();
            }

            var order = new Order
            {
                OrderCode = orderCode,
                CashierId = cashier.UserId,
                OrderDate = DateTime.Now,
                OrderStatus = request.PaymentMethod == "VnPay" ? "Pending" : "Hoàn tất",
                PaymentMethod = request.PaymentMethod == "VnPay" ? "VNPAY QR" : "Tiền mặt",
                SubTotal = totalAmount + discountAmount,
                TotalAmount = totalAmount
            };

            var orderDetailsList = new List<OrderDetail>();
            foreach (var item in request.Items)
            {
                var product = _context.Products.Find(item.Id);
                if (product != null)
                {
                    orderDetailsList.Add(new OrderDetail { ProductId = product.ProductId, Quantity = item.Quantity, UnitPrice = product.Price });
                    product.StockQuantity -= item.Quantity;
                    if (product.StockQuantity < 0) product.StockQuantity = 0; 
                }
            }
            order.OrderDetails = orderDetailsList;
            _context.Orders.Add(order);

            // Tích điểm mới cho hóa đơn sau khi thanh toán
            int pointsEarned = 0;
            if (targetCustomer != null)
            {
                order.CustomerId = targetCustomer.CustomerId;
                pointsEarned = (int)(totalAmount / 10000); // 10.000đ = 1 điểm
                targetCustomer.TotalPoints += pointsEarned;
                _context.PointHistories.Add(new PointHistory { 
                    CustomerId = targetCustomer.CustomerId, 
                    Points = pointsEarned, 
                    Description = $"Cộng điểm mua hàng từ hóa đơn {order.OrderCode}" 
                });
            }
            
            _context.SaveChanges();

            if (request.PaymentMethod == "VnPay")
            {
                var vnpayConfig = _configuration.GetSection("VnPay");
                var pay = new VnPayLibrary();

                pay.AddRequestData("vnp_Version", "2.1.0");
                pay.AddRequestData("vnp_Command", "pay");
                pay.AddRequestData("vnp_TmnCode", vnpayConfig["TmnCode"]);
                pay.AddRequestData("vnp_Amount", ((long)(totalAmount * 100)).ToString());
                pay.AddRequestData("vnp_CreateDate", DateTime.Now.ToString("yyyyMMddHHmmss"));
                pay.AddRequestData("vnp_CurrCode", "VND");
                pay.AddRequestData("vnp_IpAddr", HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1");
                pay.AddRequestData("vnp_Locale", "vn");
                pay.AddRequestData("vnp_OrderInfo", $"Thanh toan don hang {orderCode}");
                pay.AddRequestData("vnp_OrderType", "other");
                pay.AddRequestData("vnp_ReturnUrl", "http://localhost:5173/Pos/PaymentCallback");
                pay.AddRequestData("vnp_TxnRef", orderCode);

                var paymentUrl = pay.CreateRequestUrl(vnpayConfig["BaseUrl"], vnpayConfig["HashSecret"]);
                return Json(new { success = true, isRedirect = true, redirectUrl = paymentUrl });
            }

            return Json(new { success = true, isRedirect = false, message = "Thanh toán thành công!", orderCode = order.OrderCode, points = pointsEarned });
        }

        [HttpGet]
        public IActionResult PaymentCallback()
        {
            var vnpayData = HttpContext.Request.Query;
            var pay = new VnPayLibrary();

            foreach (var (key, value) in vnpayData)
            {
                if (!string.IsNullOrEmpty(key) && key.StartsWith("vnp_"))
                {
                    pay.AddResponseData(key, value);
                }
            }

            string orderCode = pay.GetResponseDataValue("vnp_TxnRef");
            string vnp_ResponseCode = pay.GetResponseDataValue("vnp_ResponseCode");
            string vnp_HashSecret = _configuration["VnPay:HashSecret"];

            bool checkSignature = pay.ValidateSignature(pay.GetResponseDataValue("vnp_SecureHash"), vnp_HashSecret);

            if (checkSignature && vnp_ResponseCode == "00")
            {
                var order = _context.Orders.FirstOrDefault(o => o.OrderCode == orderCode);
                if (order != null)
                {
                    order.OrderStatus = "Hoàn tất";
                    _context.SaveChanges();
                }
                
                ViewBag.Message = $"Thanh toán VNPAY thành công cho mã đơn hàng: {orderCode}";
            }
            else
            {
                var order = _context.Orders.Include(o => o.OrderDetails).FirstOrDefault(o => o.OrderCode == orderCode);
                if (order != null && order.OrderStatus == "Pending")
                {
                    order.OrderStatus = "Đã hủy";
                    foreach(var detail in order.OrderDetails)
                    {
                        var product = _context.Products.Find(detail.ProductId);
                        if (product != null) product.StockQuantity += detail.Quantity;
                    }
                    _context.SaveChanges();
                }

                ViewBag.Message = "Giao dịch VNPAY không thành công hoặc khách hàng đã hủy giao dịch!";
            }

            return View();
        }

        [HttpGet]
        public IActionResult FindCustomer(string phone)
        {
            var customer = _context.Customers.FirstOrDefault(c => c.Phone == phone);
            if (customer == null) return Json(new { found = false, message = "Chưa đăng ký thành viên" });
            
            return Json(new { found = true, id = customer.CustomerId, name = customer.FullName, points = customer.TotalPoints, tier = customer.MembershipTier });
        }
        [HttpGet]
public IActionResult GetOrderHistory(string searchCode, string paymentMethod)
{
    try
    {
        string currentUsername = User.Identity?.Name ?? "";
        var user = _context.Users.FirstOrDefault(u => u.Username == currentUsername);
        if (user == null)
        {
            return Json(new { success = false, message = "Chưa đăng nhập." });
        }

        // Tìm ca làm việc đang mở (EndTime == null)
        var activeShift = _context.Shifts
            .Where(s => s.UserId == user.UserId && s.EndTime == null)
            .OrderByDescending(s => s.StartTime)
            .FirstOrDefault();

        if (activeShift == null)
        {
            return Json(new { success = true, orders = new List<object>() });
        }

        // CHỈ LẤY ĐÚNG CÁC HÓA ĐƠN TRONG CA NÀY
        var query = _context.Orders
            .Include(o => o.OrderDetails)
            .ThenInclude(od => od.Product)
            .Where(o => o.CashierId == user.UserId && o.OrderDate >= activeShift.StartTime);

        if (!string.IsNullOrEmpty(searchCode))
        {
            query = query.Where(o => o.OrderCode != null && o.OrderCode.Contains(searchCode));
        }

        if (!string.IsNullOrEmpty(paymentMethod))
        {
            query = query.Where(o => o.PaymentMethod != null && o.PaymentMethod.Contains(paymentMethod));
        }

        var dbOrders = query.OrderByDescending(o => o.OrderDate).ToList();
        var orders = new List<object>();

        foreach (var o in dbOrders)
        {
            var itemList = new List<object>();
            if (o.OrderDetails != null)
            {
                foreach (var od in o.OrderDetails)
                {
                    // Đảm bảo chỉ lấy đúng chi tiết món thuộc hóa đơn o này
                    itemList.Add(new {
                        name = od.Product != null ? od.Product.ProductName : "Món đã xóa",
                        qty = od.Quantity,
                        price = od.UnitPrice
                    });
                }
            }

            orders.Add(new {
                id = o.OrderId,
                orderCode = o.OrderCode ?? $"HD{o.OrderId}",
                date = o.OrderDate,
                address = o.ShippingAddress ?? "Mua tại quầy (POS)",
                payment = o.PaymentMethod ?? "Tiền mặt",
                subTotal = o.SubTotal,
                shippingFee = 0m,
                total = o.TotalAmount,
                status = o.OrderStatus ?? "Hoàn tất",
                cashier = user.FullName ?? "Thu ngân",
                shipper = "",
                items = itemList
            });
        }

        return Json(new { success = true, orders = orders });
    }
    catch (Exception ex)
    {
        return Json(new { success = false, message = ex.Message });
    }
}
    }
}