namespace FastFoodExpress.Models
{
    public class Customer
    {
        public int CustomerId { get; set; }
        public string Phone { get; set; }
        public string FullName { get; set; }
        public int TotalPoints { get; set; }
        public string MembershipTier { get; set; }
    }
}
