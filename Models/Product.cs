using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FastFoodWeb.Models
{
    public class Product
    {
        [Key]
        public int ProductId { get; set; }
        
        [Required, MaxLength(100)]
        public string ProductName { get; set; }
        public int StockQuantity { get; set; } = 100; // Số lượng tồn kho mặc định

        public int CategoryId { get; set; }
        [ForeignKey("CategoryId")]
        public virtual Category Category { get; set; }
        
        public decimal Price { get; set; }
        public string ImageURL { get; set; }
        
        public bool IsCombo { get; set; } = false;
        public bool IsActive { get; set; } = true;
    }
}