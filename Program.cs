using FastFoodWeb.Data;
using FastFoodWeb.Models;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Đăng ký kết nối SQLite
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

// Cấu hình Cookie Authentication (Nhớ trạng thái đăng nhập ca làm việc)
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.LoginPath = "/Account/Login";
        options.AccessDeniedPath = "/Account/AccessDenied";
        options.ExpireTimeSpan = TimeSpan.FromHours(8); // Ca làm việc 8 tiếng
    });

builder.Services.AddControllersWithViews();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseRouting();

// BẬT AUTHENTICATION (Bắt buộc phải nằm TRƯỚC UseAuthorization)
app.UseAuthentication();
app.UseAuthorization();

// Load CSS, JavaScript, hình ảnh
app.MapStaticAssets();

// Tự động tạo tài khoản Admin mới khi khởi động ứng dụng
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

    // Kiểm tra xem đã có tài khoản admin2 chưa, nếu chưa thì tạo mới
    if (!db.Users.Any(u => u.Username == "admin2"))
    {
        var adminRole = db.Roles.FirstOrDefault(r => r.RoleName == "Admin");
        if (adminRole == null)
        {
            adminRole = new Role { RoleName = "Admin" };
            db.Roles.Add(adminRole);
            db.SaveChanges();
        }

        db.Users.Add(new User
        {
            Username = "admin2",
            PasswordHash = "123",
            FullName = "Quản Trị Viên Mới",
            RoleId = adminRole.RoleId,
            IsActive = true
        });
        db.SaveChanges();
    }
}

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}")
    .WithStaticAssets();

app.Run();