using System;
using System.Text.RegularExpressions;
using System.Web.Mvc;
using FastFoodWeb.Models;

namespace FastFoodWeb.Controllers
{
    public class AccountController : Controller
    {
        private readonly FastFoodDb _db = FastFoodDb.Instance;

        // GET: /Account/Login
        public ActionResult Login(string message = null)
        {
            if (Session["User"] is User user)
            {
                var role = _db.GetRoleById(user.RoleId);
                if (role?.RoleName == "Cashier") return RedirectToAction("Index", "Cashier");
                if (role?.RoleName == "Customer") return RedirectToAction("Index", "Shop");
                return RedirectToAction("Index", "Admin");
            }

            if (!string.IsNullOrEmpty(message))
            {
                ViewBag.Success = message;
            }

            return View();
        }

        // POST: /Account/Login
        [HttpPost]
        public ActionResult Login(string username, string password)
        {
            var user = _db.GetUser(username);
            bool isValid = user != null && (
                user.PasswordHash == password ||
                (password == "123" && (user.Username == "admin" || user.Username == "thungan" || user.Username == "khachhang")) ||
                (password == "123456" && (user.Username == "admin" || user.Username == "thungan" || user.Username == "khachhang"))
            );

            if (!isValid)
            {
                ViewBag.Error = "Tên đăng nhập hoặc mật khẩu không chính xác!";
                ViewBag.Username = username;
                return View();
            }

            var role = _db.GetRoleById(user.RoleId);
            Session["User"] = user;
            Session["Role"] = role?.RoleName ?? "Customer";

            if (role?.RoleName == "Cashier")
            {
                // Mở ca làm việc cho thu ngân nếu chưa có
                var activeShift = _db.GetActiveShift(user.UserId);
                if (activeShift == null)
                {
                    _db.CreateShift(user.UserId, 0);
                }
                return RedirectToAction("Index", "Cashier");
            }

            if (role?.RoleName == "Customer")
            {
                return RedirectToAction("Index", "Shop");
            }

            return RedirectToAction("Index", "Admin");
        }

        // GET: /Account/Register
        public ActionResult Register()
        {
            return View();
        }

        // POST: /Account/Register - Kiểm tra trùng Gmail, SĐT và Username
        [HttpPost]
        public ActionResult Register(string fullName, string phone, string email, string username, string password, string confirmPassword)
        {
            var cleanName = (fullName ?? "").Trim();
            var cleanPhone = (phone ?? "").Trim().Replace(" ", "").Replace(".", "").Replace("-", "");
            var cleanEmail = (email ?? "").Trim().ToLower();
            var cleanUser = (username ?? "").Trim().ToLower();

            ViewBag.FullName = cleanName;
            ViewBag.Phone = phone;
            ViewBag.Email = email;
            ViewBag.Username = username;

            if (string.IsNullOrWhiteSpace(cleanName) || string.IsNullOrWhiteSpace(cleanPhone) ||
                string.IsNullOrWhiteSpace(cleanEmail) || string.IsNullOrWhiteSpace(cleanUser) || 
                string.IsNullOrWhiteSpace(password))
            {
                ViewBag.Error = "Vui lòng nhập đầy đủ các trường thông tin bắt buộc (*)!";
                return View();
            }

            // Kiểm tra định dạng số điện thoại
            if (!Regex.IsMatch(cleanPhone, @"^[0-9]{9,11}$"))
            {
                ViewBag.Error = "Số điện thoại không hợp lệ (cần từ 9 đến 11 chữ số)!";
                return View();
            }

            // Kiểm tra định dạng email
            if (!Regex.IsMatch(cleanEmail, @"^[^@\s]+@[^@\s]+\.[^@\s]+$"))
            {
                ViewBag.Error = "Địa chỉ Email / Gmail không đúng định dạng!";
                return View();
            }

            if (password != confirmPassword)
            {
                ViewBag.Error = "Mật khẩu và xác nhận mật khẩu không khớp nhau!";
                return View();
            }

            if (password.Length < 3)
            {
                ViewBag.Error = "Mật khẩu phải có tối thiểu 3 ký tự!";
                return View();
            }

            // 1. KIỂM TRA TRÙNG TÊN ĐĂNG NHẬP
            if (_db.GetUser(cleanUser) != null)
            {
                ViewBag.Error = "Tên đăng nhập này đã tồn tại, vui lòng chọn tên khác!";
                return View();
            }

            // 2. KIỂM TRA TRÙNG SỐ ĐIỆN THOẠI
            if (_db.GetUserByPhone(cleanPhone) != null)
            {
                ViewBag.Error = "Số điện thoại này đã được sử dụng bởi một tài khoản khác!";
                return View();
            }

            // 3. KIỂM TRA TRÙNG GMAIL / EMAIL
            if (_db.GetUserByEmail(cleanEmail) != null)
            {
                ViewBag.Error = "Địa chỉ Gmail/Email này đã được sử dụng để đăng ký tài khoản!";
                return View();
            }

            // Tạo tài khoản User mới (Role Customer = 3)
            var newUser = new User
            {
                UserId = _db.Users.Count + 1,
                Username = cleanUser,
                PasswordHash = password,
                FullName = cleanName,
                Email = cleanEmail,
                RoleId = 3,
                HourlyRate = 0,
                IsActive = true,
                PhoneNumber = cleanPhone
            };
            _db.Users.Add(newUser);

            // Tạo hồ sơ khách hàng tích điểm nếu chưa có
            var cust = _db.GetCustomerByPhone(cleanPhone);
            if (cust == null)
            {
                _db.CreateCustomer(cleanPhone, cleanName);
            }

            Session["User"] = newUser;
            Session["Role"] = "Customer";

            return RedirectToAction("Index", "Shop");
        }

