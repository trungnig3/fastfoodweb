using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using FastFoodWeb.Data;
using Microsoft.EntityFrameworkCore;
using FastFoodWeb.Models;
using Microsoft.AspNetCore.Mvc.Rendering;
using System;
using System.Linq;
using System.Collections.Generic;

namespace FastFoodWeb.Controllers
{
    [Authorize(Roles = "Admin,Manager")] 
    public class AdminController : Controller
    {
        private readonly ApplicationDbContext _context;

        public AdminController(ApplicationDbContext context)
        {
            _context = context;
        }

        public IActionResult Index()
        {
            var usersWithoutRate = _context.Users.Where(u => u.HourlyRate == 0).ToList();
            foreach (var u in usersWithoutRate)
            {
                u.HourlyRate = 25000; 
            }
            _context.SaveChanges();
            return View();
        }

        public IActionResult Products(string search, int? categoryId)
        {
            var products = _context.Products.Include(p => p.Category).AsQueryable();

            if (!string.IsNullOrEmpty(search))
            {
                products = products.Where(p => p.ProductName.Contains(search));
            }
            if (categoryId.HasValue && categoryId > 0)
            {
                products = products.Where(p => p.CategoryId == categoryId);
            }

            ViewBag.Categories = _context.Categories.ToList();
            ViewBag.SearchKey = search;
            return View(products.ToList());
        }

        [HttpGet]
        public IActionResult CreateProduct()
        {
            ViewBag.Categories = new SelectList(_context.Categories, "CategoryId", "CategoryName");
            return View();
        }

        [HttpPost]
        public IActionResult CreateProduct(Product product)
        {
            _context.Products.Add(product);
            _context.SaveChanges();
            return RedirectToAction("Products");
        }

        [HttpGet]
        public IActionResult EditProduct(int id)
        {
            var product = _context.Products.Find(id);
            if (product == null) return NotFound("Không tìm thấy món ăn!");

            ViewBag.Categories = new SelectList(_context.Categories, "CategoryId", "CategoryName", product.CategoryId);
            return View(product);
        }

        [HttpPost]
        public IActionResult EditProduct(Product product)
        {
            _context.Products.Update(product);
            _context.SaveChanges();
            return RedirectToAction("Products");
        }

        [HttpPost]
        public IActionResult DeleteProduct(int id)
        {
            var product = _context.Products.Find(id);
            if (product != null)
            {
                _context.Products.Remove(product);
                _context.SaveChanges();
            }
            return RedirectToAction("Products");
        }

        public IActionResult Inventory()
        {
            var products = _context.Products.Include(p => p.Category).ToList();
            return View(products);
        }

        [HttpPost]
        public IActionResult UpdateStock(int id, int stock)
        {
            var product = _context.Products.Find(id);
            if (product != null)
            {
                product.StockQuantity = stock;
                _context.SaveChanges();
                return Json(new { success = true, message = "Cập nhật kho thành công!" });
            }
            return Json(new { success = false, message = "Không tìm thấy sản phẩm!" });
        }

        public IActionResult Orders()
        {
            var orders = _context.Orders
                                 .Include(o => o.Cashier)
                                 .OrderByDescending(o => o.OrderDate)
                                 .ToList();

            ViewBag.TotalRevenue = orders.Sum(o => o.TotalAmount);
            ViewBag.TotalOrders = orders.Count;

            return View(orders);
        }

        public IActionResult OrderDetails(int id)
        {
            var order = _context.Orders
                                .Include(o => o.Cashier)
                                .Include(o => o.OrderDetails)
                                    .ThenInclude(od => od.Product)
                                .FirstOrDefault(o => o.OrderId == id);

            if (order == null) return NotFound("Không tìm thấy hóa đơn!");

            return View(order);
        }

