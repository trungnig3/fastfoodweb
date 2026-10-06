﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.Web.Mvc;
using FastFoodWeb.Models;
using FastFoodWeb.Services;

namespace FastFoodWeb.Controllers
{
    public class ShopController : Controller
    {
        private readonly FastFoodDb _db = FastFoodDb.Instance;

        // GET: / hoặc /Shop
        public ActionResult Index()
        {
            var currentUser = Session["User"] as User;
            if (currentUser != null)
            {
                var role = _db.GetRoleById(currentUser.RoleId);
                if (role?.RoleName == "Admin") return RedirectToAction("Index", "Admin");
                if (role?.RoleName == "Cashier") return RedirectToAction("Index", "Cashier");
            }

            ViewBag.Categories = _db.Categories;
            ViewBag.OutOfStockItems = _db.Products.Where(p => p.StockQuantity <= 0 || !p.IsActive).ToList();

            // Best sellers calculation
            ViewBag.BestSellers = _db.Products.Where(p => p.IsActive).Take(5).ToList();

            int customerPoints = 0;
            string customerTier = "Đồng";
            string customerPhone = "";

            if (currentUser != null)
            {
                customerPhone = currentUser.PhoneNumber ?? "";
                var cust = !string.IsNullOrEmpty(customerPhone) 
                    ? _db.GetCustomerByPhone(customerPhone) 
                    : _db.Customers.FirstOrDefault(c => c.FullName == currentUser.FullName);

                if (cust != null)
                {
                    customerPoints = cust.TotalPoints;
                    customerTier = cust.MembershipTier ?? _db.CalculateMembershipTier(cust.TotalPoints);
                    if (string.IsNullOrEmpty(customerPhone)) customerPhone = cust.Phone;
                }
            }

            ViewBag.CustomerPoints = customerPoints;
            ViewBag.CustomerTier = customerTier;
            ViewBag.CustomerPhone = customerPhone;

            return View(_db.Products.ToList());
        }

        // GET: /Shop/GetCustomerPoints?phone=...
        [HttpGet]
        public ActionResult GetCustomerPoints(string phone)
        {
            phone = phone?.Trim();
            Customer customer = null;

            if (!string.IsNullOrEmpty(phone))
            {
                customer = _db.GetCustomerByPhone(phone);
            }
            else if (Session["User"] is User currentUser)
            {
                if (!string.IsNullOrEmpty(currentUser.PhoneNumber))
                {
                    customer = _db.GetCustomerByPhone(currentUser.PhoneNumber);
                }
                if (customer == null)
                {
                    customer = _db.Customers.FirstOrDefault(c => c.FullName == currentUser.FullName);
                }
            }

            if (customer == null)
            {
                return Json(new
                {
                    success = false,
                    message = !string.IsNullOrEmpty(phone)
                        ? $"Số điện thoại {phone} chưa có hồ sơ thành viên hoặc chưa có điểm tích lũy."
                        : "Chưa có thông tin điểm thành viên."
                }, JsonRequestBehavior.AllowGet);
            }

            var history = _db.GetPointHistory(customer.CustomerId);
            var tier = customer.MembershipTier ?? _db.CalculateMembershipTier(customer.TotalPoints);

            return Json(new
            {
                success = true,
                customer = new
                {
                    id = customer.CustomerId,
                    name = customer.FullName,
                    phone = customer.Phone,
                    points = customer.TotalPoints,
                    tier = tier,
                    discountValue = customer.TotalPoints * 1000
                },
                history = history.Select(h => new
                {
                    id = h.HistoryId,
                    points = h.Points,
                    description = h.Description,
                    date = h.CreatedAt.ToString("HH:mm:ss dd/MM/yyyy")
                })
            }, JsonRequestBehavior.AllowGet);
        }

