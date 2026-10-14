namespace FastFoodExpress.Models
{
    public class Product
    {
        public int ProductId { get; set; }
        public string ProductName { get; set; }
        public string Description { get; set; }
        public decimal Price { get; set; }
        public string ImageURL { get; set; }
        public bool IsCombo { get; set; }
        public bool IsActive { get; set; }
        public int CategoryId { get; set; }
        public int StockQuantity { get; set; }
    }
}
