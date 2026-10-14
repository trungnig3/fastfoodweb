using System.Linq;
using System.Web.Mvc;
using FastFoodExpress.Models;

namespace FastFoodExpress.Controllers
{
    public class AdminController : Controller
    {
        // GET: Admin (Dashboard Quản trị)
        public ActionResult Index()
        {
            ViewBag.TotalOrders = DatabaseContext.Orders.Count;
            ViewBag.TotalRevenue = DatabaseContext.Orders.Sum(o => (decimal?)o.TotalAmount) ?? 0;
            ViewBag.TotalCustomers = DatabaseContext.Customers.Count;
            ViewBag.TotalProducts = DatabaseContext.Products.Count;

            ViewBag.RecentOrders = DatabaseContext.Orders.OrderByDescending(o => o.OrderDate).Take(10).ToList();
            ViewBag.Products = DatabaseContext.Products;

            return View();
        }
    }
}
