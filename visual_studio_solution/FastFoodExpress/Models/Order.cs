using System;
using System.Collections.Generic;

namespace FastFoodExpress.Models
{
    public class OrderDetail
    {
        public int DetailId { get; set; }
        public int OrderId { get; set; }
        public int ProductId { get; set; }
        public string ProductName { get; set; }
        public int Quantity { get; set; }
        public decimal UnitPrice { get; set; }
    }

    public class Order
    {
        public int OrderId { get; set; }
        public string OrderCode { get; set; }
        public int CashierId { get; set; }
        public int? CustomerId { get; set; }
        public DateTime OrderDate { get; set; }
        public string OrderStatus { get; set; }
        public string PaymentMethod { get; set; }
        public decimal SubTotal { get; set; }
        public decimal DiscountAmount { get; set; }
        public decimal TotalAmount { get; set; }
        public decimal ShippingFee { get; set; }
        public string DeliveryAddress { get; set; }
        public string ShipperName { get; set; }
        public string ShipperPhone { get; set; }
        public string CustomerPhone { get; set; }
        public string CustomerName { get; set; }
        public List<OrderDetail> Details { get; set; } = new List<OrderDetail>();
    }
}
