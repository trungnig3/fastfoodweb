using System.ComponentModel.DataAnnotations;

namespace FastFoodWeb.Models
{
    public class Ingredient
    {
        [Key]
        public int IngredientId { get; set; }
        
        [Required, MaxLength(100)]
        public string IngredientName { get; set; }
        
        [Required, MaxLength(20)]
        public string Unit { get; set; } // kg, gram, lít, cái...
        
        public double StockQuantity { get; set; } = 0;
    }
}