        // GET: /Shop/TrackOrder?query=...
        [HttpGet]
        public ActionResult TrackOrder(string query)
        {
            if (string.IsNullOrWhiteSpace(query))
            {
                return Json(new { success = false, message = "Vui lòng nhập mã đơn hàng hoặc số điện thoại!" }, JsonRequestBehavior.AllowGet);
            }

            var q = query.Trim();
            var order = _db.Orders.OrderByDescending(o => o.OrderDate)
                .FirstOrDefault(o => o.OrderCode.Equals(q, StringComparison.OrdinalIgnoreCase) || (o.CustomerPhone != null && o.CustomerPhone.Trim() == q));

            if (order == null)
            {
                return Json(new { success = false, message = $"Không tìm thấy đơn hàng nào khớp với '{q}'." }, JsonRequestBehavior.AllowGet);
            }

            var elapsedSeconds = (DateTime.Now - order.OrderDate).TotalSeconds;
            int step = 1;
            string statusTitle = "Đang chuẩn bị món";
            string statusDesc = "Đầu bếp đang chế biến món ăn nóng hổi theo đơn của bạn.";

            bool isCancelled = order.OrderStatus == "Đã hủy" || order.OrderStatus == "Cancelled" || order.ShippingStatus == "Đã hủy đơn";
            bool isCompleted = order.OrderStatus == "Hoàn tất" || order.OrderStatus == "Completed" || order.OrderStatus == "Đã hoàn thành" || order.ShippingStatus == "Đã giao thành công" || order.ShippingStatus == "Đã giao hàng";
            bool isShippingExplicit = order.ShippingStatus == "Đang giao hàng" || order.OrderStatus == "Đang giao";
            bool isPreparingExplicit = order.ShippingStatus == "Đang chuẩn bị món" || order.OrderStatus == "Đang xử lý";

            if (isCancelled)
            {
                step = 0;
                statusTitle = "Đơn hàng đã hủy";
                statusDesc = "Đơn hàng này đã bị hủy theo yêu cầu hoặc quá hạn thanh toán.";
            }
            else if (isCompleted)
            {
                step = 3;
                statusTitle = "Đã hoàn thành / Giao thành công";
                statusDesc = "Đơn hàng đã được hoàn tất và giao thành công. Chúc bạn ngon miệng!";
            }
            else if (isShippingExplicit)
            {
                step = 2;
                statusTitle = "Đang giao hàng";
                statusDesc = "Shipper đang trên đường giao hàng đến địa chỉ của bạn.";
            }
            else if (isPreparingExplicit)
            {
                step = 1;
                statusTitle = "Đang chuẩn bị món";
                statusDesc = $"Bếp đang chuẩn bị món. Dự kiến chuyển sang giao hàng trong {Math.Max(1, Math.Ceiling((300 - (elapsedSeconds % 300)) / 60))} phút.";
            }
            else
            {
                if (elapsedSeconds < 300)
                {
                    step = 1;
                    statusTitle = "Đang chuẩn bị món";
                    statusDesc = $"Bếp đang chuẩn bị món. Dự kiến chuyển sang giao hàng trong {Math.Max(1, Math.Ceiling((300 - elapsedSeconds) / 60))} phút.";
                    order.ShippingStatus = "Đang chuẩn bị món";
                }
                else if (elapsedSeconds < 900)
                {
                    step = 2;
                    statusTitle = "Đang giao hàng";
                    statusDesc = "Shipper đang trên đường giao hàng đến địa chỉ của bạn.";
                    order.ShippingStatus = "Đang giao hàng";
                }
                else
                {
                    step = 3;
                    statusTitle = "Đã hoàn thành / Giao thành công";
                    statusDesc = "Đơn hàng đã được giao tận nơi. Chúc bạn ngon miệng!";
                    order.ShippingStatus = "Đã giao thành công";
                    order.OrderStatus = "Hoàn tất";
                }
            }

            var details = _db.GetOrderDetails(order.OrderId).Select(d => new
            {
                productName = d.Product?.ProductName ?? "Món ăn",
                quantity = d.Quantity,
                unitPrice = d.UnitPrice,
                lineTotal = d.Quantity * d.UnitPrice
            }).ToList();

            return Json(new
            {
                success = true,
                order = new
                {
                    orderCode = order.OrderCode,
                    orderDate = order.OrderDate.ToString("HH:mm:ss dd/MM/yyyy"),
                    elapsedSeconds = (int)elapsedSeconds,
                    step = step,
                    statusTitle = statusTitle,
                    statusDesc = statusDesc,
                    subTotal = order.SubTotal,
                    discountAmount = order.DiscountAmount,
                    shippingFee = order.ShippingFee,
                    totalAmount = order.TotalAmount,
                    paymentMethod = order.PaymentMethod,
                    shippingAddress = order.ShippingAddress,
                    customerPhone = order.CustomerPhone,
                    shipperName = order.ShipperName ?? "Nguyễn Văn Giao",
                    shipperPhone = order.ShipperPhone ?? "0901234567",
                    items = details
                }
            }, JsonRequestBehavior.AllowGet);
        }

