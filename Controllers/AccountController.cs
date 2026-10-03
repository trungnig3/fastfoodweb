using Microsoft.AspNetCore.Mvc;
using FastFoodWeb.Data;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using FastFoodWeb.Models;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Linq;

namespace FastFoodWeb.Controllers
{
    public class AccountController : Controller
    {
        private readonly ApplicationDbContext _context;

        public AccountController(ApplicationDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public IActionResult Login()
        {
            // Nếu đã đăng nhập rồi thì đá về trang chủ
            if (User.Identity != null && User.Identity.IsAuthenticated)
                return RedirectToAction("Index", "Admin");

            return View();
        }

        [HttpPost]
        public async Task<IActionResult> Login(string username, string password)
        {
            // 1. Tìm user trong Database
            var user = await _context.Users.Include(u => u.Role)
                                     .FirstOrDefaultAsync(u => u.Username == username && u.PasswordHash == password && u.IsActive);

            if (user == null)
            {
                ViewBag.Error = "Tên đăng nhập hoặc mật khẩu không đúng!";
                return View();
            }

            // 2. Tạo các thẻ định danh (Claims)
            var claims = new List<Claim>
            {
                // Dòng này cực kỳ quan trọng để User.Identity.Name lấy được Username
                new Claim(ClaimTypes.Name, user.Username),
                new Claim(ClaimTypes.GivenName, user.FullName),
                new Claim(ClaimTypes.Role, user.Role.RoleName)
            };

            var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            var principal = new ClaimsPrincipal(identity);
            // 1. Tự động chốt các ca làm cũ bị treo (nếu hôm trước quên bấm Đóng ca)
            var pendingShifts = _context.Shifts.Where(s => s.UserId == user.UserId && s.EndTime == null).ToList();
            foreach (var s in pendingShifts)
            {
                s.EndTime = DateTime.Now;
                s.TotalHours = (s.EndTime.Value - s.StartTime).TotalHours;
                s.TotalSalary = (decimal)s.TotalHours * user.HourlyRate;
            }

            // 2. Mở ca làm việc mới cho hôm nay
            var newShift = new Shift { UserId = user.UserId, StartTime = DateTime.Now };
            _context.Shifts.Add(newShift);
            await _context.SaveChangesAsync();
            // 3. Đăng nhập hệ thống (Lưu Cookie) - Đã thêm await
            await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal);

            // 4. Điều hướng theo quyền
            if (user.Role.RoleName == "Cashier")
            {
                return RedirectToAction("Index", "Pos");
            }

            return RedirectToAction("Index", "Admin");
        }

        [HttpGet]
public async Task<IActionResult> Logout()
{
    var username = User.Identity?.Name;
    var user = _context.Users.FirstOrDefault(u => u.Username == username);
    
    if (user != null)
    {
        // 1. Kiểm tra xem Thu ngân này có ca làm việc nào đang mở không
        var activeShift = _context.Shifts
            .OrderByDescending(s => s.StartTime)
            .FirstOrDefault(s => s.UserId == user.UserId && s.EndTime == null);
            
        // 2. Nếu ca làm CHƯA ĐÓNG -> CHẶN KHÔNG CHO THOÁT
        if (activeShift != null)
        {
            // Bắt buộc quay lại trang Thu ngân (POS) để đếm tiền và chốt ca
            return RedirectToAction("Index", "Pos");
        }
    }

    // Nếu đã đóng ca hợp lệ thì mới cho phép xóa Session và thoát ra màn hình Login
    await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    return RedirectToAction("Login", "Account");
}

        [HttpGet]
        public IActionResult Setup()
        {
            // Tìm quyền Cashier bị cấp sai lúc trước và đổi nó thành Admin
            var roleToFix = _context.Roles.FirstOrDefault(r => r.RoleName == "Cashier");
            if (roleToFix != null)
            {
                roleToFix.RoleName = "Admin";
                _context.SaveChanges();
                return Content("Tuyệt vời! Đã nâng cấp tài khoản 'admin' lên quyền Admin. Hãy quay lại trang Đăng nhập.");
            }

            return Content("Tài khoản đã được nâng cấp rồi!");
        }

        [HttpGet]
        public IActionResult CreateCashier()
        {
            // Kiểm tra xem đã có tài khoản thu ngân chưa
            if (!_context.Users.Any(u => u.Username == "thungan"))
            {
                var role = _context.Roles.FirstOrDefault(r => r.RoleName == "Cashier");
                if (role == null)
                {
                    role = new Role { RoleName = "Cashier" };
                }

                _context.Users.Add(new User
                {
                    Username = "thungan",
                    PasswordHash = "123",
                    FullName = "Nhân viên Bán hàng",
                    Role = role
                });

                _context.SaveChanges();
                return Content("Tuyệt vời! Đã tạo tài khoản Thu ngân. Tên đăng nhập: thungan | Mật khẩu: 123");
            }
            return Content("Tài khoản thungan đã tồn tại!");
        }
    }
}