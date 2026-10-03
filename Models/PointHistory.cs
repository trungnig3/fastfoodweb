using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FastFoodWeb.Models
{
    public class PointHistory
    {
        [Key]
        public int HistoryId { get; set; }
        
        public int CustomerId { get; set; }
        [ForeignKey("CustomerId")]
        public virtual Customer Customer { get; set; }
        
        public int Points { get; set; } // Số điểm cộng hoặc trừ
        
        public DateTime TransactionDate { get; set; } = DateTime.Now;
        
        [MaxLength(255)]
        public string Description { get; set; } // Lý do cộng/trừ điểm
    }
}