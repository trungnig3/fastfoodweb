using System;
using System.Collections.Generic;
using System.Linq;

namespace FastFoodExpress.Models
{
    public class DatabaseContext
    {
        public static List<Category> Categories { get; set; } = new List<Category>
        {
            new Category { CategoryId = 1, CategoryName = "Gà Rán Giòn" },
            new Category { CategoryId = 2, CategoryName = "Burger Bò" },
            new Category { CategoryId = 3, CategoryName = "Tráng Miệng & Nước" }
        };

        public static List<Product> Products { get; set; } = new List<Product>
        {
            new Product { ProductId = 1, ProductName = "Gà Rán Giòn Cay", Price = 35000, CategoryId = 1, StockQuantity = 50, IsActive = true, IsCombo = false, ImageURL = "https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?w=500" },
            new Product { ProductId = 2, ProductName = "Burger Bò Phô Mai", Price = 45000, CategoryId = 2, StockQuantity = 30, IsActive = true, IsCombo = false, ImageURL = "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500" },
            new Product { ProductId = 3, ProductName = "Khoai Tây Chiên (L)", Price = 25000, CategoryId = 3, StockQuantity = 40, IsActive = true, IsCombo = false, ImageURL = "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=500" },
            new Product { ProductId = 4, ProductName = "Nước Ngọt Pepsi", Price = 15000, CategoryId = 3, StockQuantity = 100, IsActive = true, IsCombo = false, ImageURL = "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500" },
            new Product { ProductId = 5, ProductName = "Combo 1: Gà Rán + Khoai + Pepsi", Price = 69000, CategoryId = 1, StockQuantity = 20, IsActive = true, IsCombo = true, ImageURL = "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=500" },
            new Product { ProductId = 6, ProductName = "Combo 2: Burger Bò + Khoai + Pepsi", Price = 79000, CategoryId = 2, StockQuantity = 15, IsActive = true, IsCombo = true, ImageURL = "https://images.unsplash.com/photo-1550547660-d9450f859349?w=500" }
        };

        public static List<User> Users { get; set; } = new List<User>
        {
            new User { UserId = 1, Username = "admin", PasswordHash = "admin123", FullName = "Quản Trị Viên", RoleId = 1, RoleName = "Admin", HourlyRate = 50000, IsActive = true },
            new User { UserId = 2, Username = "cashier", PasswordHash = "cashier123", FullName = "Thu Ngân Lan", RoleId = 2, RoleName = "Cashier", HourlyRate = 25000, IsActive = true }
        };

        public static List<Customer> Customers { get; set; } = new List<Customer>
        {
            new Customer { CustomerId = 1, Phone = "0987654321", FullName = "Nguyễn Văn A", TotalPoints = 120, MembershipTier = "Bạc" }
        };

        public static List<Shift> Shifts { get; set; } = new List<Shift>();
        public static List<Order> Orders { get; set; } = new List<Order>();
        public static List<Review> Reviews { get; set; } = new List<Review>();

        public static decimal ExpectedPreviousCash = 625000;
    }
}