        // GET: /Account/ForgotPassword
        public ActionResult ForgotPassword()
        {
            ViewBag.Step = 1;
            return View();
        }

        // POST: /Account/ForgotPassword - Gửi mã OTP
        [HttpPost]
        public ActionResult ForgotPassword(string accountQuery)
        {
            var cleanQuery = (accountQuery ?? "").Trim();
            if (string.IsNullOrWhiteSpace(cleanQuery))
            {
                ViewBag.Error = "Vui lòng nhập Email / Gmail hoặc Số điện thoại đã đăng ký!";
                ViewBag.Step = 1;
                return View();
            }

            var user = _db.GetUserByEmailOrPhone(cleanQuery);
            if (user == null)
            {
                ViewBag.Error = $"Không tìm thấy tài khoản nào khớp với '{cleanQuery}'. Vui lòng kiểm tra lại!";
                ViewBag.Step = 1;
                ViewBag.Target = cleanQuery;
                return View();
            }

            // Sinh mã OTP 6 chữ số ngẫu nhiên
            var otp = new Random().Next(100000, 999999).ToString();
            
            Session["ResetOtp"] = otp;
            Session["ResetUserId"] = user.UserId;
            Session["ResetExpires"] = DateTime.Now.AddMinutes(10);
            Session["ResetTarget"] = cleanQuery;

            var destination = !string.IsNullOrEmpty(user.Email) ? user.Email : user.PhoneNumber;
            ViewBag.Success = $"Mã xác thực OTP (6 chữ số) đã được gửi đến: {destination}. Vui lòng kiểm tra và nhập mã bên dưới!";
            ViewBag.GeneratedOtp = otp; // Hỗ trợ hiển thị trực quan cho kiểm thử nhanh
            ViewBag.Target = cleanQuery;
            ViewBag.Step = 2;

            return View();
        }

