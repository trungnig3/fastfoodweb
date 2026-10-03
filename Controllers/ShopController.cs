using Microsoft.AspNetCore.Mvc;
using FastFoodWeb.Data;
using FastFoodWeb.Models;
using Microsoft.EntityFrameworkCore;
using FastFoodWeb.Services;
using System.Net.Mail;
using System.Net;
using System;
using System.Linq;
using System.Collections.Generic;
using Microsoft.Extensions.Configuration;

namespace FastFoodWeb.Controllers
{
    public class ShopController : Controller
    {
        private readonly ApplicationDbContext _context;
        private readonly IConfiguration _configuration;

        public ShopController(ApplicationDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        // 1. Giao diện trang chủ khách hàng đặt món
        public IActionResult Index()
        {
            ViewBag.Categories = _context.Categories.ToList();
            var products = _context.Products.Include(p => p.Category).ToList();
            return View(products);
        }

        // 2. Xử lý đặt hàng giao tận nơi (Form Checkout) - Bổ sung tích điểm số điện thoại
        [HttpPost]
        public IActionResult Checkout([FromBody] OnlineCheckoutRequest request)
        {
            try
            {
                if (request.Items == null || !request.Items.Any())
                    return Json(new { success = false, message = "Giỏ hàng trống!" });

                decimal subTotal = 0;
                foreach (var item in request.Items)
                {
                    var product = _context.Products.Find(item.Id);
                    if (product != null) subTotal += product.Price * item.Quantity;
                }
                decimal totalAmount = subTotal + request.ShippingFee;
                string orderCode = "ONLINE" + DateTime.Now.ToString("yyMMddHHmmss");

                var cashier = _context.Users.FirstOrDefault();
                if (cashier == null)
                {
                    var role = _context.Roles.FirstOrDefault(r => r.RoleName == "Admin") ?? new Role { RoleName = "Admin" };
                    if (_context.Roles.Find(role.RoleId) == null) { _context.Roles.Add(role); _context.SaveChanges(); }
                    cashier = new User { Username = "system", PasswordHash = "123", FullName = "Hệ Thống", RoleId = role.RoleId, IsActive = true };
                    _context.Users.Add(cashier); _context.SaveChanges();
                }

                var shippers = new[] {
                    (Name: "Nguyễn Văn Giao", Phone: "0901234567"),
                    (Name: "Trần Đình Ship", Phone: "0918889999"),
                    (Name: "Lê Hoàng Tốc Độ", Phone: "0987654321")
                };
                var randomShipper = shippers[new Random().Next(shippers.Length)];

                if (!string.IsNullOrEmpty(request.PaymentMethod) && request.PaymentMethod.Equals("VNPAY", StringComparison.OrdinalIgnoreCase))
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
                    pay.AddRequestData("vnp_ReturnUrl", "http://localhost:5173/Shop/PaymentCallback");
                    pay.AddRequestData("vnp_TxnRef", orderCode);

                    var paymentUrl = pay.CreateRequestUrl(vnpayConfig["BaseUrl"], vnpayConfig["HashSecret"]);
                    return Json(new { success = true, isRedirect = true, redirectUrl = paymentUrl });
                }

                var order = new Order
                {
                    OrderCode = orderCode, CashierId = cashier.UserId, OrderDate = DateTime.Now,
                    OrderStatus = "Pending", PaymentMethod = "Tiền mặt (COD)",
                    SubTotal = subTotal, TotalAmount = totalAmount, ShippingAddress = request.Address, 
                    ShipperName = randomShipper.Name, ShipperPhone = randomShipper.Phone, ShippingStatus = "Đang chuẩn bị món",
                    OrderDetails = request.Items.Select(i => new OrderDetail { ProductId = i.Id, Quantity = i.Quantity, UnitPrice = _context.Products.Find(i.Id)?.Price ?? 0 }).ToList()
                };

                // 🌟 TÍNH NĂNG MỚI: Tích điểm tự động cho khách đặt hàng online khi có SĐT
                if (!string.IsNullOrEmpty(request.CustomerPhone))
                {
                    var targetCustomer = _context.Customers.FirstOrDefault(c => c.Phone == request.CustomerPhone);
                    if (targetCustomer == null)
                    {
                        targetCustomer = new Customer { Phone = request.CustomerPhone, FullName = "Khách hàng Online (" + request.CustomerPhone + ")", TotalPoints = 0, MembershipTier = "Đồng" };
                        _context.Customers.Add(targetCustomer);
                        _context.SaveChanges();
                    }

                    order.CustomerId = targetCustomer.CustomerId;
                    int pointsEarned = (int)(totalAmount / 10000); // 10.000đ = 1 điểm
                    targetCustomer.TotalPoints += pointsEarned;

                    _context.PointHistories.Add(new PointHistory { 
                        CustomerId = targetCustomer.CustomerId, 
                        Points = pointsEarned, 
                        Description = $"Cộng điểm mua online từ hóa đơn {orderCode}" 
                    });
                }

                _context.Orders.Add(order);

                foreach (var item in request.Items)
                {
                    var productInDb = _context.Products.Find(item.Id);
                    if (productInDb != null) { productInDb.StockQuantity -= item.Quantity; if (productInDb.StockQuantity < 0) productInDb.StockQuantity = 0; }
                }
                _context.SaveChanges();

                return Json(new { success = true, isRedirect = false, orderCode = order.OrderCode, driverName = randomShipper.Name, driverPhone = randomShipper.Phone });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = ex.Message });
            }
        }

        // 3. Callback VNPAY
        [HttpGet]
        public IActionResult PaymentCallback()
        {
            var vnpayData = HttpContext.Request.Query;
            var pay = new VnPayLibrary();

            foreach (var (key, value) in vnpayData) { if (!string.IsNullOrEmpty(key) && key.StartsWith("vnp_")) pay.AddResponseData(key, value); }

            string orderCode = pay.GetResponseDataValue("vnp_TxnRef");
            string vnp_ResponseCode = pay.GetResponseDataValue("vnp_ResponseCode");
            string vnp_HashSecret = _configuration["VnPay:HashSecret"];

            bool checkSignature = pay.ValidateSignature(pay.GetResponseDataValue("vnp_SecureHash"), vnp_HashSecret);

            if (checkSignature && vnp_ResponseCode == "00") ViewBag.Message = $"Thanh toán đơn hàng {orderCode} thành công! Shipper đang chuẩn bị giao đến bạn.";
            else ViewBag.Message = "Giao dịch thanh toán không thành công hoặc bị hủy!";

            return View();
        }

        // 4. API Chatbot thông minh
        [HttpPost]
        public IActionResult ChatBot([FromBody] ChatRequest req)
        {
            string msg = req.Message?.ToLower().Trim() ?? "";
            string reply = "";

            if (msg.Contains("menu") || msg.Contains("thực đơn") || msg.Contains("món gì") || msg.Contains("có gì"))
            {
                var products = _context.Products.ToList();
                if (!products.Any()) reply = "Hiện tại cửa hàng chưa có món ăn nào trong thực đơn.";
                else
                {
                    reply = "📜 **DANH SÁCH THỰC ĐƠN CỦA QUÁN:**\n";
                    foreach (var p in products)
                    {
                        string typeLabel = p.IsCombo ? "🔥 [Combo]" : "🍔 [Món lẻ]";
                        reply += $"- {p.ProductName} ({typeLabel}): **{p.Price:N0} đ**\n";
                    }
                    reply += "\n💡 *Nhắn tên món + địa chỉ + cách thanh toán (Ví dụ: 'Ship combo 2 về Cầu Giấy qua VNPAY').*";
                }
            }
            else
            {
                var allProducts = _context.Products.ToList();
                var orderedItems = new List<(Product Product, int Quantity)>();

                foreach (var prod in allProducts)
                {
                    string pName = prod.ProductName.ToLower();
                    bool matched = false;

                    if (pName.Contains("combo 1") && msg.Contains("combo 1")) matched = true;
                    else if (pName.Contains("combo 2") && msg.Contains("combo 2")) matched = true;
                    else if (pName.Contains("gia đình") && (msg.Contains("gia đình") || msg.Contains("combo gia đình"))) matched = true;
                    else if (pName.Contains("gà rán") && (msg.Contains("gà") || msg.Contains("gà rán"))) matched = true;
                    else if (pName.Contains("burger") && msg.Contains("burger")) matched = true;
                    else if (pName.Contains("khoai tây") && (msg.Contains("khoai") || msg.Contains("khoai tây"))) matched = true;
                    else if (pName.Contains("pepsi") && (msg.Contains("pepsi") || msg.Contains("nước"))) matched = true;
                    else if (msg.Contains(pName)) matched = true;

                    if (matched && !orderedItems.Any(x => x.Product.ProductId == prod.ProductId))
                    {
                        orderedItems.Add((prod, 1));
                    }
                }

                if (orderedItems.Any())
                {
                    string address = "Chưa rõ (Shipper sẽ gọi xác nhận)";
                    string[] addressKeywords = { "giao về", "ship về", "giao đến", "ship đến", "tới", "về", "đến", "tại", "ở" };
                    
                    foreach (var kw in addressKeywords)
                    {
                        int idx = msg.IndexOf(kw);
                        if (idx >= 0)
                        {
                            address = req.Message.Substring(idx + kw.Length).Trim();
                            break;
                        }
                    }

                    bool isVnPay = msg.Contains("vnpay") || msg.Contains("chuyển khoản") || msg.Contains("ck") || msg.Contains("online") || msg.Contains("quẹt thẻ");
                    string paymentStr = isVnPay ? "Chuyển khoản VNPAY (AI Bot)" : "Tiền mặt khi nhận hàng (AI Bot)";

                    decimal totalAmount = orderedItems.Sum(x => x.Product.Price * x.Quantity);
                    decimal shippingFee = 15000; 
                    decimal finalAmount = totalAmount + shippingFee;

                    string orderCode = "BOT" + DateTime.Now.ToString("yyMMddHHmmss");

                    var shippers = new[] {
                        (Name: "Nguyễn Văn Giao", Phone: "0901234567"),
                        (Name: "Trần Đình Ship", Phone: "0918889999"),
                        (Name: "Lê Hoàng Tốc Độ", Phone: "0987654321")
                    };
                    var randomShipper = shippers[new Random().Next(shippers.Length)];

                    var cashier = _context.Users.FirstOrDefault();
                    if (cashier == null)
                    {
                        var role = _context.Roles.FirstOrDefault(r => r.RoleName == "Admin") ?? new Role { RoleName = "Admin" };
                        if (_context.Roles.Find(role.RoleId) == null) { _context.Roles.Add(role); _context.SaveChanges(); }
                        cashier = new User { Username = "bot_system", PasswordHash = "123", FullName = "AI Chatbot System", RoleId = role.RoleId, IsActive = true };
                        _context.Users.Add(cashier); _context.SaveChanges();
                    }

                    var order = new Order
                    {
                        OrderCode = orderCode, CashierId = cashier.UserId, OrderDate = DateTime.Now,
                        OrderStatus = "Pending", PaymentMethod = paymentStr,
                        SubTotal = totalAmount, TotalAmount = finalAmount, 
                        ShippingAddress = address, ShipperName = randomShipper.Name, ShipperPhone = randomShipper.Phone, ShippingStatus = "Đang chuẩn bị món",
                        OrderDetails = orderedItems.Select(x => new OrderDetail { ProductId = x.Product.ProductId, Quantity = x.Quantity, UnitPrice = x.Product.Price }).ToList()
                    };

                    _context.Orders.Add(order);

                    foreach (var x in orderedItems)
                    {
                        var prodInDb = _context.Products.Find(x.Product.ProductId);
                        if (prodInDb != null) { prodInDb.StockQuantity -= x.Quantity; if (prodInDb.StockQuantity < 0) prodInDb.StockQuantity = 0; }
                    }
                    _context.SaveChanges();

                    string itemsSummary = string.Join(", ", orderedItems.Select(x => $"{x.Quantity}x {x.Product.ProductName}"));
                    
                    reply = $"🎉 AI đã lên đơn thành công!\n" +
                            $"📦 Món: {itemsSummary}\n" +
                            $"💰 Tổng tiền (gồm 15k Ship): {finalAmount.ToString("N0")} đ\n" +
                            $"📍 Giao đến: {address}\n" +
                            $"💳 Thanh toán: {(isVnPay ? "VNPAY QR" : "Tiền mặt")}\n" +
                            $"🛵 Tài xế: {randomShipper.Name} ({randomShipper.Phone})\n" +
                            $"Mã đơn: {orderCode}";

                    if (isVnPay)
                    {
                        var vnpayConfig = _configuration.GetSection("VnPay");
                        var pay = new VnPayLibrary();
                        pay.AddRequestData("vnp_Version", "2.1.0");
                        pay.AddRequestData("vnp_Command", "pay");
                        pay.AddRequestData("vnp_TmnCode", vnpayConfig["TmnCode"]);
                        pay.AddRequestData("vnp_Amount", ((long)(finalAmount * 100)).ToString());
                        pay.AddRequestData("vnp_CreateDate", DateTime.Now.ToString("yyyyMMddHHmmss"));
                        pay.AddRequestData("vnp_CurrCode", "VND");
                        pay.AddRequestData("vnp_IpAddr", HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1");
                        pay.AddRequestData("vnp_Locale", "vn");
                        pay.AddRequestData("vnp_OrderInfo", $"Thanh toan don hang {orderCode}");
                        pay.AddRequestData("vnp_OrderType", "other");
                        pay.AddRequestData("vnp_ReturnUrl", "http://localhost:5173/Shop/PaymentCallback");
                        pay.AddRequestData("vnp_TxnRef", orderCode);

                        string paymentUrl = pay.CreateRequestUrl(vnpayConfig["BaseUrl"], vnpayConfig["HashSecret"]);
                        
                        reply += $"\n\n<a href='{paymentUrl}' target='_blank' style='display:inline-block; padding:8px 15px; background-color:#FF4757; color:white; text-decoration:none; border-radius:8px; font-weight:bold;'>💳 BẤM VÀO ĐÂY ĐỂ TRẢ TIỀN VNPAY</a>";
                    }
                }
                else
                {
                    if (msg.Contains("gà") || msg.Contains("cay")) reply = "Gà Rán Giòn Cay giá 45.000đ/miếng rất ngon. Nhắn: 'Gà rán về [địa chỉ]' để AI ship ngay nhé!";
                    else if (msg.Contains("burger")) reply = "Burger Bò Phô Mai giá 55.000đ đậm vị. Nhắn 'Burger về [địa chỉ]' để AI chốt đơn!";
                    else if (msg.Contains("combo") || msg.Contains("tiết kiệm")) reply = "Cửa hàng có Combo 1 (80k), Combo 2 (90k) và Combo Gia Đình (180k). Nhắn 'Combo 2 về [địa chỉ] qua Vnpay' để đặt nha!";
                    else reply = "Xin chào! Bạn có thể gõ **'menu'** để xem thực đơn, hoặc nhắn theo cú pháp: **[Tên món] + về [Địa chỉ] + qua [Vnpay/Tiền mặt]** để AI đặt hàng nhé.";
                }
            }

            return Json(new { reply = reply });
        }

        // 5. Gửi khiếu nại qua Mail
        [HttpPost]
        public IActionResult SendComplaint([FromBody] Complaint model)
        {
            try
            {
                _context.Complaints.Add(model);
                _context.SaveChanges();
                return Json(new { success = true, message = "Đã gửi khiếu nại thành công! Chủ quán sẽ liên hệ lại với bạn sớm nhất." });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = "Lỗi khi gửi khiếu nại: " + ex.Message });
            }
        }
    }

    public class OnlineCheckoutRequest
    {
        public List<CartItemRequest> Items { get; set; }
        public string Address { get; set; } 
        public string PaymentMethod { get; set; }
        public decimal ShippingFee { get; set; } 
        public string CustomerPhone { get; set; } // Thêm thuộc tính SĐT để khách mua online tích điểm
    }

    public class ChatRequest
    {
        public string Message { get; set; }
    }
}