using System;
using System.Linq;
using FastFoodWeb.Models;

namespace FastFoodWeb.Services
{
    public class AiChatService
    {
        public static string ProcessMessage(string message, string baseUrl)
        {
            if (string.IsNullOrWhiteSpace(message))
            {
                return "Chào bạn! Tôi là Trợ Lý AI của FastFood Express. Bạn muốn xem thực đơn, hỏi giá hay đặt món gì hôm nay?";
            }

            var text = message.ToLower().Trim();

            if (text.Contains("chào") || text.Contains("hi") || text.Contains("hello"))
            {
                return "Xin chào quý khách! Cửa hàng đang có các món Gà rán giòn cay, Burger bò nướng phô mai và các Combo siêu tiết kiệm. Bạn muốn thưởng thức món nào ạ?";
            }

            if (text.Contains("thực đơn") || text.Contains("menu") || text.Contains("món gì") || text.Contains("danh sách"))
            {
                var db = FastFoodDb.Instance;
                var list = string.Join("\n", db.Products.Where(p => p.IsActive).Select(p => $"• {p.ProductName}: {p.Price:N0} đ"));
                return "Danh sách thực đơn hôm nay của quán:\n" + list + "\n\nBạn có thể nhấn trực tiếp vào nút 'Chọn Món' trên website để thêm vào giỏ nhé!";
            }

            if (text.Contains("gà") || text.Contains("ga ran"))
            {
                return "Quán có món 'Gà Rán Giòn Cay' giá 45.000 đ/miếng vỏ giòn rụm hoặc 'Combo 1 (Gà rán + Khoai tây + Pepsi)' giá chỉ 80.000 đ rất được ưa chuộng!";
            }

            if (text.Contains("burger"))
            {
                return "Burger Bò Phô Mai Nướng giá 55.000 đ với nhân thịt bò tươi mềm đẫm sốt BBQ, hoặc 'Combo 2 (Burger + Khoai + Pepsi)' giá 90.000 đ đang là Best Seller đấy ạ!";
            }

            if (text.Contains("khoai") || text.Contains("khoai tây"))
            {
                return "Khoai Tây Chiên Pháp cỡ lớn giòn tan giá chỉ 30.000 đ, dùng kèm tương cà, tương ớt hoặc sốt mayonnaise cực ngon!";
            }

            if (text.Contains("điểm") || text.Contains("tích điểm") || text.Contains("ưu đãi"))
            {
                return "Chính sách tích điểm thành viên: Cứ mỗi 10.000 đ mua sắm bạn được tích 1 điểm. Mỗi 1 điểm quy đổi trực tiếp thành 1.000 đ giảm giá vào đơn hàng tiếp theo!";
            }

            if (text.Contains("ship") || text.Contains("giao hàng") || text.Contains("phí ship"))
            {
                return "FastFood Express miễn phí giao hàng trong bán kính 2km! Ngoài 2km phí ship chỉ 5.000 đ/km tiếp theo, cam kết giao nóng hổi trong 30 phút!";
            }

            if (text.Contains("thanh toán") || text.Contains("vnpay"))
            {
                return "Quán hỗ trợ thanh toán tiền mặt khi nhận hàng (COD) hoặc quét mã VNPay QR thanh toán nhanh qua ứng dụng ngân hàng / ví điện tử!";
            }

            return "Cảm ơn bạn đã nhắn tin cho Trợ Lý AI. Tôi có thể giúp bạn xem thực đơn ('menu'), gợi ý món ăn ngon, hoặc kiểm tra chính sách tích điểm ('điểm')!";
        }
    }
}
