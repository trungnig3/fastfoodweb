using System.ComponentModel.DataAnnotations;

namespace FastFoodWeb.Models
{
    public class Category
    {
        [Key]
        public int CategoryId { get; set; }
        
        [Required, MaxLength(100)]
        public string CategoryName { get; set; }
        
        public ICollection<Product> Products { get; set; }
    }
}