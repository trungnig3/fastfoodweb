using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FastFoodWeb.Models
{
    public class Shift
    {
        [Key]
        public int ShiftId { get; set; }
        public int UserId { get; set; }
        [ForeignKey("UserId")]
        public User User { get; set; }

        public DateTime StartTime { get; set; }
        public DateTime? EndTime { get; set; }

        public double TotalHours { get; set; }

        // --- CÁC CỘT MỚI THÊM VÀO ---
        public double OvertimeHours { get; set; } // Số giờ tăng ca
        public decimal OvertimeBonus { get; set; } // Tiền thưởng tăng ca (x1.5)
        public decimal LatePenalty { get; set; } // Tiền phạt đi trễ

        public decimal TotalSalary { get; set; }
        public decimal StartingCash { get; set; } = 0; // Tiền mặt có sẵn trong két đầu ca
        public decimal ActualCash { get; set; } = 0; // Tiền thực tế thu ngân đếm được
        public decimal CashDifference { get; set; } = 0; // Tiền thừa/thiếu (Thực tế - Lý thuyết)
    }

    // ViewModel dùng để gộp dữ liệu đưa ra báo cáo
    public class SalaryReportViewModel
    {
        public string FullName { get; set; }
        public string Username { get; set; }
        public decimal HourlyRate { get; set; }
        public double TotalHours { get; set; }

        public double TotalOvertimeHours { get; set; }
        public decimal TotalOvertimeBonus { get; set; }
        public decimal TotalLatePenalty { get; set; }

        public decimal TotalSalary { get; set; }
    }
}