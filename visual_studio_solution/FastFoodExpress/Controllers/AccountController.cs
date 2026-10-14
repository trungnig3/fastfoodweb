using System.Linq;
using System.Web.Mvc;
using FastFoodExpress.Models;

namespace FastFoodExpress.Controllers
{
    public class AccountController : Controller
    {
        // GET: Account/Login
        public ActionResult Login()
        {
            return View();
        }

        // POST: Account/Login
        [HttpPost]
        public ActionResult Login(string username, string password)
        {
            var user = DatabaseContext.Users.FirstOrDefault(u => u.Username == username && u.PasswordHash == password);
            if (user != null)
            {
                Session["User"] = user;
                if (user.RoleId == 1) return RedirectToAction("Index", "Admin");
                if (user.RoleId == 2) return RedirectToAction("Index", "Pos");
                return RedirectToAction("Index", "Shop");
            }
            ViewBag.Error = "Tên đăng nhập hoặc mật khẩu không đúng!";
            return View();
        }

        // GET: Account/Register
        public ActionResult Register()
        {
            return View();
        }

        // POST: Account/Register
        [HttpPost]
        public ActionResult Register(string username, string password, string fullName, string phone)
        {
            if (DatabaseContext.Users.Any(u => u.Username == username))
            {
                ViewBag.Error = "Tên đăng nhập đã tồn tại!";
                return View();
            }

            var newUser = new User
            {
                UserId = DatabaseContext.Users.Count + 1,
                Username = username,
                PasswordHash = password,
                FullName = fullName,
                PhoneNumber = phone,
                RoleId = 3,
                RoleName = "Customer",
                HourlyRate = 0,
                IsActive = true
            };
            DatabaseContext.Users.Add(newUser);
            Session["User"] = newUser;

            return RedirectToAction("Index", "Shop");
        }

        // GET: Account/Logout
        public ActionResult Logout()
        {
            Session.Clear();
            return RedirectToAction("Index", "Shop");
        }
    }
}
