using System;
using System.Linq;
using System.Web.Mvc;
using FastFoodWeb.Models;

namespace FastFoodWeb.Controllers
{
    public class AdminController : Controller
    {
        private readonly FastFoodDb _db = FastFoodDb.Instance;

        // GET: /Admin
        public ActionResult Index()
        {
            var orders = _db.Orders;
            ViewBag.TotalOrders = orders.Count;
            ViewBag.CompletedOrders = orders.Count(o => o.OrderStatus == "Hoàn tất");
            ViewBag.TotalRevenue = orders.Where(o => o.OrderStatus == "Hoàn tất").Sum(o => o.TotalAmount);
            ViewBag.TotalCustomers = _db.Customers.Count;
            ViewBag.RecentOrders = orders.OrderByDescending(o => o.OrderDate).Take(6).ToList();
            ViewBag.Products = _db.Products.Take(5).ToList();

            return View();
        }

        // GET: /Admin/Products
        public ActionResult Products()
        {
            return View(_db.Products.ToList());
        }

        // GET: /Admin/CreateProduct
        public ActionResult CreateProduct()
        {
            ViewBag.Categories = _db.Categories;
            return View();
        }

        // POST: /Admin/CreateProduct
        [HttpPost]
        public ActionResult CreateProduct(Product product)
        {
            if (ModelState.IsValid)
            {
                _db.CreateProduct(product);
                return RedirectToAction("Products");
            }
            ViewBag.Categories = _db.Categories;
            return View(product);
        }

        // GET: /Admin/EditProduct/5
        public ActionResult EditProduct(int id)
        {
            var p = _db.GetProductById(id);
            if (p == null) return HttpNotFound();
            ViewBag.Categories = _db.Categories;
            return View(p);
        }

        // POST: /Admin/EditProduct/5
        [HttpPost]
        public ActionResult EditProduct(int id, Product product)
        {
            if (ModelState.IsValid)
            {
                _db.UpdateProduct(id, product);
                return RedirectToAction("Products");
            }
            ViewBag.Categories = _db.Categories;
            return View(product);
        }

        // POST: /Admin/DeleteProduct
        [HttpPost]
        public ActionResult DeleteProduct(int id)
        {
            _db.DeleteProduct(id);
            return RedirectToAction("Products");
        }

        // GET: /Admin/Inventory
        public ActionResult Inventory()
        {
            return View(_db.Products.ToList());
        }

        // POST: /Admin/UpdateStock
        [HttpPost]
        public ActionResult UpdateStock(int id, int stock)
        {
            var p = _db.GetProductById(id);
            if (p != null)
            {
                p.StockQuantity = Math.Max(0, stock);
                return Json(new { success = true, message = "Cập nhật tồn kho thành công!" });
            }
            return Json(new { success = false, message = "Không tìm thấy món ăn!" });
        }

        // GET: /Admin/Orders
        public ActionResult Orders()
        {
            var list = _db.Orders.OrderByDescending(o => o.OrderDate).ToList();
            ViewBag.TotalRevenue = list.Where(o => o.OrderStatus == "Hoàn tất").Sum(o => o.TotalAmount);
            ViewBag.TotalOrders = list.Count;
            return View(list);
        }

        // GET: /Admin/OrderDetails/5
        public ActionResult OrderDetails(int id)
        {
            var order = _db.Orders.FirstOrDefault(o => o.OrderId == id);
            if (order == null) return HttpNotFound();

            ViewBag.OrderDetails = _db.GetOrderDetails(id);
            ViewBag.Cashier = _db.GetUserById(order.CashierId);

            return View(order);
        }

        // POST: /Admin/UpdateOrderStatus
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

        // GET: /Admin/Categories
        public ActionResult Categories()
        {
            return View(_db.Categories.ToList());
        }

        // POST: /Admin/CreateCategory
        [HttpPost]
        public ActionResult CreateCategory(string categoryName)
        {
            if (!string.IsNullOrWhiteSpace(categoryName))
            {
                int nextId = _db.Categories.Any() ? _db.Categories.Max(c => c.CategoryId) + 1 : 1;
                _db.Categories.Add(new Category { CategoryId = nextId, CategoryName = categoryName.Trim() });
            }
            return RedirectToAction("Categories");
        }

        // GET: /Admin/Staff
        public ActionResult Staff()
        {
            return View(_db.Users.ToList());
        }

        // GET: /Admin/Customers
        public ActionResult Customers()
        {
            return View(_db.Customers.ToList());
        }

        // GET: /Admin/Reports
        public ActionResult Reports()
        {
            ViewBag.Orders = _db.Orders.ToList();
            ViewBag.Shifts = _db.Shifts.ToList();
            return View();
        }

        // GET: /Admin/Complaints
        public ActionResult Complaints()
        {
            return View(_db.Complaints.OrderByDescending(c => c.CreatedAt).ToList());
        }
    }
}
