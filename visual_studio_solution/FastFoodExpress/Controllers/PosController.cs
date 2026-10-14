using System;
using System.Collections.Generic;
using System.Linq;
using System.Web.Mvc;
using FastFoodExpress.Models;

namespace FastFoodExpress.Controllers
{
    public class PosController : Controller
    {
        // GET: Pos (Màn hình bán hàng trực tiếp tại quầy)
        public ActionResult Index()
        {
            var user = Session["User"] as User ?? DatabaseContext.Users.First(u => u.RoleId == 2);
            Session["User"] = user;

            var activeShift = DatabaseContext.Shifts.FirstOrDefault(s => s.UserId == user.UserId && s.EndTime == null);
            if (activeShift == null)
            {
                activeShift = new Shift
                {
                    ShiftId = DatabaseContext.Shifts.Count + 1,
                    UserId = user.UserId,
                    StartTime = DateTime.Now,
                    StartingCash = 0
                };
                DatabaseContext.Shifts.Add(activeShift);
            }

            ViewBag.CashierName = user.FullName;
            ViewBag.ShowStartCashModal = activeShift.StartingCash == 0;
            ViewBag.ExpectedPreviousCash = DatabaseContext.ExpectedPreviousCash;
            ViewBag.PreviousCashierName = "Thu Ngân Tiền Nhiệm";
            ViewBag.Products = DatabaseContext.Products.Where(p => p.IsActive).ToList();
            ViewBag.Categories = DatabaseContext.Categories;

            return View();
        }

        // POST: Pos/SaveStartingCash (Khai báo tiền mở két đầu ca)
        [HttpPost]
        public JsonResult SaveStartingCash(decimal startingCash)
        {
            var user = Session["User"] as User ?? DatabaseContext.Users.First();
            var activeShift = DatabaseContext.Shifts.FirstOrDefault(s => s.UserId == user.UserId && s.EndTime == null);
            decimal expected = DatabaseContext.ExpectedPreviousCash;

            if (Math.Abs(startingCash - expected) > (decimal)0.01)
            {
                return Json(new
                {
                    success = false,
                    message = $"❌ LỖI MỞ KÉT: Số tiền nhập vào ({startingCash:N0} đ) KHÔNG TRÙNG KHỚP với ca trước ({expected:N0} đ)! Yêu cầu của giáo viên: Bắt buộc trùng khớp 100%."
                });
            }

            if (activeShift != null)
            {
                activeShift.StartingCash = startingCash;
            }

            return Json(new { success = true, startingCash = startingCash });
        }

        // POST: Pos/Checkout (Thu ngân thanh toán tại quầy)
        [HttpPost]
        public JsonResult Checkout(List<CartItemInput> Items, int? CustomerId, string CustomerPhone, string PaymentMethod, bool UsePoints = false)
        {
            if (Items == null || !Items.Any())
            {
                return Json(new { success = false, message = "Giỏ hàng đang trống!" });
            }

            decimal subTotal = 0;
            foreach (var item in Items)
            {
                var prod = DatabaseContext.Products.FirstOrDefault(p => p.ProductId == item.Id);
                if (prod != null)
                {
                    subTotal += prod.Price * item.Quantity;
                }
            }

            var customer = DatabaseContext.Customers.FirstOrDefault(c => c.Phone == CustomerPhone);
            decimal discount = 0;
            if (UsePoints && customer != null && customer.TotalPoints > 0)
            {
                discount = customer.TotalPoints * 1000;
                if (discount > subTotal) discount = subTotal;
            }

            decimal totalAmount = Math.Max(0, subTotal - discount);
            string orderCode = "HD" + DateTime.Now.ToString("yyMMdd") + new Random().Next(1000, 9999);

            var user = Session["User"] as User ?? DatabaseContext.Users.First();
            var order = new Order
            {
                OrderId = DatabaseContext.Orders.Count + 1,
                OrderCode = orderCode,
                CashierId = user.UserId,
                CustomerId = customer?.CustomerId,
                OrderDate = DateTime.Now,
                OrderStatus = "Hoàn tất",
                PaymentMethod = PaymentMethod ?? "Tiền mặt",
                SubTotal = subTotal,
                DiscountAmount = discount,
                TotalAmount = totalAmount,
                CustomerPhone = CustomerPhone
            };

            foreach (var item in Items)
            {
                var prod = DatabaseContext.Products.FirstOrDefault(p => p.ProductId == item.Id);
                if (prod != null)
                {
                    order.Details.Add(new OrderDetail
                    {
                        DetailId = order.Details.Count + 1,
                        OrderId = order.OrderId,
                        ProductId = prod.ProductId,
                        ProductName = prod.ProductName,
                        Quantity = item.Quantity,
                        UnitPrice = prod.Price
                    });
                    prod.StockQuantity = Math.Max(0, prod.StockQuantity - item.Quantity);
                }
            }

            DatabaseContext.Orders.Add(order);

            return Json(new
            {
                success = true,
                orderCode = order.OrderCode,
                message = "Thanh toán thành công!"
            });
        }
    }
}