        public class CartItemInput
        {
            public int Id { get; set; }
            public string Name { get; set; }
            public decimal Price { get; set; }
            public int Quantity { get; set; }
        }

        public class CheckoutModel
        {
            public List<CartItemInput> Items { get; set; }
            public string Address { get; set; }
            public string PaymentMethod { get; set; }
            public decimal ShippingFee { get; set; }
            public string CustomerPhone { get; set; }
            public bool UsePoints { get; set; }
            public int PointsToUse { get; set; }
        }

        // POST: /Shop/Checkout
        [HttpPost]
        public ActionResult Checkout(CheckoutModel model)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(model.CustomerPhone))
                {
                    return Json(new { success = false, message = "Số điện thoại nhận hàng là bắt buộc!" });
                }

                if (model.Items == null || !model.Items.Any())
                {
                    return Json(new { success = false, message = "Giỏ hàng trống!" });
                }

                // Kiểm tra tồn kho
                foreach (var item in model.Items)
                {
                    var prod = _db.GetProductById(item.Id);
                    if (prod == null || prod.StockQuantity <= 0 || !prod.IsActive)
                    {
                        return Json(new { success = false, message = $"Món \"{(prod != null ? prod.ProductName : "này")}\" hiện đã hết hàng trong kho!" });
                    }
                    if (prod.StockQuantity < item.Quantity)
                    {
                        return Json(new { success = false, message = $"Món \"{prod.ProductName}\" chỉ còn {prod.StockQuantity} phần trong kho!" });
                    }
                }

                decimal subTotal = model.Items.Sum(i => i.Price * i.Quantity);
                var phoneClean = model.CustomerPhone.Trim();
                var targetCustomer = _db.GetCustomerByPhone(phoneClean) ?? _db.CreateCustomer(phoneClean, $"Khách hàng Online ({phoneClean})");

                int pointsUsed = 0;
                decimal discountAmount = 0;

                // Nếu khách chọn dùng điểm tích lũy
                if (model.UsePoints && targetCustomer != null && targetCustomer.TotalPoints > 0)
                {
                    int maxPointsCanUse = Math.Min(targetCustomer.TotalPoints, (int)(subTotal / 1000));
                    pointsUsed = model.PointsToUse <= 0 ? maxPointsCanUse : Math.Min(model.PointsToUse, maxPointsCanUse);
                    discountAmount = pointsUsed * 1000;

                    targetCustomer.TotalPoints -= pointsUsed;
                    targetCustomer.MembershipTier = _db.CalculateMembershipTier(targetCustomer.TotalPoints);
                    _db.AddPointHistory(targetCustomer.CustomerId, -pointsUsed, $"Sử dụng {pointsUsed} điểm giảm giá đơn online");
                }

                decimal totalAmount = Math.Max(0, subTotal - discountAmount) + model.ShippingFee;
                var now = DateTime.Now;
                var orderCode = "ONLINE" + now.ToString("yyMMdd") + new Random().Next(1000, 9999);

