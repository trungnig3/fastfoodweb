using System.ComponentModel.DataAnnotations;

namespace FastFoodWeb.Models
{
    public class User
    {
        [Key]
        public int UserId { get; set; }

        [Required(ErrorMessage = "Vui lòng nhập tên đăng nhập")]
        [StringLength(50)]
        [Display(Name = "Tên đăng nhập")]
        public string Username { get; set; }

        [Required(ErrorMessage = "Vui lòng nhập mật khẩu")]
        [StringLength(255)]
        [Display(Name = "Mật khẩu")]
        public string PasswordHash { get; set; }

        [Required(ErrorMessage = "Vui lòng nhập họ và tên")]
        [StringLength(100)]
        [Display(Name = "Họ và tên")]
        public string FullName { get; set; }

        [Display(Name = "Vai trò")]
        public int RoleId { get; set; }

        [Display(Name = "Lương theo giờ (VNĐ)")]
        public decimal HourlyRate { get; set; } = 25000;

        [Display(Name = "Đang hoạt động")]
        public bool IsActive { get; set; } = true;

        [StringLength(20)]
        [Display(Name = "Số điện thoại")]
        public string PhoneNumber { get; set; }

        [StringLength(100)]
        [Display(Name = "Email / Gmail")]
        public string Email { get; set; }

        public virtual Role Role { get; set; }
    }
}
