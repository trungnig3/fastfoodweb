using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FastFoodWeb.Models
{
    public class Order
    {
        [Key]
        public int OrderId { get; set; }
        
        [Required, MaxLength(20)]
        public string OrderCode { get; set; }
        
        public int CashierId { get; set; } // Nhân viên thu ngân
        [ForeignKey("CashierId")]
        public virtual User Cashier { get; set; }
        
        public int? CustomerId { get; set; } // Khách hàng (có thể null nếu khách lẻ không đọc SĐT)
        [ForeignKey("CustomerId")]
        public virtual Customer Customer { get; set; }
        
        public decimal SubTotal { get; set; }
        public decimal DiscountValue { get; set; } = 0;
        public decimal TotalAmount { get; set; }
        public string ShippingAddress { get; set; } // Địa chỉ giao hàng tận nơi
public string ShipperName { get; set; }     // Tên shipper nhận đơn
public string ShipperPhone { get; set; }    // SĐT shipper
public string ShippingStatus { get; set; } = "Đang chuẩn bị"; // Trạng thái giao hàng
        public string PaymentMethod { get; set; } // Tiền mặt, VNPAY...
        public string OrderStatus { get; set; } = "Completed";
        public DateTime OrderDate { get; set; } = DateTime.Now;
        
        public ICollection<OrderDetail> OrderDetails { get; set; }
    }
}