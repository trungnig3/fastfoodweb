using System;
using System.Linq;
using System.Web.Mvc;
using FastFoodWeb.Models;

namespace FastFoodWeb.Controllers
{
    public class CashierController : Controller
    {
        private readonly FastFoodDb _db = FastFoodDb.Instance;

        private User GetCurrentCashier()
        {
            var user = Session["User"] as User;
            if (user == null)
            {
                user = _db.GetUser("thungan") ?? _db.Users.First();
                Session["User"] = user;
                Session["Role"] = "Cashier";
            }
            return user;
        }

        // GET: /Cashier
        public ActionResult Index()
        {
            var user = GetCurrentCashier();
            var activeShift = _db.GetActiveShift(user.UserId) ?? _db.CreateShift(user.UserId, 0);

            var shiftOrders = _db.Orders
                .Where(o => o.CashierId == user.UserId && o.OrderDate >= activeShift.StartTime)
                .OrderByDescending(o => o.OrderDate)
                .ToList();

            ViewBag.ActiveShift = activeShift;
            ViewBag.ShiftOrders = shiftOrders;
            ViewBag.ShiftRevenue = shiftOrders.Where(o => o.OrderStatus == "Hoàn tất").Sum(o => o.TotalAmount);

            return View();
        }

        // GET: /Cashier/Orders
        public ActionResult Orders()
        {
            var user = GetCurrentCashier();
            var activeShift = _db.GetActiveShift(user.UserId);

            var orders = _db.Orders
                .Where(o => activeShift == null || o.OrderDate >= activeShift.StartTime)
                .OrderByDescending(o => o.OrderDate)
                .ToList();

            return View(orders);
        }

        // GET: /Cashier/OrderDetails/5
        public ActionResult OrderDetails(int id)
        {
            var order = _db.Orders.FirstOrDefault(o => o.OrderId == id);
            if (order == null) return HttpNotFound();

            ViewBag.OrderDetails = _db.GetOrderDetails(id);
            ViewBag.Cashier = _db.GetUserById(order.CashierId);

            return View(order);
        }

        // POST: /Cashier/UpdateOrderStatus
        [HttpPost]
        public ActionResult UpdateOrderStatus(int id, string status)
        {
            var order = _db.Orders.FirstOrDefault(o => o.OrderId == id);
            if (order == null) return Json(new { success = false, message = "Không tìm thấy hóa đơn!" });

            if (status == "Đang chuẩn bị món")
            {
                order.OrderStatus = "Đang xử lý";
                order.ShippingStatus = "Đang chuẩn bị món";
            }
            else if (status == "Đang giao hàng")
            {
                order.OrderStatus = "Đang giao";
                order.ShippingStatus = "Đang giao hàng";
            }
            else if (status == "Đã giao thành công" || status == "Hoàn tất")
            {
                order.OrderStatus = "Hoàn tất";
                order.ShippingStatus = "Đã giao thành công";
            }
            else if (status == "Đã hủy")
            {
                order.OrderStatus = "Đã hủy";
                order.ShippingStatus = "Đã hủy đơn";
                // Hoàn lại kho
                var details = _db.GetOrderDetails(order.OrderId);
                foreach (var d in details)
                {
                    var p = _db.GetProductById(d.ProductId);
                    if (p != null) p.StockQuantity += d.Quantity;
                }
            }
            else
            {
                order.OrderStatus = status;
                order.ShippingStatus = status;
            }

            if (Request.IsAjaxRequest() || Request.Headers["Accept"]?.Contains("application/json") == true)
            {
                return Json(new { success = true, message = $"Đã cập nhật trạng thái đơn #{id} thành công!" });
            }

            return RedirectToAction("OrderDetails", new { id });
        }
    }
}
