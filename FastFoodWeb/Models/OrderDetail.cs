using System.ComponentModel.DataAnnotations;

namespace FastFoodWeb.Models
{
    public class OrderDetail
    {
        [Key]
        public int DetailId { get; set; }

        public int OrderId { get; set; }

        public int ProductId { get; set; }

        [Required]
        [Range(1, 10000)]
        [Display(Name = "Số lượng")]
        public int Quantity { get; set; }

        [Required]
        [Display(Name = "Đơn giá (VNĐ)")]
        public decimal UnitPrice { get; set; }

        public virtual Order Order { get; set; }
        public virtual Product Product { get; set; }
    }
}
