using System;
using System.ComponentModel.DataAnnotations;

namespace FastFoodWeb.Models
{
    public class Complaint
    {
        [Key]
        public int ComplaintId { get; set; }

        [Display(Name = "Khách hàng")]
        [StringLength(100)]
        public string CustomerName { get; set; }

        [Display(Name = "Số điện thoại")]
        [StringLength(20)]
        public string Phone { get; set; }

        [Required(ErrorMessage = "Vui lòng nhập nội dung khiếu nại")]
        [Display(Name = "Nội dung phản ánh")]
        public string Content { get; set; }

        [Display(Name = "Thời gian gửi")]
        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}