        [HttpPost]
        public IActionResult UpdateOrderStatus(int id, string status)
        {
            var order = _context.Orders.Find(id);
            if (order != null)
            {
                order.OrderStatus = status;
                _context.SaveChanges();
                return Json(new { success = true, message = "Đã cập nhật trạng thái đơn hàng!" });
            }
            return Json(new { success = false, message = "Không tìm thấy đơn hàng!" });
        }

        public IActionResult RevenueReport(DateTime? startDate, DateTime? endDate)
        {
            var query = _context.Orders.Where(o => o.OrderStatus == "Completed" || o.OrderStatus == "Hoàn tất");

            if (startDate.HasValue)
                query = query.Where(o => o.OrderDate >= startDate.Value);
            if (endDate.HasValue)
                query = query.Where(o => o.OrderDate <= endDate.Value.AddDays(1));

            var orders = query.OrderByDescending(o => o.OrderDate).ToList();

            ViewBag.TotalRevenue = orders.Sum(o => o.TotalAmount);
            ViewBag.TotalOrders = orders.Count;
            ViewBag.StartDate = startDate?.ToString("yyyy-MM-dd");
            ViewBag.EndDate = endDate?.ToString("yyyy-MM-dd");

            return View(orders);
        }

        public IActionResult Reports()
        {
            var today = DateTime.Today;
            var todayOrders = _context.Orders.Where(o => o.OrderDate >= today).ToList();

            decimal totalRevenue = todayOrders.Where(o => !o.OrderStatus.Contains("Hủy")).Sum(o => o.TotalAmount);
            int totalOrderCount = todayOrders.Count;
            decimal avgOrderValue = totalOrderCount > 0 ? totalRevenue / totalOrderCount : 0;

            ViewBag.TotalRevenue = totalRevenue;
            ViewBag.TotalOrders = totalOrderCount;
            ViewBag.AvgOrderValue = avgOrderValue;

            var orders = _context.Orders.Include(o => o.OrderDetails).ThenInclude(od => od.Product).ToList();
            var topProducts = orders.SelectMany(o => o.OrderDetails)
                .GroupBy(od => od.Product != null ? od.Product.ProductName : "Khác")
                .Select(g => new TopProductViewModel
                {
                    ProductName = g.Key,
                    QuantitySold = g.Sum(od => od.Quantity)
                })
                .OrderByDescending(x => x.QuantitySold)
                .Take(5)
                .ToList();

            ViewBag.TopProducts = topProducts;

            var shiftReports = _context.Shifts
                .Include(s => s.User)
                .Where(s => s.EndTime != null)
                .OrderByDescending(s => s.EndTime)
                .Select(s => new ShiftReportViewModel
                {
                    Date = s.EndTime ?? s.StartTime,
                    CashierName = s.User != null ? s.User.FullName : "Nhân viên",
                    ExpectedCash = s.ActualCash - s.CashDifference,
                    ActualCash = s.ActualCash,
                    Difference = s.CashDifference
                })
                .Take(10)
                .ToList();

            ViewBag.ShiftReports = shiftReports;

            return View();
        }

        public IActionResult Staff(string search)
        {
            var users = _context.Users.Include(u => u.Role).AsQueryable();

            if (!string.IsNullOrEmpty(search))
            {
                users = users.Where(u => u.FullName.Contains(search) || u.Username.Contains(search));
            }

            ViewBag.SearchKey = search;
            return View(users.ToList());
        }

        [HttpGet]
        public IActionResult CreateStaff()
        {
            ViewBag.Roles = new SelectList(_context.Roles, "RoleId", "RoleName");
            return View();
        }

        [HttpPost]
        public IActionResult CreateStaff(User user)
        {
            _context.Users.Add(user);
            _context.SaveChanges();
            return RedirectToAction("Staff");
        }

        [HttpGet]
        public IActionResult EditStaff(int id)
        {
            var user = _context.Users.Find(id);
            if (user == null) return NotFound("Không tìm thấy nhân viên!");

            ViewBag.Roles = new SelectList(_context.Roles, "RoleId", "RoleName", user.RoleId);
            return View(user);
        }

