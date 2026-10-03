using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FastFoodWeb.Models
{
    public class User
    {
        [Key]
        public int UserId { get; set; }
        
        [Required, MaxLength(50)]
        public string Username { get; set; }
        
        [Required]
        public string PasswordHash { get; set; }
        
        [Required, MaxLength(100)]
        public string FullName { get; set; }
        public decimal HourlyRate { get; set; } = 25000; // Mức lương mặc định 25.000đ/giờ

        public int RoleId { get; set; }
        [ForeignKey("RoleId")]
        public virtual Role Role { get; set; }
        
        public bool IsActive { get; set; } = true;
    }

    public class Role
    {
        [Key]
        public int RoleId { get; set; }
        [Required, MaxLength(50)]
        public string RoleName { get; set; }
        
        public virtual ICollection<User> Users { get; set; }
    }
}