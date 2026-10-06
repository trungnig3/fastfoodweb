using System;
using System.ComponentModel.DataAnnotations;

namespace FastFoodWeb.Models
{
    public class PointHistory
    {
        [Key]
        public int HistoryId { get; set; }

        [Required]
        public int CustomerId { get; set; }

        [Display(Name = "Số điểm biến động")]
        public int Points { get; set; }

        [Display(Name = "Nội dung giao dịch")]
        [StringLength(255)]
        public string Description { get; set; }

        [Display(Name = "Thời gian")]
        public DateTime CreatedAt { get; set; } = DateTime.Now;

        public virtual Customer Customer { get; set; }
    }
}