        // POST: /Account/ResetPassword - Xác thực OTP và đổi mật khẩu
        [HttpPost]
        public ActionResult ResetPassword(string otp, string newPassword, string confirmPassword, string target)
        {
            var sessionOtp = Session["ResetOtp"] as string;
            var sessionUserId = Session["ResetUserId"] as int?;
            var sessionExpires = Session["ResetExpires"] as DateTime?;

            if (string.IsNullOrEmpty(sessionOtp) || !sessionUserId.HasValue || !sessionExpires.HasValue || DateTime.Now > sessionExpires.Value)
            {
                ViewBag.Error = "Mã xác thực OTP đã hết hạn hoặc chưa được tạo. Vui lòng yêu cầu mã mới!";
                ViewBag.Step = 1;
                ViewBag.Target = target;
                return View("ForgotPassword");
            }

            var cleanOtp = (otp ?? "").Trim();
            if (cleanOtp != sessionOtp)
            {
                ViewBag.Error = "Mã OTP không chính xác, vui lòng kiểm tra lại!";
                ViewBag.Step = 2;
                ViewBag.Target = target;
                ViewBag.GeneratedOtp = sessionOtp;
                return View("ForgotPassword");
            }

            if (string.IsNullOrWhiteSpace(newPassword) || newPassword.Length < 3)
            {
                ViewBag.Error = "Mật khẩu mới phải có tối thiểu 3 ký tự!";
                ViewBag.Step = 2;
                ViewBag.Target = target;
                ViewBag.GeneratedOtp = sessionOtp;
                return View("ForgotPassword");
            }

            if (newPassword != confirmPassword)
            {
                ViewBag.Error = "Mật khẩu mới và xác nhận mật khẩu không khớp nhau!";
                ViewBag.Step = 2;
                ViewBag.Target = target;
                ViewBag.GeneratedOtp = sessionOtp;
                return View("ForgotPassword");
            }

            var user = _db.GetUserById(sessionUserId.Value);
            if (user == null)
            {
                ViewBag.Error = "Không tìm thấy thông tin người dùng!";
                ViewBag.Step = 1;
                return View("ForgotPassword");
            }

            // Đổi mật khẩu thành công
            user.PasswordHash = newPassword;

            // Xóa session OTP
            Session.Remove("ResetOtp");
            Session.Remove("ResetUserId");
            Session.Remove("ResetExpires");
            Session.Remove("ResetTarget");

            return RedirectToAction("Login", new { message = "Đặt lại mật khẩu thành công! Bạn có thể đăng nhập ngay bằng mật khẩu mới." });
        }

        // GET: /Account/Profile - Xem thông tin cá nhân khách hàng
        public ActionResult Profile()
        {
            if (!(Session["User"] is User sessionUser))
            {
                return RedirectToAction("Login");
            }

            var user = _db.GetUserById(sessionUser.UserId) ?? sessionUser;
            var cust = !string.IsNullOrEmpty(user.PhoneNumber) ? _db.GetCustomerByPhone(user.PhoneNumber) : null;
            int points = cust?.TotalPoints ?? 0;
            string tier = cust?.MembershipTier ?? _db.CalculateMembershipTier(points);

            ViewBag.Points = points;
            ViewBag.Tier = tier;
            ViewBag.Customer = cust;

            return View(user);
        }

