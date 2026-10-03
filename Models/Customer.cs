using System.ComponentModel.DataAnnotations;

namespace FastFoodWeb.Models
{
    public class Customer
    {
        [Key]
        public int CustomerId { get; set; }
        
        [Required, MaxLength(15)]
        public string Phone { get; set; }
        
        [MaxLength(100)]
        public string FullName { get; set; }
        
        public int TotalPoints { get; set; } = 0;
        public string MembershipTier { get; set; } = "Bronze";
    }
}