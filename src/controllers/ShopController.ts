import { Request, Response } from 'express';
import { db } from '../db.js';
import { VnPayLibrary, formatVnPayDate } from '../vnpay.js';
import { VNPAY_CONFIG, checkAndCancelExpiredVnPayOrders } from '../services/vnpayService.js';
import { handleChatBotMessage } from '../services/aiChatService.js';
import { sendComplaintEmail } from '../services/emailService.js';

export class ShopController {
  // Trang chủ khách hàng / thực đơn đặt món
  static index(req: Request, res: Response) {
    if (req.session.user) {
      const role = db.getRoleById(req.session.user.RoleId);
      const roleName = role ? role.RoleName : req.session.user.RoleName;
      if (roleName === 'Admin' || roleName === 'Manager') {
        return res.redirect('/Admin');
      }
      if (roleName === 'Cashier') {
        return res.redirect('/Cashier');
      }
    }

    // Tự động kiểm tra đơn hàng VNPay quá thời gian chờ
    checkAndCancelExpiredVnPayOrders();

    const allProducts = db.products;
    const categories = db.categories;

    // Danh sách món tạm hết hàng trong kho để thông báo trên đầu trang
    const outOfStockItems = allProducts.filter(p => p.StockQuantity <= 0 || !p.IsActive);

    // Tính toán các món bán chạy nhất (Best Sellers)
    const salesCount: Record<number, number> = {};
    for (const item of db.orderDetails) {
      salesCount[item.ProductId] = (salesCount[item.ProductId] || 0) + item.Quantity;
    }
    salesCount[1] = (salesCount[1] || 0) + 128; // Gà Rán Giòn Cay
    salesCount[6] = (salesCount[6] || 0) + 115; // Combo 2: Burger Bò + Khoai + Pepsi
    salesCount[2] = (salesCount[2] || 0) + 98;  // Burger Bò Phô Mai
    salesCount[3] = (salesCount[3] || 0) + 85;  // Khoai Tây Chiên (L)
    salesCount[5] = (salesCount[5] || 0) + 76;  // Combo 1
    salesCount[7] = (salesCount[7] || 0) + 64;  // Combo Gia Đình

    const bestSellers = [...allProducts]
      .sort((a, b) => (salesCount[b.ProductId] || 0) - (salesCount[a.ProductId] || 0))
      .slice(0, 5)
      .map(p => ({
        ...p,
        soldCount: salesCount[p.ProductId] || 0
      }));

    let currentUser = req.session.user;
    if (currentUser && currentUser.RoleName === 'Customer' && !currentUser.PhoneNumber) {
      const cust = db.customers.find(c => c.FullName === currentUser?.FullName);
      if (cust) {
        currentUser = { ...currentUser, PhoneNumber: cust.Phone };
      }
    }

    let customerPoints = 0;
    let customerTier = 'Đồng';
    let customerPhone = '';
    if (currentUser) {
      customerPhone = currentUser.PhoneNumber || '';
      let cust = customerPhone ? db.getCustomerByPhone(customerPhone) : db.customers.find(c => c.FullName === currentUser?.FullName);
      if (cust) {
        customerPoints = cust.TotalPoints;
        customerTier = cust.MembershipTier || db.calculateMembershipTier(cust.TotalPoints);
        if (!customerPhone && cust.Phone) {
          customerPhone = cust.Phone;
        }
      }
    }

    res.render('shop/index', {
      products: allProducts,
      outOfStockItems,
      categories,
      bestSellers,
      user: currentUser,
      customerPoints,
      customerTier,
      customerPhone
    });
  }

  // Tra cứu & xem điểm thưởng và lịch sử tích điểm của khách hàng
  static getCustomerPoints(req: Request, res: Response) {
    const phone = ((req.query.phone as string) || '').trim();
    let customer: any = null;

    if (phone) {
      customer = db.getCustomerByPhone(phone);
    } else if (req.session.user) {
      if (req.session.user.PhoneNumber) {
        customer = db.getCustomerByPhone(req.session.user.PhoneNumber);
      }
      if (!customer) {
        customer = db.customers.find(c => c.FullName === req.session.user?.FullName);
      }
    }

    if (!customer) {
      return res.json({
        success: false,
        message: phone ? `Số điện thoại ${phone} chưa có hồ sơ thành viên hoặc chưa có điểm tích lũy.` : 'Chưa có thông tin điểm thành viên.'
      });
    }

    const history = db.getPointHistory(customer.CustomerId);
    const tier = customer.MembershipTier || db.calculateMembershipTier(customer.TotalPoints);

    return res.json({
      success: true,
      customer: {
        id: customer.CustomerId,
        name: customer.FullName,
        phone: customer.Phone,
        points: customer.TotalPoints,
        tier,
        discountValue: customer.TotalPoints * 1000
      },
      history: history.map(h => ({
        id: h.HistoryId,
        points: h.Points,
        description: h.Description,
        date: new Date(h.CreatedAt).toLocaleString('vi-VN')
      }))
    });
  }

