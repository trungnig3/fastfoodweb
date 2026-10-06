using System;
using System.ComponentModel.DataAnnotations;

namespace FastFoodWeb.Models
{
    public class Product
    {
        [Key]
        public int ProductId { get; set; }

        [Required(ErrorMessage = "Vui lòng nhập tên món ăn")]
        [StringLength(150)]
        [Display(Name = "Tên món ăn")]
        public string ProductName { get; set; }

        [Display(Name = "Mô tả")]
        public string Description { get; set; }

        [Required(ErrorMessage = "Vui lòng nhập giá bán")]
        [Range(0, 100000000, ErrorMessage = "Giá bán không hợp lệ")]
        [Display(Name = "Giá bán (VNĐ)")]
        public decimal Price { get; set; }

        [Display(Name = "Hình ảnh")]
        public string ImageURL { get; set; }

        [Display(Name = "Là Combo tiết kiệm")]
        public bool IsCombo { get; set; }

        [Display(Name = "Đang kinh doanh")]
        public bool IsActive { get; set; } = true;

        [Required(ErrorMessage = "Vui lòng chọn danh mục")]
        [Display(Name = "Danh mục")]
        public int CategoryId { get; set; }

        [Display(Name = "Tồn kho thực tế")]
        [Range(0, 100000, ErrorMessage = "Số lượng tồn kho không hợp lệ")]
        public int StockQuantity { get; set; } = 50;

        // Navigation Property
        public virtual Category Category { get; set; }
    }
}
