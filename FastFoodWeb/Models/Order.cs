using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace FastFoodWeb.Models
{
    public class Order
    {
        [Key]
        public int OrderId { get; set; }

        [Required]
        [StringLength(50)]
        [Display(Name = "Mã đơn hàng")]
        public string OrderCode { get; set; }

        public int CashierId { get; set; } = 1;

        public int? CustomerId { get; set; }

        [Display(Name = "Ngày đặt")]
        public DateTime OrderDate { get; set; } = DateTime.Now;

        [Display(Name = "Trạng thái đơn hàng")]
        public string OrderStatus { get; set; } = "Pending"; // 'Pending' | 'Đang xử lý' | 'Đang giao' | 'Hoàn tất' | 'Đã hủy'

        [Display(Name = "Phương thức thanh toán")]
        public string PaymentMethod { get; set; } = "Tiền mặt (COD)";

        [Display(Name = "Tiền hàng")]
        public decimal SubTotal { get; set; }

        [Display(Name = "Giảm giá tích điểm")]
        public decimal DiscountAmount { get; set; } = 0;

        [Display(Name = "Phí giao hàng")]
        public decimal ShippingFee { get; set; } = 0;

        [Display(Name = "Tổng thanh toán")]
        public decimal TotalAmount { get; set; }

        [Display(Name = "Địa chỉ giao hàng")]
        public string ShippingAddress { get; set; }

        [Display(Name = "Số điện thoại nhận")]
        public string CustomerPhone { get; set; }

        [Display(Name = "Tên khách hàng")]
        public string CustomerName { get; set; }

        [Display(Name = "Tài xế giao hàng")]
        public string ShipperName { get; set; }

        [Display(Name = "SĐT Tài xế")]
        public string ShipperPhone { get; set; }

        [Display(Name = "Trạng thái giao hàng")]
        public string ShippingStatus { get; set; } = "Đang chuẩn bị món";

        [Display(Name = "Ghi chú")]
        public string Notes { get; set; }

        // Navigation Properties
        public virtual User Cashier { get; set; }
        public virtual Customer Customer { get; set; }
        public virtual ICollection<OrderDetail> OrderDetails { get; set; } = new List<OrderDetail>();
    }
}
