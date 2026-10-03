using Microsoft.EntityFrameworkCore;
using FastFoodWeb.Models;

namespace FastFoodWeb.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }
        public DbSet<Complaint> Complaints { get; set; }
        public DbSet<Shift> Shifts { get; set; }
        public DbSet<Role> Roles { get; set; }
        public DbSet<User> Users { get; set; }
        public DbSet<Category> Categories { get; set; }
        public DbSet<Product> Products { get; set; }
        public DbSet<Customer> Customers { get; set; }
        public DbSet<PointHistory> PointHistories { get; set; }
        public DbSet<Order> Orders { get; set; }
        public DbSet<OrderDetail> OrderDetails { get; set; }
        public DbSet<Ingredient> Ingredients { get; set; }
        public DbSet<ComboDetail> ComboDetails { get; set; }
        public DbSet<ProductRecipe> ProductRecipes { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Cấu hình khóa chính kép cho bảng ComboDetail
            modelBuilder.Entity<ComboDetail>()
                .HasKey(c => new { c.ComboId, c.ProductId });

            // Cấu hình khóa chính kép cho bảng ProductRecipe
            modelBuilder.Entity<ProductRecipe>()
                .HasKey(p => new { p.ProductId, p.IngredientId });
        }
    }
}