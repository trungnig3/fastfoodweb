import { VnPayLibrary, formatVnPayDate } from '../vnpay.js';
import { db } from '../db.js';

export const VNPAY_CONFIG = {
  tmnCode: process.env.VNPAY_TMN_CODE || '8A3GN9UC',
  hashSecret: process.env.VNPAY_HASH_SECRET || 'KEXQFWBZUTXYNJXCBEECMEQWOJSAVYMT',
  baseUrl: process.env.VNPAY_BASE_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'
};

export function createVnPayPaymentUrl(params: {
  amount: number;
  orderCode: string;
  orderInfo: string;
  returnUrl: string;
  ipAddr?: string;
}): string {
  const { amount, orderCode, orderInfo, returnUrl, ipAddr = '127.0.0.1' } = params;
  const pay = new VnPayLibrary();
  pay.addRequestData('vnp_Version', '2.1.0');
  pay.addRequestData('vnp_Command', 'pay');
  pay.addRequestData('vnp_TmnCode', VNPAY_CONFIG.tmnCode);
  pay.addRequestData('vnp_Amount', String(Math.round(amount * 100)));
  pay.addRequestData('vnp_CreateDate', formatVnPayDate());
  pay.addRequestData('vnp_CurrCode', 'VND');
  pay.addRequestData('vnp_IpAddr', ipAddr);
  pay.addRequestData('vnp_Locale', 'vn');
  pay.addRequestData('vnp_OrderInfo', orderInfo);
  pay.addRequestData('vnp_OrderType', 'other');
  pay.addRequestData('vnp_ReturnUrl', returnUrl);
  pay.addRequestData('vnp_TxnRef', orderCode);

  return pay.createRequestUrl(VNPAY_CONFIG.baseUrl, VNPAY_CONFIG.hashSecret);
}

// Tự động quét và hủy các đơn hàng VNPAY quá hạn chờ thanh toán (15 phút)
export function checkAndCancelExpiredVnPayOrders(): number {
  const now = Date.now();
  const TIMEOUT_MS = 15 * 60 * 1000; // 15 phút theo chuẩn VNPay
  let count = 0;
  for (const o of db.orders) {
    if (o.OrderStatus === 'Pending' && o.PaymentMethod && o.PaymentMethod.includes('VNPAY')) {
      const orderTime = new Date(o.OrderDate).getTime();
      if (now - orderTime > TIMEOUT_MS) {
        o.OrderStatus = 'Đã hủy';
        o.ShippingStatus = 'Đã hủy do hết hạn VNPay';
        // Hoàn lại tồn kho món ăn
        const details = db.orderDetails.filter(d => d.OrderId === o.OrderId);
        for (const d of details) {
          const prod = db.getProductById(d.ProductId);
          if (prod) prod.StockQuantity += d.Quantity;
        }
        count++;
      }
    }
  }
  return count;
}
