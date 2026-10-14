using System;

namespace FastFoodExpress.Models
{
    public class Shift
    {
        public int ShiftId { get; set; }
        public int UserId { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime? EndTime { get; set; }
        public decimal StartingCash { get; set; }
        public decimal ActualCash { get; set; }
        public decimal CashDifference { get; set; }
        public double TotalHours { get; set; }
        public double StandardHours { get; set; }
        public double OvertimeHours { get; set; }
        public decimal OvertimeBonus { get; set; }
        public decimal TotalSalary { get; set; }
    }
}
