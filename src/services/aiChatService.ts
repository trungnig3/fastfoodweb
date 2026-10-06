import { db } from '../db.js';
import { createVnPayPaymentUrl } from './vnpayService.js';

export interface ChatBotResponse {
  reply: string;
}

export function handleChatBotMessage(message: string, reqBaseUrl: { protocol: string; host: string }): ChatBotResponse {
  const msg = (message || '').toLowerCase().trim();
  let reply = '';

  if (msg.includes('menu') || msg.includes('thực đơn') || msg.includes('món gì') || msg.includes('có gì')) {
    const products = db.products.filter(p => p.IsActive);
    if (!products.length) {
      reply = 'Hiện tại cửa hàng chưa có món ăn nào trong thực đơn.';
    } else {
      reply = '📜 **DANH SÁCH THỰC ĐƠN CỦA QUÁN:**\n';
      for (const p of products) {
        const typeLabel = p.IsCombo ? '🔥 [Combo]' : '🍔 [Món lẻ]';
        reply += `- ${p.ProductName} (${typeLabel}): **${Number(p.Price).toLocaleString('vi-VN')} đ**\n`;
      }
      reply += '\n💡 *Nhắn tên món + địa chỉ + cách thanh toán (Ví dụ: "Ship combo 2 về Cầu Giấy qua VNPAY").*';
    }
  } else {
    const allProducts = db.products.filter(p => p.IsActive);
    const orderedItems: { product: typeof allProducts[0]; quantity: number }[] = [];

    for (const prod of allProducts) {
      const pName = prod.ProductName.toLowerCase();
      let matched = false;

      if (pName.includes('combo 1') && msg.includes('combo 1')) matched = true;
      else if (pName.includes('combo 2') && msg.includes('combo 2')) matched = true;
      else if (pName.includes('gia đình') && (msg.includes('gia đình') || msg.includes('combo gia đình'))) matched = true;
      else if (pName.includes('gà rán') && (msg.includes('gà') || msg.includes('gà rán'))) matched = true;
      else if (pName.includes('burger') && msg.includes('burger')) matched = true;
      else if (pName.includes('khoai tây') && (msg.includes('khoai') || msg.includes('khoai tây'))) matched = true;
      else if (pName.includes('pepsi') && (msg.includes('pepsi') || msg.includes('nước'))) matched = true;
      else if (msg.includes(pName)) matched = true;

      if (matched && !orderedItems.some(x => x.product.ProductId === prod.ProductId)) {
        orderedItems.push({ product: prod, quantity: 1 });
      }
    }

    if (orderedItems.length > 0) {
      let address = 'Chưa rõ (Shipper sẽ gọi xác nhận)';
      const addressKeywords = ['giao về', 'ship về', 'giao đến', 'ship đến', 'tới', 'về', 'đến', 'tại', 'ở'];
      for (const kw of addressKeywords) {
        const idx = msg.indexOf(kw);
        if (idx >= 0) {
          address = message.substring(idx + kw.length).trim();
          break;
        }
      }

      const isVnPay = msg.includes('vnpay') || msg.includes('chuyển khoản') || msg.includes('ck') || msg.includes('online') || msg.includes('quẹt thẻ');
      const paymentStr = isVnPay ? 'Chuyển khoản VNPAY (AI Bot)' : 'Tiền mặt khi nhận hàng (AI Bot)';
      const totalAmount = orderedItems.reduce((acc, x) => acc + x.product.Price * x.quantity, 0);
      const shippingFee = 15000;
      const finalAmount = totalAmount + shippingFee;
      const orderCode = 'BOT' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + Math.floor(1000 + Math.random() * 9000);

      const shippers = [
        { name: 'Nguyễn Văn Giao', phone: '0901234567' },
        { name: 'Trần Đình Ship', phone: '0918889999' },
        { name: 'Lê Hoàng Tốc Độ', phone: '0987654321' }
      ];
      const randomShipper = shippers[Math.floor(Math.random() * shippers.length)];

      const order = db.createOrder({
        OrderCode: orderCode,
        CashierId: 1,
        OrderDate: new Date(),
        OrderStatus: 'Pending',
        PaymentMethod: paymentStr,
        SubTotal: totalAmount,
        TotalAmount: finalAmount,
        ShippingAddress: address,
        ShipperName: randomShipper.name,
        ShipperPhone: randomShipper.phone,
        ShippingStatus: 'Đang chuẩn bị món'
      });

      for (const item of orderedItems) {
        db.addOrderDetail({
          OrderId: order.OrderId,
          ProductId: item.product.ProductId,
          Quantity: item.quantity,
          UnitPrice: item.product.Price
        });
        item.product.StockQuantity = Math.max(0, item.product.StockQuantity - item.quantity);
      }

      const itemsSummary = orderedItems.map(x => `${x.quantity}x ${x.product.ProductName}`).join(', ');
      reply =
        `🎉 AI đã lên đơn thành công!\n` +
        `📦 Món: ${itemsSummary}\n` +
        `💰 Tổng tiền (gồm 15k Ship): ${finalAmount.toLocaleString('vi-VN')} đ\n` +
        `📍 Giao đến: ${address}\n` +
        `💳 Thanh toán: ${isVnPay ? 'VNPAY QR' : 'Tiền mặt'}\n` +
        `🛵 Tài xế: ${randomShipper.name} (${randomShipper.phone})\n` +
        `Mã đơn: ${orderCode}`;

      if (isVnPay) {
        const returnUrl = `${reqBaseUrl.protocol}://${reqBaseUrl.host}/Shop/PaymentCallback`;
        const paymentUrl = createVnPayPaymentUrl({
          amount: finalAmount,
          orderCode,
          orderInfo: `Thanh toan don hang ${orderCode}`,
          returnUrl
        });
        reply += `\n\n<a href='${paymentUrl}' target='_blank' style='display:inline-block; padding:8px 15px; background-color:#FF4757; color:white; text-decoration:none; border-radius:8px; font-weight:bold;'>💳 BẤM VÀO ĐÂY ĐỂ TRẢ TIỀN VNPAY</a>`;
      }
    } else {
      if (msg.includes('gà') || msg.includes('cay')) {
        reply = 'Gà Rán Giòn Cay giá 45.000đ/miếng rất ngon. Nhắn: "Gà rán về [địa chỉ]" để AI ship ngay nhé!';
      } else if (msg.includes('burger')) {
        reply = 'Burger Bò Phô Mai giá 55.000đ đậm vị. Nhắn "Burger về [địa chỉ]" để AI chốt đơn!';
      } else if (msg.includes('combo') || msg.includes('tiết kiệm')) {
        reply = 'Cửa hàng có Combo 1 (80k), Combo 2 (90k) và Combo Gia Đình (180k). Nhắn "Combo 2 về [địa chỉ] qua Vnpay" để đặt nha!';
      } else {
        reply =
          'Xin chào! Bạn có thể gõ **"menu"** để xem thực đơn, hoặc nhắn theo cú pháp: **[Tên món] + về [Địa chỉ] + qua [Vnpay/Tiền mặt]** để AI đặt hàng nhé.';
      }
    }
  }

  return { reply };
}