        [HttpPost]
        public IActionResult EditStaff(User user)
        {
            var existingUser = _context.Users.Find(user.UserId);
            if (existingUser != null)
            {
                existingUser.FullName = user.FullName;
                existingUser.Username = user.Username;
                existingUser.RoleId = user.RoleId;
                existingUser.IsActive = user.IsActive;

                if (!string.IsNullOrEmpty(user.PasswordHash))
                {
                    existingUser.PasswordHash = user.PasswordHash;
                }

                _context.SaveChanges();
            }
            return RedirectToAction("Staff");
        }

        [HttpPost]
        public IActionResult DeleteUser(int id)
        {
            var user = _context.Users.Find(id);
            if (user != null)
            {
                _context.Users.Remove(user);
                _context.SaveChanges();
                return Json(new { success = true });
            }
            return Json(new { success = false });
        }

        public IActionResult SeedRoles()
        {
            if (!_context.Roles.Any(r => r.RoleName == "Cashier"))
                _context.Roles.Add(new Role { RoleName = "Cashier" });

            if (!_context.Roles.Any(r => r.RoleName == "Admin"))
                _context.Roles.Add(new Role { RoleName = "Admin" });

            _context.SaveChanges();
            return Content("Đã khôi phục thành công các quyền Admin và Cashier!");
        }

        public IActionResult SalaryReport(int? month, int? year)
{
    int m = month ?? DateTime.Now.Month;
    int y = year ?? DateTime.Now.Year;

    var shifts = _context.Shifts
        .Include(s => s.User)
            .ThenInclude(u => u.Role) // Nạp thêm thông tin Quyền của người dùng
        .Where(s => s.StartTime.Month == m && s.StartTime.Year == y && s.EndTime != null 
                    && s.User != null && s.User.Role != null && s.User.Role.RoleName != "Admin") // LỌC BỎ QUYỀN ADMIN
        .ToList();

    var report = shifts.GroupBy(s => s.User)
        .Select(g => new SalaryReportViewModel
        {
            FullName = g.Key != null ? g.Key.FullName : "Tài khoản đã xóa",
            Username = g.Key != null ? g.Key.Username : "N/A",
            HourlyRate = g.Key != null ? g.Key.HourlyRate : 0,
            TotalHours = g.Sum(s => s.TotalHours),
            StandardHours = g.Sum(s => s.TotalHours - s.OvertimeHours), 
            OvertimeHours = g.Sum(s => s.OvertimeHours),
            TotalOvertimeHours = g.Sum(s => s.OvertimeHours),
            OvertimeBonus = g.Sum(s => s.OvertimeBonus),
            TotalOvertimeBonus = g.Sum(s => s.OvertimeBonus),
            TotalLatePenalty = g.Sum(s => s.LatePenalty),
            TotalSalary = g.Sum(s => s.TotalSalary)
        }).ToList();

    ViewBag.Month = m;
    ViewBag.Year = y;
    return View(report);
}
    }

    public class TopProductViewModel
    {
        public string ProductName { get; set; }
        public int QuantitySold { get; set; }
    }

    public class ShiftReportViewModel
    {
        public DateTime Date { get; set; }
        public string CashierName { get; set; }
        public decimal ExpectedCash { get; set; }
        public decimal ActualCash { get; set; }
        public decimal Difference { get; set; }
    }

    public class SalaryReportViewModel
    {
        public string FullName { get; set; }
        public string Username { get; set; }
        public decimal HourlyRate { get; set; }
        public double TotalHours { get; set; }
        public double StandardHours { get; set; }
        public double OvertimeHours { get; set; }
        public double TotalOvertimeHours { get; set; }
        public decimal OvertimeBonus { get; set; } // Khớp trực tiếp với @item.OvertimeBonus trong View
        public decimal TotalOvertimeBonus { get; set; }
        public decimal TotalLatePenalty { get; set; }
        public decimal TotalSalary { get; set; }
    }
}