                var shippers = new[]
                {
                    new { Name = "Nguyễn Văn Giao", Phone = "0901234567" },
                    new { Name = "Trần Đình Ship", Phone = "0918889999" },
                    new { Name = "Lê Hoàng Tốc Độ", Phone = "0987654321" }
                };
                var shipper = shippers[new Random().Next(shippers.Length)];

                if (!string.IsNullOrEmpty(model.PaymentMethod) && model.PaymentMethod.ToUpper().Contains("VNPAY"))
                {
                    var pay = new VnPayService();
                    pay.AddRequestData("vnp_Version", "2.1.0");
                    pay.AddRequestData("vnp_Command", "pay");
                    pay.AddRequestData("vnp_TmnCode", VnPayService.TmnCode);
                    pay.AddRequestData("vnp_Amount", ((long)(totalAmount * 100)).ToString());
                    pay.AddRequestData("vnp_CreateDate", now.ToString("yyyyMMddHHmmss"));
                    pay.AddRequestData("vnp_CurrCode", "VND");
                    pay.AddRequestData("vnp_IpAddr", "127.0.0.1");
                    pay.AddRequestData("vnp_Locale", "vn");
                    pay.AddRequestData("vnp_OrderInfo", $"Thanh toan don hang {orderCode}");
                    pay.AddRequestData("vnp_OrderType", "other");

                    var returnUrl = $"{Request.Url.Scheme}://{Request.Url.Authority}/Shop/PaymentCallback";
                    pay.AddRequestData("vnp_ReturnUrl", returnUrl);
                    pay.AddRequestData("vnp_TxnRef", orderCode);

                    var order = _db.CreateOrder(new Order
                    {
                        OrderCode = orderCode,
                        CashierId = 1,
                        CustomerId = targetCustomer.CustomerId,
                        OrderDate = now,
                        OrderStatus = "Pending",
                        PaymentMethod = "VNPAY QR",
                        SubTotal = subTotal,
                        DiscountAmount = discountAmount,
                        ShippingFee = model.ShippingFee,
                        TotalAmount = totalAmount,
                        ShippingAddress = model.Address,
                        CustomerPhone = phoneClean,
                        ShipperName = shipper.Name,
                        ShipperPhone = shipper.Phone,
                        ShippingStatus = "Đang chuẩn bị món"
                    });

                    foreach (var item in model.Items)
                    {
                        var prod = _db.GetProductById(item.Id);
                        if (prod != null)
                        {
                            _db.AddOrderDetail(new OrderDetail { OrderId = order.OrderId, ProductId = prod.ProductId, Quantity = item.Quantity, UnitPrice = prod.Price });
                            prod.StockQuantity = Math.Max(0, prod.StockQuantity - item.Quantity);
                        }
                    }

                    var paymentUrl = pay.CreateRequestUrl(VnPayService.BaseUrl, VnPayService.HashSecret);
                    return Json(new { success = true, isRedirect = true, redirectUrl = paymentUrl, pointsUsed, discountAmount, remainingPoints = targetCustomer.TotalPoints });
                }

                // Tiền mặt COD
                decimal paidFoodAmount = Math.Max(0, subTotal - discountAmount);
                int pointsEarned = (int)(paidFoodAmount / 10000);
                if (pointsEarned > 0)
                {
                    targetCustomer.TotalPoints += pointsEarned;
                    targetCustomer.MembershipTier = _db.CalculateMembershipTier(targetCustomer.TotalPoints);
                    _db.AddPointHistory(targetCustomer.CustomerId, pointsEarned, $"Cộng điểm mua online từ đơn {orderCode}");
                }

                var codOrder = _db.CreateOrder(new Order
                {
                    OrderCode = orderCode,
                    CashierId = 1,
                    CustomerId = targetCustomer.CustomerId,
                    OrderDate = now,
                    OrderStatus = "Pending",
                    PaymentMethod = "Tiền mặt (COD)",
                    SubTotal = subTotal,
                    DiscountAmount = discountAmount,
                    ShippingFee = model.ShippingFee,
                    TotalAmount = totalAmount,
                    ShippingAddress = model.Address,
                    CustomerPhone = phoneClean,
                    ShipperName = shipper.Name,
                    ShipperPhone = shipper.Phone,
                    ShippingStatus = "Đang chuẩn bị món"
                });

