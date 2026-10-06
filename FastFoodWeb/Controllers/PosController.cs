using System;
using System.Collections.Generic;
using System.Linq;
using System.Web.Mvc;
using FastFoodWeb.Models;

namespace FastFoodWeb.Controllers
{
    public class PosController : Controller
    {
        private readonly FastFoodDb _db = FastFoodDb.Instance;

        // GET: /Pos
        public ActionResult Index()
        {
            var user = Session["User"] as User;
            if (user == null)
            {
                // Cho phép xem thử POS với tài khoản thu ngân mặc định nếu chưa đăng nhập
                user = _db.GetUser("thungan") ?? _db.Users.First();
                Session["User"] = user;
            }

            var activeShift = _db.GetActiveShift(user.UserId) ?? _db.CreateShift(user.UserId, 0);

            ViewBag.ActiveShift = activeShift;
            ViewBag.Categories = _db.Categories;
            ViewBag.CashierName = user.FullName;

            return View(_db.Products.Where(p => p.IsActive).ToList());
        }

        // GET: /Pos/SearchCustomer?phone=...
        [HttpGet]
        public ActionResult SearchCustomer(string phone)
        {
            var cust = _db.GetCustomerByPhone(phone);
            if (cust == null)
            {
                return Json(new { found = false }, JsonRequestBehavior.AllowGet);
            }

            var tier = cust.MembershipTier ?? _db.CalculateMembershipTier(cust.TotalPoints);
            return Json(new
            {
                found = true,
                customer = new
                {
                    id = cust.CustomerId,
                    name = cust.FullName,
                    phone = cust.Phone,
                    points = cust.TotalPoints,
                    tier = tier
                }
            }, JsonRequestBehavior.AllowGet);
        }

        public class PosOrderItem
        {
            public int Id { get; set; }
            public string Name { get; set; }
            public decimal Price { get; set; }
            public int Quantity { get; set; }
        }

        public class PosOrderInput
        {
            public List<PosOrderItem> Items { get; set; }
            public string PaymentMethod { get; set; }
            public string CustomerPhone { get; set; }
            public bool UsePoints { get; set; }
            public decimal CashGiven { get; set; }
        }

        // POST: /Pos/CreateOrder
        [HttpPost]
        public ActionResult CreateOrder(PosOrderInput model)
        {
            try
            {
                if (model.Items == null || !model.Items.Any())
                {
                    return Json(new { success = false, message = "Giỏ hàng quầy trống!" });
                }

                var user = Session["User"] as User ?? _db.GetUser("thungan") ?? _db.Users.First();
                decimal subTotal = model.Items.Sum(i => i.Price * i.Quantity);
                decimal discountAmount = 0;
                Customer customer = null;

                if (!string.IsNullOrWhiteSpace(model.CustomerPhone))
                {
                    var phone = model.CustomerPhone.Trim();
                    customer = _db.GetCustomerByPhone(phone) ?? _db.CreateCustomer(phone, $"Khách POS ({phone})");

                    if (model.UsePoints && customer.TotalPoints > 0)
                    {
                        int maxPoints = Math.Min(customer.TotalPoints, (int)(subTotal / 1000));
                        discountAmount = maxPoints * 1000;
                        customer.TotalPoints -= maxPoints;
                        customer.MembershipTier = _db.CalculateMembershipTier(customer.TotalPoints);
                        _db.AddPointHistory(customer.CustomerId, -maxPoints, "Sử dụng điểm tại quầy POS");
                    }
                }

                decimal finalTotal = Math.Max(0, subTotal - discountAmount);
                var orderCode = "POS" + DateTime.Now.ToString("yyMMdd") + new Random().Next(1000, 9999);

                // Tích điểm nếu khách thanh toán
                if (customer != null && finalTotal > 0)
                {
                    int earned = (int)(finalTotal / 10000);
                    if (earned > 0)
                    {
                        customer.TotalPoints += earned;
                        customer.MembershipTier = _db.CalculateMembershipTier(customer.TotalPoints);
                        _db.AddPointHistory(customer.CustomerId, earned, $"Cộng điểm mua tại quầy từ đơn {orderCode}");
                    }
                }

                var order = _db.CreateOrder(new Order
                {
                    OrderCode = orderCode,
                    CashierId = user.UserId,
                    CustomerId = customer?.CustomerId,
                    OrderDate = DateTime.Now,
                    OrderStatus = "Hoàn tất",
                    PaymentMethod = model.PaymentMethod == "VnPay" ? "VNPAY QR" : "Tiền mặt",
                    SubTotal = subTotal,
                    DiscountAmount = discountAmount,
                    TotalAmount = finalTotal,
                    ShippingAddress = "Mua tại quầy (POS)",
                    CustomerPhone = customer?.Phone
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

                return Json(new
                {
                    success = true,
                    orderCode = order.OrderCode,
                    orderId = order.OrderId,
                    totalAmount = finalTotal,
                    discountAmount = discountAmount
                });
            }
            catch (Exception ex)
            {
                return Json(new { success = false, message = ex.Message });
            }
        }

        // POST: /Pos/SaveStartingCash
        [HttpPost]
        public ActionResult SaveStartingCash(decimal startingCash)
        {
            var user = Session["User"] as User ?? _db.GetUser("thungan");
            if (user == null) return Json(new { success = false, message = "Chưa đăng nhập!" });

            var shift = _db.GetActiveShift(user.UserId) ?? _db.CreateShift(user.UserId, startingCash);
            shift.StartingCash = startingCash;
            return Json(new { success = true });
        }

        // POST: /Pos/EndShift
        [HttpPost]
        public ActionResult EndShift(decimal actualCash)
        {
            var user = Session["User"] as User ?? _db.GetUser("thungan");
            if (user == null) return Json(new { success = false, message = "Chưa đăng nhập!" });

            var shift = _db.GetActiveShift(user.UserId);
            if (shift == null) return Json(new { success = false, message = "Không tìm thấy ca trực hiện tại!" });

            shift.EndTime = DateTime.Now;
            shift.ActualCash = actualCash;
            shift.TotalHours = Math.Round((decimal)(shift.EndTime.Value - shift.StartTime).TotalHours, 2);
            shift.StandardHours = Math.Min(8, shift.TotalHours);
            shift.OvertimeHours = Math.Max(0, shift.TotalHours - 8);
            shift.OvertimeBonus = shift.OvertimeHours * user.HourlyRate * 1.5m;
            shift.TotalSalary = (shift.StandardHours * user.HourlyRate) + shift.OvertimeBonus;

            // Tính tiền mặt thu được trong ca
            var shiftCashRevenue = _db.Orders
                .Where(o => o.CashierId == user.UserId && o.PaymentMethod == "Tiền mặt" && o.OrderDate >= shift.StartTime && o.OrderDate <= shift.EndTime)
                .Sum(o => o.TotalAmount);

            decimal expectedCash = shift.StartingCash + shiftCashRevenue;
            shift.CashDifference = actualCash - expectedCash;

            return Json(new
            {
                success = true,
                totalHours = shift.TotalHours,
                salary = shift.TotalSalary,
                diff = shift.CashDifference
            });
        }
    }
}