  // Đặt hàng online (COD hoặc VNPAY) có hỗ trợ sử dụng điểm tích lũy
  static checkout(req: Request, res: Response) {
    try {
      const { Items, Address, PaymentMethod, ShippingFee, CustomerPhone, UsePoints, PointsToUse } = req.body;

      if (!CustomerPhone || !CustomerPhone.trim()) {
        return res.status(400).json({ success: false, message: 'Số điện thoại nhận hàng là bắt buộc!' });
      }

      if (!Items || !Items.length) {
        return res.json({ success: false, message: 'Giỏ hàng trống!' });
      }

      // Kiểm tra hàng tồn kho trước khi đặt
      for (const item of Items) {
        const prod = db.getProductById(item.id || item.Id);
        if (!prod || prod.StockQuantity <= 0 || !prod.IsActive) {
          return res.json({ success: false, message: `Món "${prod ? prod.ProductName : 'này'}" hiện đã hết hàng trong kho. Vui lòng chọn món khác!` });
        }
        if (prod.StockQuantity < item.quantity) {
          return res.json({ success: false, message: `Món "${prod.ProductName}" chỉ còn ${prod.StockQuantity} phần trong kho!` });
        }
      }

      let subTotal = 0;
      for (const item of Items) {
        const prod = db.getProductById(item.id || item.Id);
        if (prod) {
          subTotal += prod.Price * item.quantity;
        }
      }

      const shipFee = parseFloat(ShippingFee) || 0;
      const now = new Date();
      const orderCode = 'ONLINE' + now.toISOString().slice(2, 10).replace(/-/g, '') + Math.floor(1000 + Math.random() * 9000);

      // Xử lý khách hàng & điểm tích lũy
      const phoneClean = CustomerPhone.trim();
      let targetCustomer = db.getCustomerByPhone(phoneClean);
      if (!targetCustomer) {
        targetCustomer = db.createCustomer(phoneClean, `Khách hàng Online (${phoneClean})`);
      }

      let pointsUsed = 0;
      let discountAmount = 0;

      // Nếu khách kích hoạt sử dụng điểm tích lũy
      if (UsePoints && targetCustomer && targetCustomer.TotalPoints > 0) {
        const maxPointsCanUse = Math.min(targetCustomer.TotalPoints, Math.floor(subTotal / 1000));
        const requestedPoints = parseInt(PointsToUse, 10);
        pointsUsed = isNaN(requestedPoints) || requestedPoints <= 0 ? maxPointsCanUse : Math.min(requestedPoints, maxPointsCanUse);
        discountAmount = pointsUsed * 1000;

        // Trừ điểm tích lũy của khách
        targetCustomer.TotalPoints -= pointsUsed;
        targetCustomer.MembershipTier = db.calculateMembershipTier(targetCustomer.TotalPoints);
        db.addPointHistory(targetCustomer.CustomerId, -pointsUsed, `Sử dụng ${pointsUsed} điểm giảm giá đơn hàng ${orderCode}`);
      }

      const totalAmount = Math.max(0, subTotal - discountAmount) + shipFee;

      const shippers = [
        { name: 'Nguyễn Văn Giao', phone: '0901234567' },
        { name: 'Trần Đình Ship', phone: '0918889999' },
        { name: 'Lê Hoàng Tốc Độ', phone: '0987654321' }
      ];
      const randomShipper = shippers[Math.floor(Math.random() * shippers.length)];

      if (PaymentMethod && PaymentMethod.toUpperCase() === 'VNPAY') {
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
        const returnUrl = `${req.protocol}://${req.get('host')}/Shop/PaymentCallback`;
        pay.addRequestData('vnp_ReturnUrl', returnUrl);
        pay.addRequestData('vnp_TxnRef', orderCode);

        // Tạo đơn hàng trạng thái chờ thanh toán
        const order = db.createOrder({
          OrderCode: orderCode,
          CashierId: 1,
          CustomerId: targetCustomer.CustomerId,
          OrderDate: now,
          OrderStatus: 'Pending',
          PaymentMethod: 'VNPAY QR',
          SubTotal: subTotal,
          DiscountAmount: discountAmount,
          TotalAmount: totalAmount,
          ShippingAddress: Address,
          CustomerPhone: phoneClean,
          ShipperName: randomShipper.name,
          ShipperPhone: randomShipper.phone,
          ShippingStatus: 'Đang chuẩn bị món'
        });

        for (const item of Items) {
          const prod = db.getProductById(item.id || item.Id);
          if (prod) {
            db.addOrderDetail({
              OrderId: order.OrderId,
              ProductId: prod.ProductId,
              Quantity: item.quantity,
              UnitPrice: prod.Price
            });
            prod.StockQuantity = Math.max(0, prod.StockQuantity - item.quantity);
          }
        }

        const paymentUrl = pay.createRequestUrl(VNPAY_CONFIG.baseUrl, VNPAY_CONFIG.hashSecret);
        return res.json({ 
          success: true, 
          isRedirect: true, 
          redirectUrl: paymentUrl,
          pointsUsed,
          discountAmount,
          remainingPoints: targetCustomer.TotalPoints
        });
      }

      // Thanh toán khi nhận hàng (COD)
      const paidFoodAmount = Math.max(0, subTotal - discountAmount);
      const pointsEarned = Math.floor(paidFoodAmount / 10000);
      if (pointsEarned > 0) {
        targetCustomer.TotalPoints += pointsEarned;
        targetCustomer.MembershipTier = db.calculateMembershipTier(targetCustomer.TotalPoints);
        db.addPointHistory(targetCustomer.CustomerId, pointsEarned, `Cộng điểm mua online từ hóa đơn ${orderCode}`);
      }

      const order = db.createOrder({
        OrderCode: orderCode,
        CashierId: 1,
        CustomerId: targetCustomer.CustomerId,
        OrderDate: now,
        OrderStatus: 'Pending',
        PaymentMethod: 'Tiền mặt (COD)',
        SubTotal: subTotal,
        DiscountAmount: discountAmount,
        TotalAmount: totalAmount,
        ShippingAddress: Address,
        CustomerPhone: phoneClean,
        ShipperName: randomShipper.name,
        ShipperPhone: randomShipper.phone,
        ShippingStatus: 'Đang chuẩn bị món'
      });

      for (const item of Items) {
        const prod = db.getProductById(item.id || item.Id);
        if (prod) {
          db.addOrderDetail({
            OrderId: order.OrderId,
            ProductId: prod.ProductId,
            Quantity: item.quantity,
            UnitPrice: prod.Price
          });
          prod.StockQuantity = Math.max(0, prod.StockQuantity - item.quantity);
        }
      }

      return res.json({
        success: true,
        isRedirect: false,
        orderCode: order.OrderCode,
        driverName: randomShipper.name,
        driverPhone: randomShipper.phone,
        subTotal,
        discountAmount,
        pointsUsed,
        pointsEarned,
        remainingPoints: targetCustomer.TotalPoints
      });
    } catch (err: any) {
      return res.json({ success: false, message: err.message });
    }
  }