                foreach (var item in model.Items)
                {
                    var prod = _db.GetProductById(item.Id);
                    if (prod != null)
                    {
                        _db.AddOrderDetail(new OrderDetail { OrderId = codOrder.OrderId, ProductId = prod.ProductId, Quantity = item.Quantity, UnitPrice = prod.Price });
                        prod.StockQuantity = Math.Max(0, prod.StockQuantity - item.Quantity);
                    }
                }

                return Json(new
                {
                    success = true,
                    isRedirect = false,
                    orderCode = codOrder.OrderCode,
                    driverName = shipper.Name,
                    driverPhone = shipper.Phone,
                    subTotal,
                    discountAmount,
                    pointsUsed,
                    pointsEarned,
                    remainingPoints = targetCustomer.TotalPoints
                });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = ex.Message });
            }
        }

        // GET: /Shop/PaymentCallback
        public ActionResult PaymentCallback()
        {
            var pay = new VnPayService();
            foreach (string key in Request.QueryString.AllKeys)
            {
                if (key != null && key.StartsWith("vnp_"))
                {
                    pay.AddResponseData(key, Request.QueryString[key]);
                }
            }

            var orderCode = pay.GetResponseData("vnp_TxnRef");
            var responseCode = pay.GetResponseData("vnp_ResponseCode");
            var secureHash = Request.QueryString["vnp_SecureHash"];

            bool isValid = pay.ValidateSignature(secureHash, VnPayService.HashSecret);
            bool success = isValid && responseCode == "00";

            var order = _db.Orders.FirstOrDefault(o => o.OrderCode == orderCode);
            string message;

            if (order != null)
            {
                if (success)
                {
                    order.OrderStatus = "Hoàn tất";
                    order.ShippingStatus = "Đang chuẩn bị món";
                    message = $"Thanh toán đơn hàng {orderCode} thành công! Bếp đang chuẩn bị món và shipper sẽ sớm giao đến bạn.";
                }
                else
                {
                    order.OrderStatus = "Đã hủy";
                    order.ShippingStatus = "Đã hủy đơn";
                    var details = _db.GetOrderDetails(order.OrderId);
                    foreach (var d in details)
                    {
                        var prod = _db.GetProductById(d.ProductId);
                        if (prod != null) prod.StockQuantity += d.Quantity;
                    }
                    message = $"Giao dịch VNPay không thành công hoặc đã bị hủy (Mã: {responseCode}). Đơn hàng {orderCode} đã được hủy và hoàn lại kho.";
                }
            }
            else
            {
                message = "Không tìm thấy thông tin đơn hàng!";
            }

            ViewBag.Success = success;
            ViewBag.Message = message;
            return View();
        }

        // POST: /Shop/ChatBot
        [HttpPost]
        public ActionResult ChatBot(string message)
        {
            var baseUrl = $"{Request.Url.Scheme}://{Request.Url.Authority}";
            var reply = AiChatService.ProcessMessage(message, baseUrl);
            return Json(new { reply });
        }

        // POST: /Shop/SendComplaint
        [HttpPost]
        public async Task<ActionResult> SendComplaint(string customerName, string phone, string content)
        {
            try
            {
                _db.AddComplaint(new Complaint
                {
                    CustomerName = customerName ?? "Khách vãng lai",
                    Phone = phone ?? "Chưa cung cấp",
                    Content = content ?? ""
                });

                // Gửi email về Gmail admin
                await EmailService.SendComplaintEmailAsync(customerName, phone, content);

                return Json(new { success = true, message = "Đã gửi khiếu nại thành công! Chủ quán sẽ liên hệ lại với bạn sớm nhất." });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = "Lỗi khi gửi: " + ex.Message });
            }
        }
    }
}