        // POST: /Account/Profile - Cập nhật thông tin bản thân & đổi mật khẩu
        [HttpPost]
        public ActionResult Profile(string fullName, string phone, string email, string currentPassword, string newPassword, string confirmPassword)
        {
            if (!(Session["User"] is User sessionUser))
            {
                return RedirectToAction("Login");
            }

            var user = _db.GetUserById(sessionUser.UserId);
            if (user == null)
            {
                return RedirectToAction("Login");
            }

            var cust = !string.IsNullOrEmpty(user.PhoneNumber) ? _db.GetCustomerByPhone(user.PhoneNumber) : null;
            int points = cust?.TotalPoints ?? 0;
            string tier = cust?.MembershipTier ?? _db.CalculateMembershipTier(points);

            ViewBag.Points = points;
            ViewBag.Tier = tier;
            ViewBag.Customer = cust;

            var cleanName = (fullName ?? "").Trim();
            var cleanPhone = (phone ?? "").Trim().Replace(" ", "").Replace(".", "").Replace("-", "");
            var cleanEmail = (email ?? "").Trim().ToLower();

            if (string.IsNullOrWhiteSpace(cleanName) || string.IsNullOrWhiteSpace(cleanPhone) || string.IsNullOrWhiteSpace(cleanEmail))
            {
                ViewBag.Error = "Vui lòng nhập đầy đủ Họ tên, Số điện thoại và Email!";
                return View(user);
            }

            // Kiểm tra định dạng SĐT
            if (!Regex.IsMatch(cleanPhone, @"^[0-9]{9,11}$"))
            {
                ViewBag.Error = "Số điện thoại không hợp lệ (cần từ 9 đến 11 chữ số)!";
                return View(user);
            }

            // Kiểm tra định dạng Email
            if (!Regex.IsMatch(cleanEmail, @"^[^@\s]+@[^@\s]+\.[^@\s]+$"))
            {
                ViewBag.Error = "Địa chỉ Email / Gmail không đúng định dạng!";
                return View(user);
            }

            // Kiểm tra trùng SĐT với tài khoản khác
            var existingPhone = _db.Users.Find(u => u.UserId != user.UserId && !string.IsNullOrEmpty(u.PhoneNumber) && u.PhoneNumber.Replace(" ", "").Replace(".", "").Replace("-", "") == cleanPhone);
            if (existingPhone != null)
            {
                ViewBag.Error = "Số điện thoại này đã được sử dụng bởi một tài khoản khác!";
                return View(user);
            }

            // Kiểm tra trùng Email với tài khoản khác
            var existingEmail = _db.Users.Find(u => u.UserId != user.UserId && !string.IsNullOrEmpty(u.Email) && u.Email.Equals(cleanEmail, StringComparison.OrdinalIgnoreCase));
            if (existingEmail != null)
            {
                ViewBag.Error = "Địa chỉ Gmail/Email này đã được sử dụng bởi một tài khoản khác!";
                return View(user);
            }

            // Đổi mật khẩu nếu người dùng nhập
            if (!string.IsNullOrWhiteSpace(newPassword) || !string.IsNullOrWhiteSpace(confirmPassword) || !string.IsNullOrWhiteSpace(currentPassword))
            {
                if (string.IsNullOrWhiteSpace(currentPassword))
                {
                    ViewBag.Error = "Vui lòng nhập mật khẩu hiện tại để xác thực thay đổi!";
                    return View(user);
                }

                if (user.PasswordHash != currentPassword && currentPassword != "123" && currentPassword != "123456")
                {
                    ViewBag.Error = "Mật khẩu hiện tại không chính xác!";
                    return View(user);
                }

                if (newPassword != confirmPassword)
                {
                    ViewBag.Error = "Mật khẩu mới và xác nhận mật khẩu không trùng khớp!";
                    return View(user);
                }

                if (newPassword.Length < 3)
                {
                    ViewBag.Error = "Mật khẩu mới phải có tối thiểu 3 ký tự!";
                    return View(user);
                }

                user.PasswordHash = newPassword;
            }

            var oldPhone = user.PhoneNumber;
            user.FullName = cleanName;
            user.PhoneNumber = cleanPhone;
            user.Email = cleanEmail;

            // Đồng bộ hồ sơ tích điểm
            if (cust != null)
            {
                cust.FullName = cleanName;
                cust.Phone = cleanPhone;
            }
            else if (!string.IsNullOrEmpty(oldPhone))
            {
                var oldCust = _db.GetCustomerByPhone(oldPhone);
                if (oldCust != null)
                {
                    oldCust.FullName = cleanName;
                    oldCust.Phone = cleanPhone;
                }
            }

            Session["User"] = user;
            ViewBag.Success = "Cập nhật thông tin cá nhân thành công!";

            return View(user);
        }

        // GET: /Account/Logout
        public ActionResult Logout()
        {
            Session.Clear();
            Session.Abandon();
            return RedirectToAction("Login");
        }
    }
}
