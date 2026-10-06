import { Request, Response } from 'express';
import { db } from '../db.js';
import { VnPayLibrary, formatVnPayDate } from '../vnpay.js';
import { VNPAY_CONFIG } from '../services/vnpayService.js';

export class PosController {
  // Giao diện bán hàng trực tiếp tại quầy POS
  static index(req: Request, res: Response) {
    const user = req.session.user!;
    let activeShift = db.getActiveShift(user.UserId);

    if (!activeShift) {
      activeShift = db.createShift(user.UserId, 0);
    }

    const showStartCashModal = activeShift.StartingCash === 0;
    const products = db.products.filter(p => p.IsActive);
    const categories = db.categories;

    res.render('pos/index', {
      cashierName: user.FullName || 'Thu Ngân',
      showStartCashModal,
      products,
      categories
    });
  }

  // Khai báo số tiền mặt đầu ca
  static saveStartingCash(req: Request, res: Response) {
    const user = req.session.user!;
    const activeShift = db.getActiveShift(user.UserId);
    const startingCash = parseFloat(req.body.startingCash) || 0;

    if (activeShift) {
      activeShift.StartingCash = startingCash;
      return res.json({ success: true });
    }
    return res.json({ success: false, message: 'Không tìm thấy ca làm việc hợp lệ!' });
  }

  // Đóng ca làm việc và đối soát tiền mặt
  static closeShift(req: Request, res: Response) {
    const user = req.session.user!;
    const activeShift = db.getActiveShift(user.UserId);
    const actualCash = parseFloat(req.body.actualCash) || 0;

    if (activeShift) {
      const shiftOrders = db.orders.filter(
        o => o.CashierId === user.UserId && o.OrderDate >= activeShift.StartTime && o.PaymentMethod === 'Tiền mặt'
      );
      const cashRevenue = shiftOrders.reduce((acc, o) => acc + o.TotalAmount, 0);
      const expectedCash = activeShift.StartingCash + cashRevenue;

      activeShift.ActualCash = actualCash;
      activeShift.CashDifference = actualCash - expectedCash;
      activeShift.EndTime = new Date();

      const totalHours = (activeShift.EndTime.getTime() - activeShift.StartTime.getTime()) / (1000 * 3600);
      activeShift.TotalHours = totalHours;
      const standardHours = totalHours > 8 ? 8 : totalHours;
      activeShift.StandardHours = standardHours;
      activeShift.OvertimeHours = totalHours > 8 ? totalHours - 8 : 0;
      activeShift.OvertimeBonus = activeShift.OvertimeHours * user.HourlyRate * 1.5;

      let calculatedSalary = standardHours * user.HourlyRate + activeShift.OvertimeBonus;
      if (activeShift.CashDifference < 0) {
        calculatedSalary += activeShift.CashDifference; // trừ thiếu hụt tiền
        if (calculatedSalary < 0) calculatedSalary = 0;
      }
      activeShift.TotalSalary = calculatedSalary;

      return res.json({ success: true });
    }

    return res.json({ success: false, message: 'Không tìm thấy ca làm việc đang mở!' });
  }

  // Báo cáo tổng kết bàn giao cuối ca
  static endShiftReport(req: Request, res: Response) {
    const user = req.session.user!;
    const shift = db.getLatestShift(user.UserId);

    if (!shift) return res.redirect('/Pos');

    const endTime = shift.EndTime || new Date();
    const shiftOrders = db.orders.filter(
      o => o.CashierId === user.UserId && o.OrderDate >= shift.StartTime && o.OrderDate <= endTime
    );

    const cashRevenue = shiftOrders.filter(o => o.PaymentMethod === 'Tiền mặt').reduce((acc, o) => acc + o.TotalAmount, 0);
    const transferRevenue = shiftOrders
      .filter(o => o.PaymentMethod && o.PaymentMethod.includes('VNPAY'))
      .reduce((acc, o) => acc + o.TotalAmount, 0);
    const expectedCashInDrawer = shift.StartingCash + cashRevenue;

    // Thống kê số lượng từng món đã bán trong ca
    const soldMap = new Map<string, number>();
    for (const o of shiftOrders) {
      const details = db.getOrderDetails(o.OrderId);
      for (const d of details) {
        const pName = d.Product ? d.Product.ProductName : 'Món khác';
        soldMap.set(pName, (soldMap.get(pName) || 0) + d.Quantity);
      }
    }

    const itemsSold = Array.from(soldMap.entries()).map(([ProductName, Quantity]) => ({
      ProductName,
      Quantity
    }));

    res.render('pos/end_shift', {
      cashierName: user.FullName || user.Username,
      startingCash: shift.StartingCash,
      cashRevenue,
      transferRevenue,
      expectedCashInDrawer,
      actualCash: shift.ActualCash,
      cashDifference: shift.CashDifference,
      itemsSold,
      startTime: shift.StartTime,
      endTime: shift.EndTime || new Date()
    });
  }

