using System;
using System.Collections.Generic;
using System.Linq;
using System.Web.Mvc;
using FastFoodExpress.Models;

namespace FastFoodExpress.Controllers
{
    public class ShopController : Controller
    {
        // GET: Shop (Trang chủ cửa hàng trực tuyến)
        public ActionResult Index()
        {
            ViewBag.Categories = DatabaseContext.Categories;
            ViewBag.Products = DatabaseContext.Products.Where(p => p.IsActive).ToList();
            ViewBag.BestSellers = DatabaseContext.Products.OrderByDescending(p => p.StockQuantity).Take(4).ToList();
            ViewBag.User = Session["User"] as User;
            ViewBag.CustomerPoints = 0;
            ViewBag.CustomerTier = "Đồng";

            return View();
        }

        // POST: Shop/Checkout (Khách hàng đặt hàng)
        [HttpPost]
        public JsonResult Checkout(List<CartItemInput> Items, string CustomerPhone, string CustomerName, string Address, string PaymentMethod, decimal ShippingFee = 0, bool UsePoints = false, int PointsToUse = 0)
        {
            if (Items == null || !Items.Any())
            {
                return Json(new { success = false, message = "Giỏ hàng đang trống!" });
            }

            if (string.IsNullOrWhiteSpace(CustomerPhone))
            {
                return Json(new { success = false, message = "Vui lòng nhập số điện thoại nhận hàng!" });
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
            if (customer == null)
            {
                customer = new Customer
                {
                    CustomerId = DatabaseContext.Customers.Count + 1,
                    Phone = CustomerPhone,
                    FullName = string.IsNullOrWhiteSpace(CustomerName) ? "Khách hàng " + CustomerPhone : CustomerName,
                    TotalPoints = 0,
                    MembershipTier = "Đồng"
                };
                DatabaseContext.Customers.Add(customer);
            }

            decimal discountAmount = 0;
            if (UsePoints && PointsToUse > 0 && customer.TotalPoints >= PointsToUse)
            {
                discountAmount = PointsToUse * 1000;
                if (discountAmount > subTotal) discountAmount = subTotal;
                customer.TotalPoints -= PointsToUse;
            }

            decimal totalAmount = Math.Max(0, subTotal - discountAmount) + ShippingFee;
            string orderCode = "HD" + DateTime.Now.ToString("yyMMdd") + new Random().Next(1000, 9999);

            var order = new Order
            {
                OrderId = DatabaseContext.Orders.Count + 1,
                OrderCode = orderCode,
                CashierId = 1,
                CustomerId = customer.CustomerId,
                OrderDate = DateTime.Now,
                OrderStatus = "Chờ xử lý",
                PaymentMethod = PaymentMethod ?? "COD",
                SubTotal = subTotal,
                DiscountAmount = discountAmount,
                ShippingFee = ShippingFee,
                TotalAmount = totalAmount,
                CustomerPhone = CustomerPhone,
                CustomerName = customer.FullName,
                DeliveryAddress = Address,
                ShipperName = "Nguyễn Văn Hùng",
                ShipperPhone = "0912345678"
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

            int pointsEarned = (int)(totalAmount / 10000);
            customer.TotalPoints += pointsEarned;
            DatabaseContext.Orders.Add(order);

            return Json(new
            {
                success = true,
                orderCode = order.OrderCode,
                driverName = order.ShipperName,
                driverPhone = order.ShipperPhone,
                pointsUsed = PointsToUse,
                discountAmount = discountAmount,
                pointsEarned = pointsEarned,
                remainingPoints = customer.TotalPoints
            });
        }

        // GET: Shop/GetCustomerPoints
        public JsonResult GetCustomerPoints(string phone)
        {
            var cust = DatabaseContext.Customers.FirstOrDefault(c => c.Phone == phone);
            if (cust != null)
            {
                return Json(new { success = true, customer = new { id = cust.CustomerId, phone = cust.Phone, name = cust.FullName, points = cust.TotalPoints, tier = cust.MembershipTier, discountValue = cust.TotalPoints * 1000 } }, JsonRequestBehavior.AllowGet);
            }
            return Json(new { success = false }, JsonRequestBehavior.AllowGet);
        }
    }

    public class CartItemInput
    {
        public int Id { get; set; }
        public int Quantity { get; set; }
    }
}