  // Kết quả thanh toán VNPAY Online
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
    let message = '';
    if (order) {
      if (success) {
        order.OrderStatus = 'Hoàn tất';
        order.ShippingStatus = 'Đang chuẩn bị món';
        message = `Thanh toán đơn hàng ${orderCode} thành công! Bếp đang chuẩn bị món và shipper sẽ sớm giao đến bạn.`;
      } else {
        order.OrderStatus = 'Đã hủy';
        order.ShippingStatus = 'Đã hủy đơn';
        const details = db.orderDetails.filter(d => d.OrderId === order.OrderId);
        for (const d of details) {
          const prod = db.getProductById(d.ProductId);
          if (prod) prod.StockQuantity += d.Quantity;
        }

        if (responseCode === '11') {
          message = `Đã hết thời gian chờ thanh toán VNPay! Đơn hàng ${orderCode} đã được chuyển sang trạng thái "Đã hủy" và hoàn kho.`;
        } else if (responseCode === '24') {
          message = `Khách hàng đã hủy giao dịch trên cổng thanh toán VNPay. Đơn hàng ${orderCode} đã được chuyển sang trạng thái "Đã hủy"!`;
        } else {
          message = `Giao dịch thanh toán VNPAY không thành công hoặc đã bị hủy (Mã phản hồi: ${responseCode || 'Không xác định'}). Đơn hàng ${orderCode} đã được chuyển sang trạng thái "Đã hủy"!`;
        }
      }
    } else {
      message = 'Không tìm thấy hóa đơn cần cập nhật thanh toán!';
    }

    res.render('shop/callback', {
      success,
      message
    });
  }

  // Trợ lý AI tư vấn và đặt món thông minh
  static chatBot(req: Request, res: Response) {
    const result = handleChatBotMessage(req.body.Message, {
      protocol: req.protocol,
      host: req.get('host') || 'localhost:3000'
    });
    return res.json(result);
  }

  // Khách hàng gửi khiếu nại / phản ánh dịch vụ
  static async sendComplaint(req: Request, res: Response) {
    try {
      const { CustomerName, Phone, Content } = req.body;
      db.addComplaint({
        CustomerName: CustomerName || 'Khách vãng lai',
        Phone: Phone || 'Chưa cung cấp',
        Content: Content || ''
      });

      // Gửi email về Gmail quản trị viên
      await sendComplaintEmail({
        CustomerName: CustomerName || 'Khách vãng lai',
        Phone: Phone || 'Chưa cung cấp',
        Content: Content || ''
      });

      return res.json({
        success: true,
        message: 'Đã gửi khiếu nại thành công! Chủ quán sẽ liên hệ lại với bạn sớm nhất.'
      });
    } catch (err: any) {
      return res.json({ success: false, message: 'Lỗi khi gửi khiếu nại: ' + err.message });
    }
  }
}