  // Thu ngân tạo hóa đơn & thanh toán tại quầy
  static checkout(req: Request, res: Response) {
    try {
      const { Items, CustomerId, CustomerPhone, PaymentMethod, UsePoints } = req.body;

      if (!Items || !Items.length) {
        return res.json({ success: false, message: 'Giỏ hàng đang trống!' });
      }

      // Kiểm tra kho hàng
      for (const item of Items) {
        const prod = db.getProductById(item.Id || item.id);
        if (prod) {
          if (!prod.IsActive) {
            return res.json({ success: false, message: `❌ Món '${prod.ProductName}' hiện đang NGỪNG BÁN.` });
          }
          if (item.Quantity > prod.StockQuantity) {
            return res.json({
              success: false,
              message: `❌ Món '${prod.ProductName}' chỉ còn ${prod.StockQuantity} phần trong kho.`
            });
          }
        }
      }

      let subTotal = 0;
      for (const item of Items) {
        const prod = db.getProductById(item.Id || item.id);
        if (prod) {
          subTotal += prod.Price * item.Quantity;
        }
      }

      let targetCustomer = CustomerId ? db.getCustomerById(CustomerId) : undefined;
      if (!targetCustomer && CustomerPhone) {
        targetCustomer = db.getCustomerByPhone(CustomerPhone);
        if (!targetCustomer) {
          targetCustomer = db.createCustomer(CustomerPhone, `Khách hàng (${CustomerPhone})`);
        }
      }

      let pointsUsed = 0;
      let discountAmount = 0;
      let totalAmount = subTotal;

      if (UsePoints && targetCustomer && targetCustomer.TotalPoints > 0) {
        pointsUsed = targetCustomer.TotalPoints;
        discountAmount = pointsUsed * 1000;
        if (discountAmount > totalAmount) {
          const excess = discountAmount - totalAmount;
          const excessPoints = Math.floor(excess / 1000);
          pointsUsed -= excessPoints;
          discountAmount = totalAmount;
        }

        targetCustomer.TotalPoints -= pointsUsed;
        totalAmount -= discountAmount;

        db.addPointHistory(targetCustomer.CustomerId, -pointsUsed, `Sử dụng ${pointsUsed} điểm thanh toán hóa đơn`);
      }

      const now = new Date();
      const orderCode = 'HD' + now.toISOString().slice(2, 10).replace(/-/g, '') + Math.floor(1000 + Math.random() * 9000);
      const cashier = req.session.user!;

      const order = db.createOrder({
        OrderCode: orderCode,
        CashierId: cashier.UserId,
        CustomerId: targetCustomer?.CustomerId,
        OrderDate: now,
        OrderStatus: PaymentMethod === 'VnPay' ? 'Pending' : 'Hoàn tất',
        PaymentMethod: PaymentMethod === 'VnPay' ? 'VNPAY QR' : 'Tiền mặt',
        SubTotal: subTotal,
        TotalAmount: totalAmount
      });

      for (const item of Items) {
        const prod = db.getProductById(item.Id || item.id);
        if (prod) {
          db.addOrderDetail({
            OrderId: order.OrderId,
            ProductId: prod.ProductId,
            Quantity: item.Quantity,
            UnitPrice: prod.Price
          });
          prod.StockQuantity = Math.max(0, prod.StockQuantity - item.Quantity);
        }
      }

      let pointsEarned = 0;
      if (targetCustomer) {
        pointsEarned = Math.floor(totalAmount / 10000);
        targetCustomer.TotalPoints += pointsEarned;
        db.addPointHistory(targetCustomer.CustomerId, pointsEarned, `Cộng điểm mua hàng từ hóa đơn ${order.OrderCode}`);
      }

      if (PaymentMethod === 'VnPay') {
        const pay = new VnPayLibrary();
        pay.addRequestData('vnp_Version', '2.1.0');
        pay.addRequestData('vnp_Command', 'pay');
        pay.addRequestData('vnp_TmnCode', VNPAY_CONFIG.tmnCode);
        pay.addRequestData('vnp_Amount', String(Math.round(totalAmount * 100)));
        pay.addRequestData('vnp_CreateDate', formatVnPayDate(now));
        pay.addRequestData('vnp_CurrCode', 'VND');
        pay.addRequestData('vnp_IpAddr', '127.0.0.1');
        pay.addRequestData('vnp_Locale', 'vn');
        pay.addRequestData('vnp_OrderInfo', `Thanh toan don hang ${orderCode}`);
        pay.addRequestData('vnp_OrderType', 'other');
        const returnUrl = `${req.protocol}://${req.get('host')}/Pos/PaymentCallback`;
        pay.addRequestData('vnp_ReturnUrl', returnUrl);
        pay.addRequestData('vnp_TxnRef', orderCode);

        const paymentUrl = pay.createRequestUrl(VNPAY_CONFIG.baseUrl, VNPAY_CONFIG.hashSecret);
        return res.json({ success: true, isRedirect: true, redirectUrl: paymentUrl });
      }

      return res.json({
        success: true,
        isRedirect: false,
        message: 'Thanh toán thành công!',
        orderCode: order.OrderCode,
        points: pointsEarned
      });
    } catch (err: any) {
      return res.json({ success: false, message: err.message });
    }
  }

