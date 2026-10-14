using System;

namespace FastFoodExpress.Models
{
    public class Review
    {
        public int ReviewId { get; set; }
        public string CustomerName { get; set; }
        public string CustomerPhone { get; set; }
        public int Rating { get; set; }
        public string Comment { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
