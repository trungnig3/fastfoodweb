using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace FastFoodWeb.Models
{
    public class Customer
    {
        [Key]
        public int CustomerId { get; set; }

        [Required(ErrorMessage = "Vui lòng nhập số điện thoại")]
        [StringLength(20)]
        [Display(Name = "Số điện thoại")]
        public string Phone { get; set; }

        [Required(ErrorMessage = "Vui lòng nhập họ và tên")]
        [StringLength(100)]
        [Display(Name = "Họ và tên")]
        public string FullName { get; set; }

        [Display(Name = "Điểm tích lũy")]
        public int TotalPoints { get; set; } = 0;

        [Display(Name = "Hạng thành viên")]
        public string MembershipTier { get; set; } = "Đồng";

        public virtual ICollection<Order> Orders { get; set; } = new List<Order>();
        public virtual ICollection<PointHistory> PointHistories { get; set; } = new List<PointHistory>();
    }
}