  // Kết quả thanh toán VNPAY tại POS
  static paymentCallback(req: Request, res: Response) {
    const pay = new VnPayLibrary();
    for (const [key, value] of Object.entries(req.query)) {
      if (key.startsWith('vnp_')) {
        pay.addResponseData(key, String(value));
      }
    }

    const orderCode = pay.getResponseDataValue('vnp_TxnRef');
    const responseCode = pay.getResponseDataValue('vnp_ResponseCode');
    const secureHash = pay.getResponseDataValue('vnp_SecureHash');

    const isValid = pay.validateSignature(secureHash, VNPAY_CONFIG.hashSecret);
    const success = isValid && responseCode === '00';

    const order = db.orders.find(o => o.OrderCode === orderCode);
    if (order) {
      if (success) {
        order.OrderStatus = 'Hoàn tất';
      } else {
        order.OrderStatus = 'Đã hủy';
        const details = db.orderDetails.filter(d => d.OrderId === order.OrderId);
        for (const d of details) {
          const prod = db.getProductById(d.ProductId);
          if (prod) prod.StockQuantity += d.Quantity;
        }
      }
    }

    res.render('pos/callback', {
      success,
      message: success
        ? `Thanh toán VNPAY thành công cho mã đơn hàng: ${orderCode}`
        : 'Giao dịch VNPAY không thành công hoặc khách hàng đã hủy giao dịch!'
    });
  }

  // Tra cứu thành viên theo số điện thoại
  static findCustomer(req: Request, res: Response) {
    const phone = (req.query.phone as string) || '';
    const customer = db.getCustomerByPhone(phone);
    if (!customer) {
      return res.json({ found: false, message: 'Chưa đăng ký thành viên' });
    }
    return res.json({
      found: true,
      id: customer.CustomerId,
      name: customer.FullName,
      points: customer.TotalPoints,
      tier: customer.MembershipTier
    });
  }

  // Lịch sử các đơn hàng trong ca hiện tại
  static getOrderHistory(req: Request, res: Response) {
    try {
      const user = req.session.user!;
      const activeShift = db.getActiveShift(user.UserId);

      if (!activeShift) {
        return res.json({ success: true, orders: [] });
      }

      const searchCode = (req.query.searchCode as string) || '';
      const paymentMethod = (req.query.paymentMethod as string) || '';

      let shiftOrders = db.orders
        .filter(o => o.CashierId === user.UserId && o.OrderDate >= activeShift.StartTime)
        .sort((a, b) => b.OrderDate.getTime() - a.OrderDate.getTime());

      if (searchCode) {
        shiftOrders = shiftOrders.filter(o => o.OrderCode.includes(searchCode));
      }
      if (paymentMethod) {
        shiftOrders = shiftOrders.filter(o => o.PaymentMethod.includes(paymentMethod));
      }

      const orders = shiftOrders.map(o => {
        const details = db.getOrderDetails(o.OrderId);
        return {
          id: o.OrderId,
          orderCode: o.OrderCode,
          date: o.OrderDate,
          address: o.ShippingAddress || 'Mua tại quầy (POS)',
          payment: o.PaymentMethod,
          subTotal: o.SubTotal,
          total: o.TotalAmount,
          status: o.OrderStatus,
          cashier: user.FullName || 'Thu ngân',
          items: details.map(d => ({
            name: d.Product ? d.Product.ProductName : 'Món đã xóa',
            qty: d.Quantity,
            price: d.UnitPrice
          }))
        };
      });

      return res.json({ success: true, orders });
    } catch (err: any) {
      return res.json({ success: false, message: err.message });
    }
  }
}
