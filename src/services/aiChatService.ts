import { GoogleGenAI } from '@google/genai';
import { db } from '../db.js';
import { createVnPayPaymentUrl } from './vnpayService.js';

export interface ChatBotResponse {
  reply: string;
  orderCode?: string;
  paymentUrl?: string;
}

// Khởi tạo Gemini AI client từ server-side SDK
let aiClient: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  aiClient = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Hàm chuẩn hóa tiếng Việt không dấu để matching từ khóa thông minh
function removeVietnameseTones(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

/**
 * Xử lý tin nhắn của người dùng gửi đến Trợ lý AI (kết hợp Gemini 3.8 Flash và Rule-based Ordering)
 */
export async function handleChatBotMessage(
  message: string,
  reqBaseUrl: { protocol: string; host: string }
): Promise<ChatBotResponse> {
  const rawMsg = (message || '').normalize('NFC').trim();
  if (!rawMsg) {
    return {
      reply: '👋 Xin chào! Tôi là Trợ lý AI của FastFood Express. Bạn cần xem thực đơn, tư vấn món ngon hay đặt hàng giao tận nơi cứ nhắn cho tôi nhé! 🍔🍟'
    };
  }

  const msg = rawMsg.toLowerCase();
  const noTone = removeVietnameseTones(rawMsg);

  // 1. KIỂM TRA ĐẶT MÓN TỰ ĐỘNG (NẾU CÓ TÊN MÓN + ĐỊA CHỈ HOẶC CÚ PHÁP ĐẶT HÀNG)
  const allProducts = db.products.filter(p => p.IsActive);
  const orderedItems: { product: typeof allProducts[0]; quantity: number }[] = [];

  function extractQuantity(keyword: string): number {
    const regex = new RegExp(`(\\d+)\\s*(?:phần|ly|miếng|cái|lon|chai|suất|x)?\\s*${keyword}`, 'i');
    const match = msg.match(regex);
    if (match && match[1]) {
      return Math.max(1, Math.min(20, parseInt(match[1], 10)));
    }
    return 1;
  }

  const hasOrderIntent =
    noTone.includes('ve ') ||
    noTone.includes('den ') ||
    noTone.includes('dia chi') ||
    noTone.includes('ship') ||
    noTone.includes('giao') ||
    noTone.includes('dat') ||
    noTone.includes('mua') ||
    noTone.includes('order') ||
    noTone.includes('lay cho');

  if (hasOrderIntent) {
    for (const prod of allProducts) {
      const pNoTone = removeVietnameseTones(prod.ProductName);
      let isMatched = false;
      let qty = 1;

      if (pNoTone.includes('combo 1') && (noTone.includes('combo 1') || noTone.includes('set 1'))) {
        isMatched = true;
        qty = extractQuantity('combo 1');
      } else if (pNoTone.includes('combo 2') && (noTone.includes('combo 2') || noTone.includes('set 2'))) {
        isMatched = true;
        qty = extractQuantity('combo 2');
      } else if (
        pNoTone.includes('gia dinh') &&
        (noTone.includes('gia dinh') || noTone.includes('combo gia dinh') || noTone.includes('combo 3'))
      ) {
        isMatched = true;
        qty = extractQuantity('gia dinh');
      } else if (
        pNoTone.includes('ga ran') &&
        (noTone.includes('ga ran') || noTone.includes('ga cay') || (noTone.includes('ga') && !noTone.includes('burger') && !noTone.includes('combo')))
      ) {
        isMatched = true;
        qty = extractQuantity('ga');
      } else if (
        pNoTone.includes('burger') &&
        (noTone.includes('burger') || noTone.includes('banh mi') || noTone.includes('bo pho mai'))
      ) {
        isMatched = true;
        qty = extractQuantity('burger');
      } else if (
        pNoTone.includes('khoai tay') &&
        (noTone.includes('khoai tay') || noTone.includes('khoai chien') || (noTone.includes('khoai') && !noTone.includes('combo')))
      ) {
        isMatched = true;
        qty = extractQuantity('khoai');
      } else if (
        (pNoTone.includes('pepsi') || pNoTone.includes('nuoc ngot')) &&
        (noTone.includes('pepsi') || noTone.includes('nuoc ngot') || noTone.includes('nuoc uong') || noTone.includes('coca') || (noTone.includes('nuoc') && !noTone.includes('khoai')))
      ) {
        isMatched = true;
        qty = extractQuantity('pepsi');
      } else if (
        pNoTone.includes('sundae') &&
        (noTone.includes('kem') || noTone.includes('sundae') || noTone.includes('dau tay'))
      ) {
        isMatched = true;
        qty = extractQuantity('kem');
      } else if (noTone.includes(pNoTone)) {
        isMatched = true;
        qty = 1;
      }

      if (isMatched && !orderedItems.some(x => x.product.ProductId === prod.ProductId)) {
        orderedItems.push({ product: prod, quantity: qty });
      }
    }

    // Nếu nhận diện được món và có ý định đặt hàng
    if (orderedItems.length > 0) {
      let address = '';
      const addressKeywords = ['giao ve', 'ship ve', 'giao den', 'ship den', 'dia chi', 'toi', 've', 'den', 'tai', 'o'];
      for (const kw of addressKeywords) {
        const idx = noTone.indexOf(kw);
        if (idx >= 0) {
          address = rawMsg.substring(idx + kw.length).trim();
          break;
        }
      }

      address = address
        .replace(/(?:qua|bằng|thanh toán|trả|bằng cách)\s*(?:tiền mặt|tien mat|vnpay|chuyển khoản|ck|cod|online|qr)/gi, '')
        .replace(/(?:tiền mặt|tien mat|vnpay|chuyển khoản|ck|cod|online)/gi, '')
        .replace(/^[,\s.-]+|[,\s.-]+$/g, '')
        .trim();

      if (!address || address.length < 2) {
        address = 'Địa chỉ khách cung cấp (Shipper sẽ liên hệ xác nhận)';
      }

      const isVnPay =
        noTone.includes('vnpay') ||
        noTone.includes('chuyen khoan') ||
        noTone.includes('ck') ||
        noTone.includes('online') ||
        noTone.includes('quet the') ||
        noTone.includes('qr');

      const paymentStr = isVnPay ? 'Chuyển khoản VNPAY (AI Bot)' : 'Tiền mặt khi nhận hàng (COD)';
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

      // Tạo đơn hàng vào cơ sở dữ liệu
      const order = db.createOrder({
        OrderCode: orderCode,
        CashierId: 1,
        OrderDate: new Date(),
        OrderStatus: 'Pending',
        PaymentMethod: paymentStr,
        SubTotal: totalAmount,
        ShippingFee: shippingFee,
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

      const itemsSummary = orderedItems
        .map(x => `• **${x.quantity}x ${x.product.ProductName}** (${(x.product.Price * x.quantity).toLocaleString('vi-VN')} đ)`)
        .join('\n');

      let reply =
        `🎉 **AI ĐÃ LÊN ĐƠN HÀNG THÀNH CÔNG!**\n\n` +
        `🧾 **Mã đơn:** \`${orderCode}\`\n` +
        `📦 **Món ăn:**\n${itemsSummary}\n` +
        `🚚 **Phí giao hàng:** 15.000 đ\n` +
        `💰 **TỔNG CỘNG:** **${finalAmount.toLocaleString('vi-VN')} đ**\n` +
        `📍 **Địa chỉ:** ${address}\n` +
        `💳 **Thanh toán:** ${isVnPay ? 'VNPAY QR Online' : 'Tiền mặt khi nhận hàng (COD)'}\n` +
        `🛵 **Shipper phụ trách:** ${randomShipper.name} (${randomShipper.phone})\n\n` +
        `*Đầu bếp đang chuẩn bị món ăn nóng hổi cho bạn! Quý khách có thể bấm "Theo Dõi Đơn" với mã \`${orderCode}\` để theo dõi đơn nhé!*`;

      let paymentUrl = '';
      if (isVnPay) {
        const returnUrl = `${reqBaseUrl.protocol}://${reqBaseUrl.host}/Shop/PaymentCallback`;
        paymentUrl = createVnPayPaymentUrl({
          amount: finalAmount,
          orderCode,
          orderInfo: `Thanh toan don hang ${orderCode}`,
          returnUrl
        });
        reply += `\n\n<div style='margin-top: 10px;'><a href='${paymentUrl}' target='_blank' style='display:inline-block; padding:10px 18px; background-color:#E11D48; color:white; text-decoration:none; border-radius:8px; font-weight:bold; font-size:14px; box-shadow: 0 4px 10px rgba(225,29,72,0.3);'>💳 BẤM VÀO ĐÂY ĐỂ THANH TOÁN VNPAY NGAY</a></div>`;
      }

      return { reply, orderCode, paymentUrl };
    }
  }

  // 2. NẾU CÓ GEMINI AI CLIENT -> GỌI GOOGLE GEMINI MODEL GEMINI-3.8-FLASH ĐỂ TRẢ LỜI CỰC THÔNG MINH
  if (aiClient) {
    try {
      const activeProducts = db.products.filter(p => p.IsActive);
      const menuContext = activeProducts
        .map(p => `- ${p.ProductName} (${p.IsCombo ? 'Combo' : 'Món lẻ'}): ${Number(p.Price).toLocaleString('vi-VN')} đ [Còn ${p.StockQuantity} phần]. Mô tả: ${p.Description || 'Thơm ngon nóng hổi'}`)
        .join('\n');

      const reviewStats = db.getReviewStats();

      const systemInstruction = `Bạn là Trợ lý AI Ẩm Thực thông minh, thân thiện, chuyên nghiệp của chuỗi cửa hàng đồ ăn nhanh "FastFood Express".
Nhiệm vụ của bạn là tư vấn món ăn, giải đáp thực đơn, tính toán calo/dinh dưỡng, hướng dẫn đặt món và trò chuyện vui vẻ với khách hàng.

THÔNG TIN CỬA HÀNG:
- Tên: FastFood Express (Chuỗi thức ăn nhanh hảo hạng)
- Địa chỉ: 123 Đường Ẩm Thực, Quận Cầu Giấy, Hà Nội (CN2: Quận 1, TP. Hồ Chí Minh)
- Giờ mở cửa: 08:00 - 22:30 mỗi ngày
- Hotline 24/7: 1900 6868 hoặc 0987.654.321
- Phí ship: 15.000 đ cố định, giao nhanh 30 phút nóng giòn
- Hình thức thanh toán: Tiền mặt khi nhận hàng (COD) hoặc Quét mã VNPAY QR Online
- Điểm tích lũy: Mỗi 10.000 đ tích 1 điểm (1 điểm = 100 đ giảm giá). Hạng thẻ: Đồng, Bạc, Vàng, Kim Cương.
- Đánh giá khách hàng: Trung bình ${reviewStats.avgFormatted}/5 sao (${reviewStats.total} lượt đánh giá).

THỰC ĐƠN HIỆN CÓ TẠI QUÁN:
${menuContext}

HƯỚNG DẪN ĐẶT MÓN TỰ ĐỘNG QUA AI:
Khách chỉ cần nhắn cú pháp: "[Tên món] + về [Địa chỉ] + qua [VNPAY/Tiền mặt]" (Ví dụ: "2 gà rán về Cầu Giấy qua Vnpay" hoặc "Burger bò về số 5 Kim Mã tiền mặt") thì hệ thống sẽ tự động lên đơn ngay.

QUY TẮC PHẢN HỒI:
- Trả lời bằng tiếng Việt tự nhiên, ấm áp, lịch sự, có emoji sinh động (🍔, 🍗, 🍟, 🥤, ✨, 🛵).
- Sử dụng định dạng Markdown rõ ràng (in đậm tên món, gạch đầu dòng danh sách).
- Không bịa đặt món không có trong thực đơn hoặc thông tin sai lệch.
- Luôn sẵn sàng mời khách đặt món để thưởng thức ngay.`;

      const response = await aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: rawMsg,
        config: {
          systemInstruction
        }
      });

      const aiReply = response.text?.trim();
      if (aiReply) {
        return { reply: aiReply };
      }
    } catch (err: any) {
      console.warn('Gemini API call notice, falling back to local handler:', err?.message || err);
    }
  }

  // 3. FALLBACK: BỘ LUẬT XỬ LÝ NỘI BỘ NẾU KHÔNG CÓ GEMINI KEY HOẶC MẤT KẾT NỐI
  // Chitchat
  if (
    noTone.includes('dep trai') ||
    noTone.includes('xinh gai') ||
    noTone.includes('dep khong') ||
    noTone.includes('khen')
  ) {
    return {
      reply:
        '✨ Bạn siêu đẹp trai, dễ thương và có gu ẩm thực cực đỉnh luôn ạ! 😎🍔 Bạn muốn nạp năng lượng với món gì thơm ngon nóng hổi hôm nay để tự tin toả sáng hơn nào?'
    };
  }

  if (
    noTone === 'hi' ||
    noTone === 'hello' ||
    noTone === 'chao' ||
    noTone === 'xin chao' ||
    noTone.startsWith('chao shop') ||
    noTone.startsWith('alo') ||
    noTone.startsWith('chao ban')
  ) {
    return {
      reply:
        '👋 Dạ FastFood Express xin chào bạn! Hôm nay bạn muốn ăn Gà Rán Giòn Cay, Burger Bò Phô Mai hay các Set Combo tiết kiệm nào? Bạn chỉ cần nhắn tên món + địa chỉ, AI sẽ tự động lên đơn giao tận nơi trong 30 phút nhé! 🍟🛵'
    };
  }

  if (noTone.includes('o dau') || noTone.includes('dia chi') || noTone.includes('chi nhanh')) {
    return {
      reply:
        '🏠 Cửa hàng chính: **123 Đường Ẩm Thực, Quận Cầu Giấy, Hà Nội** (Chi nhánh 2: Quận 1, TP. Hồ Chí Minh).\n⏰ Mở cửa phục vụ: **08:00 - 22:30** mỗi ngày.\n🛵 Quán giao hàng siêu tốc tận nơi chỉ trong 30 phút!'
    };
  }

  if (noTone.includes('hotline') || noTone.includes('so dien thoai') || noTone.includes('sdt') || noTone.includes('lien he')) {
    return {
      reply:
        '📞 Hotline hỗ trợ đặt món & phản hồi 24/7: **1900 6868** hoặc **0987.654.321**.\nQuý khách có thể gọi trực tiếp hoặc gửi đánh giá trên hệ thống nhé!'
    };
  }

  // Tra cứu thực đơn
  if (
    noTone.includes('menu') ||
    noTone.includes('thuc don') ||
    noTone.includes('mon gi') ||
    noTone.includes('co gi') ||
    noTone.includes('ban gi')
  ) {
    const products = db.products.filter(p => p.IsActive);
    if (!products.length) {
      return { reply: 'Hiện tại cửa hàng chưa có món ăn nào trong thực đơn.' };
    }
    let menuReply = '📜 **DANH SÁCH THỰC ĐƠN FASTFOOD EXPRESS:**\n';
    for (const p of products) {
      const typeLabel = p.IsCombo ? '🔥 [Combo]' : '🍔 [Món lẻ]';
      const stockStatus = p.StockQuantity > 0 ? `(Còn ${p.StockQuantity})` : '*(Tạm hết)*';
      menuReply += `- **${p.ProductName}** ${typeLabel}: ${Number(p.Price).toLocaleString('vi-VN')} đ ${stockStatus}\n`;
    }
    menuReply += '\n💡 **Cách đặt hàng nhanh qua AI:**\n👉 *Nhắn: "2 gà rán về Cầu Giấy qua Vnpay" hoặc "Burger bò về Hà Nội tiền mặt".*';
    return { reply: menuReply };
  }

  // Gợi ý món ăn
  if (noTone.includes('ga') || noTone.includes('cay')) {
    return { reply: '🍗 **Gà Rán Giòn Cay** giá **45.000 đ/miếng** thơm ngon giòn rụm! Bạn chỉ cần nhắn: *"2 gà rán về Cầu Giấy"* để AI đặt ngay nhé!' };
  }
  if (noTone.includes('burger') || noTone.includes('bo')) {
    return { reply: '🍔 **Burger Bò Phô Mai** giá **55.000 đ** béo ngậy đẫm sốt! Nhắn *"Burger về [Địa chỉ]"* để AI giao tận cửa cho bạn!' };
  }
  if (noTone.includes('combo') || noTone.includes('tiet kiem')) {
    return { reply: '🔥 Cửa hàng có **Combo 1 (80k)**, **Combo 2 (90k)** và **Combo Gia Đình (180k)** cực tiết kiệm. Nhắn *"Combo 2 về [Địa chỉ] qua Vnpay"* để đặt nha!' };
  }
  if (noTone.includes('khoai')) {
    return { reply: '🍟 **Khoai Tây Chiên Pháp (L)** giá **30.000 đ** vàng giòn rắc muối tiêu biển. Nhắn *"Khoai tây về [Địa chỉ]"* để lên đơn ngay!' };
  }
  if (noTone.includes('pepsi') || noTone.includes('nuoc')) {
    return { reply: '🥤 **Nước Ngọt Pepsi mát lạnh** giá **15.000 đ/lon**. Nhắn *"Pepsi về [Địa chỉ] tiền mặt"* để AI chốt đơn nhé!' };
  }

  // Default welcome / help
  return {
    reply:
      '👋 Xin chào! Tôi là Trợ lý AI của FastFood Express.\n\n' +
      '💡 **Bạn có thể:**\n' +
      '1. Gõ **"menu"** để xem đầy đủ thực đơn và giá cả.\n' +
      '2. Nhắn đặt món: **[Tên món] + về [Địa chỉ] + qua [VNPAY/Tiền mặt]** (Ví dụ: *"2 gà rán về Cầu Giấy qua Vnpay"* hoặc *"Combo 1 về Hà Nội tiền mặt"*).\n' +
      '3. Hỏi bất kỳ thông tin nào về dinh dưỡng, khuyến mãi, giờ mở cửa và hotline!'
  };
}
