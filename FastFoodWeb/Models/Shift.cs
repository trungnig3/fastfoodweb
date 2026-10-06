using System;
using System.ComponentModel.DataAnnotations;

namespace FastFoodWeb.Models
{
    public class Shift
    {
        [Key]
        public int ShiftId { get; set; }

        public int UserId { get; set; }

        [Display(Name = "Bắt đầu ca")]
        public DateTime StartTime { get; set; } = DateTime.Now;

        [Display(Name = "Kết thúc ca")]
        public DateTime? EndTime { get; set; }

        [Display(Name = "Tiền đầu ca (VNĐ)")]
        public decimal StartingCash { get; set; } = 0;

        [Display(Name = "Tiền thực tế bàn giao (VNĐ)")]
        public decimal ActualCash { get; set; } = 0;

        [Display(Name = "Chênh lệch tiền mặt")]
        public decimal CashDifference { get; set; } = 0;

        [Display(Name = "Tổng số giờ làm")]
        public decimal TotalHours { get; set; } = 0;

        [Display(Name = "Giờ làm tiêu chuẩn")]
        public decimal StandardHours { get; set; } = 0;

        [Display(Name = "Số giờ tăng ca (OT)")]
        public decimal OvertimeHours { get; set; } = 0;

        [Display(Name = "Tiền thưởng tăng ca")]
        public decimal OvertimeBonus { get; set; } = 0;

        [Display(Name = "Phạt đi trễ / về sớm")]
        public decimal LatePenalty { get; set; } = 0;

        [Display(Name = "Tổng tiền lương ca (VNĐ)")]
        public decimal TotalSalary { get; set; } = 0;

        public virtual User User { get; set; }
    }
}
