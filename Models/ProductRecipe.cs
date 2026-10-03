namespace FastFoodWeb.Models
{
    public class ProductRecipe
    {
        public int ProductId { get; set; }
        public int IngredientId { get; set; }
        public double QuantityRequired { get; set; }
    }
}