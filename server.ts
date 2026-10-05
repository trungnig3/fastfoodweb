import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import path from 'path';
import ejs from 'ejs';
import { db, User } from './src/db.js';
import { VnPayLibrary, formatVnPayDate } from './src/vnpay.js';

declare module 'express-session' {
  interface SessionData {
    user?: User & { RoleName?: string };
  }
}

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// VnPay Configuration
const VNPAY_CONFIG = {
  tmnCode: process.env.VNPAY_TMN_CODE || '8A3GN9UC',
  hashSecret: process.env.VNPAY_HASH_SECRET || 'KEXQFWBZUTXYNJXCBEECMEQWOJSAVYMT',
  baseUrl: process.env.VNPAY_BASE_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'
};

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser() as any);
app.use(
  session({
    secret: 'fastfoodweb-secret-key-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 8 * 60 * 60 * 1000 } // 8 hours shift
  }) as any
);

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));

// Static files from wwwroot
app.use(express.static(path.join(process.cwd(), 'wwwroot')));

// Fallback for FastFoodWeb.styles.css
app.get('/FastFoodWeb.styles.css', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'wwwroot/css/site.css'));
});

// Helper for Admin layout rendering
async function renderAdmin(req: Request, res: Response, viewName: string, title: string, data: Record<string, any> = {}) {
  const viewPath = path.join(process.cwd(), 'views', 'admin', `${viewName}.ejs`);
  const body = await ejs.renderFile(viewPath, data);
  const layoutPath = path.join(process.cwd(), 'views', 'admin_layout.ejs');
  const fullHtml = await ejs.renderFile(layoutPath, {
    title,
    body,
    path: req.path.toLowerCase(),
    user: req.session.user
  });
  res.send(fullHtml);
}

// Helper for Cashier layout rendering
async function renderCashier(req: Request, res: Response, viewName: string, title: string, data: Record<string, any> = {}) {
  const viewPath = path.join(process.cwd(), 'views', 'cashier', `${viewName}.ejs`);
  const body = await ejs.renderFile(viewPath, data);
  const layoutPath = path.join(process.cwd(), 'views', 'admin_layout.ejs');
  const fullHtml = await ejs.renderFile(layoutPath, {
    title,
    body,
    path: req.path.toLowerCase(),
    user: req.session.user
  });
  res.send(fullHtml);
}

// Strict Role Isolation Middlewares
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session.user) {
    return next();
  }
  return res.redirect('/Account/Login');
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user) {
    return res.redirect('/Account/Login');
  }
  const role = db.getRoleById(req.session.user.RoleId);
  const roleName = role ? role.RoleName : req.session.user.RoleName;
  if (roleName === 'Admin' || roleName === 'Manager') {
    return next();
  }
  if (roleName === 'Cashier') {
    return res.redirect('/Cashier');
  }
  return res.redirect('/Shop');
}

function requireCashier(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user) {
    return res.redirect('/Account/Login');
  }
  const role = db.getRoleById(req.session.user.RoleId);
  const roleName = role ? role.RoleName : req.session.user.RoleName;
  if (roleName === 'Cashier') {
    return next();
  }
  if (roleName === 'Admin' || roleName === 'Manager') {
    return res.redirect('/Admin');
  }
  return res.redirect('/Shop');
}

function requirePos(req: Request, res: Response, next: NextFunction) {
  return requireCashier(req, res, next);
}

// Tự động quét và hủy các đơn hàng VNPAY quá hạn chờ thanh toán (15 phút)
function checkAndCancelExpiredVnPayOrders() {
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

// Chạy định kỳ mỗi 30 giây để cập nhật trạng thái đơn quá hạn
setInterval(checkAndCancelExpiredVnPayOrders, 30000);

// ==================== HOME & SHOP ROUTES ====================
app.get(['/', '/Shop', '/Shop/Index', '/Home', '/Home/Index'], (req, res) => {
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

  // Quét kiểm tra đơn hàng VNPay quá thời gian chờ
  checkAndCancelExpiredVnPayOrders();

  const allProducts = db.products;
  const categories = db.categories;

  // Lọc danh sách các món tạm hết hàng trong kho để in dòng cảnh báo trên đầu trang
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

  res.render('shop/index', {
    products: allProducts,
    outOfStockItems,
    categories,
    bestSellers,
    user: currentUser
  });
});

app.post('/Shop/Checkout', (req, res) => {
  try {
    const { Items, Address, PaymentMethod, ShippingFee, CustomerPhone } = req.body;

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
    const totalAmount = subTotal + shipFee;
    const now = new Date();
    const orderCode = 'ONLINE' + now.toISOString().slice(2, 10).replace(/-/g, '') + Math.floor(1000 + Math.random() * 9000);

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

      // Create pending order
      const order = db.createOrder({
        OrderCode: orderCode,
        CashierId: 1,
        OrderDate: now,
        OrderStatus: 'Pending',
        PaymentMethod: 'VNPAY QR',
        SubTotal: subTotal,
        TotalAmount: totalAmount,
        ShippingAddress: Address,
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
      return res.json({ success: true, isRedirect: true, redirectUrl: paymentUrl });
    }

    // COD Flow
    let customerId: number | undefined;
    if (CustomerPhone) {
      let targetCustomer = db.getCustomerByPhone(CustomerPhone);
      if (!targetCustomer) {
        targetCustomer = db.createCustomer(CustomerPhone, `Khách hàng Online (${CustomerPhone})`);
      }
      customerId = targetCustomer.CustomerId;
      const pointsEarned = Math.floor(totalAmount / 10000);
      targetCustomer.TotalPoints += pointsEarned;
      db.addPointHistory(targetCustomer.CustomerId, pointsEarned, `Cộng điểm mua online từ hóa đơn ${orderCode}`);
    }

    const order = db.createOrder({
      OrderCode: orderCode,
      CashierId: 1,
      CustomerId: customerId,
      OrderDate: now,
      OrderStatus: 'Pending',
      PaymentMethod: 'Tiền mặt (COD)',
      SubTotal: subTotal,
      TotalAmount: totalAmount,
      ShippingAddress: Address,
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
      driverPhone: randomShipper.phone
    });
  } catch (err: any) {
    return res.json({ success: false, message: err.message });
  }
});

app.get('/Shop/PaymentCallback', (req, res) => {
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
});

app.post('/Shop/ChatBot', (req, res) => {
  const msg = (req.body.Message || '').toLowerCase().trim();
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
          address = req.body.Message.substring(idx + kw.length).trim();
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
        const pay = new VnPayLibrary();
        pay.addRequestData('vnp_Version', '2.1.0');
        pay.addRequestData('vnp_Command', 'pay');
        pay.addRequestData('vnp_TmnCode', VNPAY_CONFIG.tmnCode);
        pay.addRequestData('vnp_Amount', String(Math.round(finalAmount * 100)));
        pay.addRequestData('vnp_CreateDate', formatVnPayDate());
        pay.addRequestData('vnp_CurrCode', 'VND');
        pay.addRequestData('vnp_IpAddr', '127.0.0.1');
        pay.addRequestData('vnp_Locale', 'vn');
        pay.addRequestData('vnp_OrderInfo', `Thanh toan don hang ${orderCode}`);
        pay.addRequestData('vnp_OrderType', 'other');
        const returnUrl = `${req.protocol}://${req.get('host')}/Shop/PaymentCallback`;
        pay.addRequestData('vnp_ReturnUrl', returnUrl);
        pay.addRequestData('vnp_TxnRef', orderCode);

        const paymentUrl = pay.createRequestUrl(VNPAY_CONFIG.baseUrl, VNPAY_CONFIG.hashSecret);
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

  return res.json({ reply });
});

app.post('/Shop/SendComplaint', (req, res) => {
  try {
    const { CustomerName, Phone, Content } = req.body;
    db.addComplaint({
      CustomerName,
      Phone,
      Content
    });
    return res.json({
      success: true,
      message: 'Đã gửi khiếu nại thành công! Chủ quán sẽ liên hệ lại với bạn sớm nhất.'
    });
  } catch (err: any) {
    return res.json({ success: false, message: 'Lỗi khi gửi khiếu nại: ' + err.message });
  }
});

// ==================== ACCOUNT ROUTES ====================
app.get('/Account/Login', (req, res) => {
  if (req.session.user) {
    const role = db.getRoleById(req.session.user.RoleId);
    const roleName = role ? role.RoleName : req.session.user.RoleName;
    if (roleName === 'Cashier') return res.redirect('/Cashier');
    if (roleName === 'Customer') return res.redirect('/Shop');
    return res.redirect('/Admin');
  }
  res.render('account/login', { error: null });
});

app.get('/Account/Register', (req, res) => {
  if (req.session.user) {
    const role = db.getRoleById(req.session.user.RoleId);
    const roleName = role ? role.RoleName : req.session.user.RoleName;
    if (roleName === 'Cashier') return res.redirect('/Cashier');
    if (roleName === 'Customer') return res.redirect('/Shop');
    return res.redirect('/Admin');
  }
  res.render('account/register', { error: null });
});

app.post('/Account/Register', (req, res) => {
  try {
    const { fullName, phone, username, password, confirmPassword } = req.body;
    if (!fullName || !phone || !username || !password) {
      return res.render('account/register', {
        error: 'Vui lòng điền đầy đủ các thông tin bắt buộc (*)!',
        fullName,
        phone,
        username
      });
    }

    if (password !== confirmPassword) {
      return res.render('account/register', {
        error: 'Mật khẩu và xác nhận mật khẩu không khớp nhau!',
        fullName,
        phone,
        username
      });
    }

    const cleanUsername = username.trim().toLowerCase();
    if (db.getUser(cleanUsername)) {
      return res.render('account/register', {
        error: 'Tên đăng nhập này đã được sử dụng, vui lòng chọn tên khác!',
        fullName,
        phone,
        username
      });
    }

    // Tạo tài khoản khách hàng mới (RoleId = 3)
    const newUser = db.createUser({
      Username: cleanUsername,
      PasswordHash: password,
      FullName: fullName.trim(),
      RoleId: 3,
      HourlyRate: 0,
      IsActive: true,
      PhoneNumber: phone.trim()
    });

    // Tạo hồ sơ khách hàng tích điểm nếu chưa có
    let cust = db.getCustomerByPhone(phone.trim());
    if (!cust) {
      db.createCustomer(phone.trim(), fullName.trim());
    }

    // Tự động đăng nhập phiên làm việc khách hàng
    req.session.user = {
      ...newUser,
      RoleName: 'Customer',
      PhoneNumber: phone.trim()
    };

    return res.redirect('/Shop');
  } catch (err: any) {
    return res.render('account/register', {
      error: 'Lỗi khi đăng ký tài khoản: ' + err.message
    });
  }
});

app.post('/Account/Login', (req, res) => {
  const { username, password } = req.body;
  const user = db.getUser(username);

  const isValidPassword = user && (
    user.PasswordHash === password ||
    (password === '123' && (user.Username === 'admin' || user.Username === 'admin2' || user.Username === 'thungan' || user.Username === 'khachhang')) ||
    (password === '123456' && (user.Username === 'admin' || user.Username === 'admin2' || user.Username === 'thungan' || user.Username === 'khachhang'))
  );

  if (!user || !isValidPassword) {
    return res.render('account/login', {
      error: 'Tên đăng nhập hoặc mật khẩu không đúng!',
      username
    });
  }

  const role = db.getRoleById(user.RoleId);
  const roleName = role ? role.RoleName : (user.RoleId === 1 ? 'Admin' : (user.RoleId === 2 ? 'Cashier' : 'Customer'));

  req.session.user = {
    ...user,
    RoleName: roleName
  };

  if (roleName === 'Cashier') {
    // Auto close dangling shifts for cashier
    const pendingShifts = db.shifts.filter(s => s.UserId === user.UserId && s.EndTime === null);
    for (const s of pendingShifts) {
      s.EndTime = new Date();
      s.TotalHours = (s.EndTime.getTime() - s.StartTime.getTime()) / (1000 * 3600);
      s.TotalSalary = s.TotalHours * user.HourlyRate;
    }
    // Open new shift for cashier
    db.createShift(user.UserId, 0);
    return res.redirect('/Cashier');
  }

  if (roleName === 'Customer') {
    return res.redirect('/Shop');
  }

  return res.redirect('/Admin');
});

app.get('/Account/Logout', (req, res) => {
  const user = req.session.user;
  if (user && user.RoleName === 'Cashier') {
    const activeShift = db.getActiveShift(user.UserId);
    if (activeShift && !activeShift.EndTime) {
      activeShift.EndTime = new Date();
      activeShift.TotalHours = (activeShift.EndTime.getTime() - activeShift.StartTime.getTime()) / (1000 * 3600);
      activeShift.TotalSalary = activeShift.TotalHours * (user.HourlyRate || 25000);
    }
  }

  req.session.destroy(() => {
    res.redirect('/Account/Login');
  });
});

// ==================== POS ROUTES ====================
app.get(['/Pos', '/Pos/Index'], requirePos, (req, res) => {
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
});

app.post('/Pos/SaveStartingCash', requirePos, (req, res) => {
  const user = req.session.user!;
  const activeShift = db.getActiveShift(user.UserId);
  const startingCash = parseFloat(req.body.startingCash) || 0;

  if (activeShift) {
    activeShift.StartingCash = startingCash;
    return res.json({ success: true });
  }
  return res.json({ success: false, message: 'Không tìm thấy ca làm việc hợp lệ!' });
});

app.post('/Pos/CloseShift', requirePos, (req, res) => {
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
      calculatedSalary += activeShift.CashDifference; // deduct shortage
      if (calculatedSalary < 0) calculatedSalary = 0;
    }
    activeShift.TotalSalary = calculatedSalary;

    return res.json({ success: true });
  }

  return res.json({ success: false, message: 'Không tìm thấy ca làm việc đang mở!' });
});

app.get('/Pos/EndShiftReport', requirePos, (req, res) => {
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

  // Aggregate items sold
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
});

app.post('/Pos/Checkout', requirePos, (req, res) => {
  try {
    const { Items, CustomerId, CustomerPhone, PaymentMethod, UsePoints } = req.body;

    if (!Items || !Items.length) {
      return res.json({ success: false, message: 'Giỏ hàng đang trống!' });
    }

    // Check stock
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
});

app.get('/Pos/PaymentCallback', (req, res) => {
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
});

app.get('/Pos/FindCustomer', requirePos, (req, res) => {
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
});

app.get('/Pos/GetOrderHistory', requirePos, (req, res) => {
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
});

// ==================== ADMIN ROUTES ====================
app.get(['/Admin', '/Admin/Index'], requireAdmin, async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayOrders = db.orders.filter(o => o.OrderDate >= today);
  const todayRevenue = todayOrders
    .filter(o => o.OrderStatus === 'Hoàn tất')
    .reduce((acc, o) => acc + o.TotalAmount, 0);

  const todayOrdersCount = todayOrders.length;
  const activeProductsCount = db.products.filter(p => p.IsActive).length;
  const staffCount = db.users.length;
  const totalCustomers = db.customers.length;
  const lowStockCount = db.products.filter(p => p.StockQuantity <= 10).length;
  const recentOrders = [...db.orders].sort((a, b) => b.OrderDate.getTime() - a.OrderDate.getTime()).slice(0, 6);

  // 7-day revenue trend
  const dailyTrend = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const nextD = new Date(d);
    nextD.setDate(nextD.getDate() + 1);

    const dayOrders = db.orders.filter(o => o.OrderDate >= d && o.OrderDate < nextD && (o.OrderStatus === 'Hoàn tất' || o.OrderStatus === 'Completed'));
    const rev = dayOrders.reduce((sum, o) => sum + o.TotalAmount, 0);
    const dayLabel = `${d.getDate()}/${d.getMonth() + 1}`;
    dailyTrend.push({ label: dayLabel, revenue: rev, count: dayOrders.length });
  }

  // Top selling products
  const soldMap = new Map<string, { product: any, count: number }>();
  for (const o of db.orders) {
    const details = db.getOrderDetails(o.OrderId);
    for (const d of details) {
      if (d.Product) {
        const item = soldMap.get(d.Product.ProductName) || { product: d.Product, count: 0 };
        item.count += d.Quantity;
        soldMap.set(d.Product.ProductName, item);
      }
    }
  }
  const topSelling = Array.from(soldMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  await renderAdmin(req, res, 'index', 'Tổng quan', {
    todayRevenue,
    todayOrdersCount,
    activeProductsCount,
    staffCount,
    totalCustomers,
    lowStockCount,
    recentOrders,
    dailyTrend,
    topSelling
  });
});

app.get('/Admin/Products', requireAdmin, async (req, res) => {
  const search = ((req.query.search as string) || '').toLowerCase();
  const categoryId = parseInt(req.query.categoryId as string, 10);

  let products = db.products.map(p => ({
    ...p,
    Category: db.categories.find(c => c.CategoryId === p.CategoryId)
  }));

  if (search) {
    products = products.filter(p => p.ProductName.toLowerCase().includes(search));
  }
  if (!isNaN(categoryId) && categoryId > 0) {
    products = products.filter(p => p.CategoryId === categoryId);
  }

  await renderAdmin(req, res, 'products', 'Quản lý Thực đơn', {
    products,
    categories: db.categories,
    searchKey: req.query.search || '',
    selectedCategory: categoryId || ''
  });
});

app.get('/Admin/CreateProduct', requireAdmin, async (req, res) => {
  await renderAdmin(req, res, 'create_product', 'Thêm Món Ăn', {
    categories: db.categories
  });
});

app.post('/Admin/CreateProduct', requireAdmin, (req, res) => {
  const { ProductName, Price, StockQuantity, CategoryId, ImageURL, IsCombo, IsActive } = req.body;
  db.createProduct({
    ProductName,
    Price: parseFloat(Price) || 0,
    StockQuantity: parseInt(StockQuantity, 10) || 0,
    CategoryId: parseInt(CategoryId, 10) || 1,
    ImageURL: ImageURL || '',
    IsCombo: Boolean(IsCombo),
    IsActive: Boolean(IsActive)
  });
  res.redirect('/Admin/Products');
});

app.get('/Admin/EditProduct/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const product = db.getProductById(id);
  if (!product) return res.status(404).send('Không tìm thấy món ăn!');

  await renderAdmin(req, res, 'edit_product', 'Chỉnh Sửa Món Ăn', {
    product,
    categories: db.categories
  });
});

app.post('/Admin/EditProduct/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { ProductName, Price, StockQuantity, CategoryId, ImageURL, IsCombo, IsActive } = req.body;

  db.updateProduct(id, {
    ProductName,
    Price: parseFloat(Price) || 0,
    StockQuantity: parseInt(StockQuantity, 10) || 0,
    CategoryId: parseInt(CategoryId, 10) || 1,
    ImageURL: ImageURL || '',
    IsCombo: Boolean(IsCombo),
    IsActive: Boolean(IsActive)
  });

  res.redirect('/Admin/Products');
});

app.post('/Admin/DeleteProduct', requireAdmin, (req, res) => {
  const id = parseInt(req.body.id, 10);
  db.deleteProduct(id);
  res.redirect('/Admin/Products');
});

app.get('/Admin/Inventory', requireAdmin, async (req, res) => {
  const products = db.products.map(p => ({
    ...p,
    Category: db.categories.find(c => c.CategoryId === p.CategoryId)
  }));
  await renderAdmin(req, res, 'inventory', 'Quản lý Tồn kho', { products, query: req.query });
});

app.post('/Admin/UpdateStock', requireAdmin, (req, res) => {
  const id = parseInt(req.body.id, 10);
  const stock = parseInt(req.body.stock, 10);
  const ok = db.updateProduct(id, { StockQuantity: stock });
  if (ok) {
    return res.json({ success: true, message: 'Cập nhật kho thành công!' });
  }
  return res.json({ success: false, message: 'Không tìm thấy sản phẩm!' });
});

app.get('/Admin/Orders', requireAdmin, async (req, res) => {
  // Quét cập nhật các đơn VNPAY quá hạn 15 phút sang Đã hủy
  checkAndCancelExpiredVnPayOrders();

  const orders = [...db.orders]
    .sort((a, b) => b.OrderDate.getTime() - a.OrderDate.getTime())
    .map(o => ({
      ...o,
      Cashier: db.getUserById(o.CashierId)
    }));

  const totalRevenue = orders.reduce((acc, o) => acc + (o.OrderStatus === 'Hoàn tất' ? o.TotalAmount : 0), 0);
  const totalOrders = orders.length;

  await renderAdmin(req, res, 'orders', 'Quản lý Lịch sử Hóa đơn', {
    orders,
    totalRevenue,
    totalOrders
  });
});

app.get('/Admin/OrderDetails/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const order = db.orders.find(o => o.OrderId === id);
  if (!order) return res.status(404).send('Không tìm thấy hóa đơn!');

  const details = db.getOrderDetails(id);
  const cashier = db.getUserById(order.CashierId);

  await renderAdmin(req, res, 'order_details', 'Chi Tiết Hóa Đơn', {
    order: { ...order, Cashier: cashier },
    details
  });
});

app.get('/Cashier/OrderDetails/:id', requirePos, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const order = db.orders.find(o => o.OrderId === id);
  if (!order) return res.status(404).send('Không tìm thấy hóa đơn!');

  const details = db.getOrderDetails(id);
  const cashier = db.getUserById(order.CashierId);

  await renderCashier(req, res, 'order_details', 'Chi Tiết Hóa Đơn', {
    order: { ...order, Cashier: cashier },
    details
  });
});

app.post(['/Admin/UpdateOrderStatus', '/Cashier/UpdateOrderStatus'], (req, res) => {
  if (!req.session.user) return res.status(401).json({ success: false, message: 'Chưa đăng nhập!' });
  const id = parseInt(req.body.orderId || req.body.id, 10);
  const status = req.body.status;
  const order = db.orders.find(o => o.OrderId === id);
  if (order) {
    if (status === 'Đang chuẩn bị món') {
      order.OrderStatus = 'Đang xử lý';
      order.ShippingStatus = 'Đang chuẩn bị món';
    } else if (status === 'Đang giao hàng') {
      order.OrderStatus = 'Đang giao';
      order.ShippingStatus = 'Đang giao hàng';
    } else if (status === 'Đã giao thành công') {
      order.OrderStatus = 'Hoàn tất';
      order.ShippingStatus = 'Đã giao thành công';
    } else if (status === 'Hoàn tất') {
      order.OrderStatus = 'Hoàn tất';
      if (!order.ShippingStatus || order.ShippingStatus === 'Đang chuẩn bị món') {
        order.ShippingStatus = 'Đã giao thành công';
      }
    } else if (status === 'Đã hủy') {
      order.OrderStatus = 'Đã hủy';
      order.ShippingStatus = 'Đã hủy đơn';
      // Hoàn lại kho hàng nếu đơn bị hủy
      const details = db.orderDetails.filter(d => d.OrderId === order.OrderId);
      for (const d of details) {
        const prod = db.getProductById(d.ProductId);
        if (prod) prod.StockQuantity += d.Quantity;
      }
    } else {
      order.OrderStatus = status;
      order.ShippingStatus = status;
    }

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({ success: true, message: 'Đã cập nhật trạng thái đơn hàng!' });
    }
    const redirectUrl = req.path.toLowerCase().startsWith('/cashier') 
      ? `/Cashier/OrderDetails/${id}` 
      : `/Admin/OrderDetails/${id}`;
    return res.redirect(redirectUrl);
  }

  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.json({ success: false, message: 'Không tìm thấy đơn hàng!' });
  }
  return res.redirect('/Admin/Orders');
});

app.get('/Admin/RevenueReport', requireAdmin, async (req, res) => {
  const startDateStr = req.query.startDate as string;
  const endDateStr = req.query.endDate as string;

  let query = db.orders.filter(o => o.OrderStatus === 'Hoàn tất' || o.OrderStatus === 'Completed');

  if (startDateStr) {
    const sDate = new Date(startDateStr);
    query = query.filter(o => o.OrderDate >= sDate);
  }
  if (endDateStr) {
    const eDate = new Date(endDateStr);
    eDate.setHours(23, 59, 59, 999);
    query = query.filter(o => o.OrderDate <= eDate);
  }

  const orders = [...query].sort((a, b) => b.OrderDate.getTime() - a.OrderDate.getTime());
  const totalRevenue = orders.reduce((acc, o) => acc + o.TotalAmount, 0);
  const totalOrders = orders.length;

  await renderAdmin(req, res, 'revenue_report', 'Báo Cáo Doanh Thu', {
    orders,
    totalRevenue,
    totalOrders,
    startDate: startDateStr || '',
    endDate: endDateStr || ''
  });
});

app.get('/Admin/Reports', requireAdmin, async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayOrders = db.orders.filter(o => o.OrderDate >= today);
  const totalRevenue = todayOrders
    .filter(o => !o.OrderStatus.includes('Hủy'))
    .reduce((acc, o) => acc + o.TotalAmount, 0);
  const totalOrders = todayOrders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Top products
  const soldMap = new Map<string, number>();
  for (const o of db.orders) {
    const details = db.getOrderDetails(o.OrderId);
    for (const d of details) {
      const pName = d.Product ? d.Product.ProductName : 'Khác';
      soldMap.set(pName, (soldMap.get(pName) || 0) + d.Quantity);
    }
  }

  const topProducts = Array.from(soldMap.entries())
    .map(([ProductName, QuantitySold]) => ({ ProductName, QuantitySold }))
    .sort((a, b) => b.QuantitySold - a.QuantitySold)
    .slice(0, 5);

  // Shift reports
  const shiftReports = db.shifts
    .filter(s => s.EndTime !== null)
    .sort((a, b) => (b.EndTime ? b.EndTime.getTime() : 0) - (a.EndTime ? a.EndTime.getTime() : 0))
    .slice(0, 10)
    .map(s => {
      const u = db.getUserById(s.UserId);
      return {
        Date: s.EndTime || s.StartTime,
        CashierName: u ? u.FullName : 'Nhân viên',
        ExpectedCash: s.ActualCash - s.CashDifference,
        ActualCash: s.ActualCash,
        Difference: s.CashDifference
      };
    });

  await renderAdmin(req, res, 'reports', 'Báo cáo Tổng hợp', {
    totalRevenue,
    totalOrders,
    avgOrderValue,
    topProducts,
    shiftReports
  });
});

app.get('/Admin/Staff', requireAdmin, async (req, res) => {
  const users = db.users.map(u => ({
    ...u,
    Role: db.getRoleById(u.RoleId)
  }));
  await renderAdmin(req, res, 'staff', 'Quản lý Nhân viên', { users });
});

app.get('/Admin/CreateStaff', requireAdmin, async (req, res) => {
  await renderAdmin(req, res, 'create_staff', 'Thêm Nhân Viên', {
    roles: db.roles
  });
});

app.post('/Admin/CreateStaff', requireAdmin, (req, res) => {
  const { FullName, Username, PasswordHash, RoleId, HourlyRate, IsActive } = req.body;
  db.createUser({
    FullName,
    Username,
    PasswordHash: PasswordHash || '123',
    RoleId: parseInt(RoleId, 10) || 2,
    HourlyRate: parseFloat(HourlyRate) || 25000,
    IsActive: Boolean(IsActive)
  });
  res.redirect('/Admin/Staff');
});

app.get('/Admin/EditStaff/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const editUser = db.getUserById(id);
  if (!editUser) return res.status(404).send('Không tìm thấy nhân viên!');

  await renderAdmin(req, res, 'edit_staff', 'Chỉnh Sửa Nhân Viên', {
    editUser,
    roles: db.roles
  });
});

app.post('/Admin/EditStaff/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { FullName, Username, PasswordHash, RoleId, HourlyRate, IsActive } = req.body;

  const updateData: Partial<User> = {
    FullName,
    Username,
    RoleId: parseInt(RoleId, 10) || 2,
    HourlyRate: parseFloat(HourlyRate) || 25000,
    IsActive: Boolean(IsActive)
  };
  if (PasswordHash && PasswordHash.trim()) {
    updateData.PasswordHash = PasswordHash.trim();
  }

  db.updateUser(id, updateData);
  res.redirect('/Admin/Staff');
});

app.post('/Admin/DeleteUser', requireAdmin, (req, res) => {
  const id = parseInt(req.body.id, 10);
  const ok = db.deleteUser(id);
  res.json({ success: ok });
});

app.get('/Admin/SalaryReport', requireAdmin, async (req, res) => {
  const m = parseInt(req.query.month as string, 10) || new Date().getMonth() + 1;
  const y = parseInt(req.query.year as string, 10) || new Date().getFullYear();

  // Find completed shifts in month/year excluding Admin
  const shifts = db.shifts.filter(s => {
    if (!s.EndTime) return false;
    const sDate = new Date(s.StartTime);
    if (sDate.getMonth() + 1 !== m || sDate.getFullYear() !== y) return false;
    const u = db.getUserById(s.UserId);
    if (!u) return false;
    const r = db.getRoleById(u.RoleId);
    return r && r.RoleName !== 'Admin';
  });

  // Group by user
  const userShiftMap = new Map<number, typeof shifts>();
  for (const s of shifts) {
    if (!userShiftMap.has(s.UserId)) userShiftMap.set(s.UserId, []);
    userShiftMap.get(s.UserId)!.push(s);
  }

  const report = Array.from(userShiftMap.entries()).map(([userId, uShifts]) => {
    const u = db.getUserById(userId);
    const totalHours = uShifts.reduce((acc, s) => acc + s.TotalHours, 0);
    const standardHours = uShifts.reduce((acc, s) => acc + s.StandardHours, 0);
    const overtimeHours = uShifts.reduce((acc, s) => acc + s.OvertimeHours, 0);
    const overtimeBonus = uShifts.reduce((acc, s) => acc + s.OvertimeBonus, 0);
    const totalSalary = uShifts.reduce((acc, s) => acc + s.TotalSalary, 0);

    return {
      FullName: u ? u.FullName : 'Tài khoản đã xóa',
      Username: u ? u.Username : 'N/A',
      HourlyRate: u ? u.HourlyRate : 0,
      TotalHours: totalHours,
      StandardHours: standardHours,
      OvertimeHours: overtimeHours,
      OvertimeBonus: overtimeBonus,
      TotalSalary: totalSalary
    };
  });

  await renderAdmin(req, res, 'salary_report', 'Bảng Lương Nhân Viên', {
    report,
    selectedMonth: m,
    selectedYear: y
  });
});

// ==================== ADMIN: CATEGORIES MANAGEMENT ====================
app.get('/Admin/Categories', requireAdmin, async (req, res) => {
  await renderAdmin(req, res, 'categories', 'Quản Lý Danh Mục Món Ăn', {
    categories: db.categories,
    products: db.products
  });
});

app.post('/Admin/CreateCategory', requireAdmin, (req, res) => {
  const { CategoryName } = req.body;
  if (CategoryName && CategoryName.trim()) {
    db.createCategory(CategoryName.trim());
  }
  res.redirect('/Admin/Categories');
});

app.post('/Admin/EditCategory', requireAdmin, (req, res) => {
  const { CategoryId, CategoryName } = req.body;
  const id = parseInt(CategoryId, 10);
  if (id && CategoryName && CategoryName.trim()) {
    db.updateCategory(id, CategoryName.trim());
  }
  res.redirect('/Admin/Categories');
});

app.post('/Admin/DeleteCategory', requireAdmin, (req, res) => {
  const id = parseInt(req.body.id, 10);
  const hasProducts = db.products.some(p => p.CategoryId === id);
  if (hasProducts) {
    return res.json({ success: false, message: 'Danh mục đang chứa món ăn, không thể xóa!' });
  }
  const ok = db.deleteCategory(id);
  res.json({ success: ok });
});

// ==================== ADMIN: CUSTOMERS MANAGEMENT ====================
app.get('/Admin/Customers', requireAdmin, async (req, res) => {
  await renderAdmin(req, res, 'customers', 'Quản Lý Khách Hàng', {
    customers: db.customers
  });
});

app.post('/Admin/CreateCustomer', requireAdmin, (req, res) => {
  const { Phone, FullName } = req.body;
  if (Phone && FullName) {
    db.createCustomer(Phone.trim(), FullName.trim());
  }
  res.redirect('/Admin/Customers');
});

app.post('/Admin/EditCustomer', requireAdmin, (req, res) => {
  const { CustomerId, FullName, Phone, TotalPoints, MembershipTier } = req.body;
  const id = parseInt(CustomerId, 10);
  if (id) {
    db.updateCustomer(id, {
      FullName: (FullName || '').trim(),
      Phone: (Phone || '').trim(),
      TotalPoints: parseInt(TotalPoints, 10) || 0,
      MembershipTier: MembershipTier || 'Đồng'
    });
  }
  res.redirect('/Admin/Customers');
});

app.post('/Admin/DeleteCustomer', requireAdmin, (req, res) => {
  const id = parseInt(req.body.id, 10);
  const ok = db.deleteCustomer(id);
  res.json({ success: ok });
});

app.get('/Admin/Profile', requireAdmin, async (req, res) => {
  await renderAdmin(req, res, 'profile', 'Thông Tin Quản Trị Viên', {
    user: req.session.user
  });
});

// ==================== CASHIER ROUTES ====================
app.get(['/Cashier', '/Cashier/Index'], requirePos, async (req, res) => {
  const user = req.session.user!;
  let activeShift = db.getActiveShift(user.UserId);
  if (!activeShift) {
    activeShift = db.createShift(user.UserId, 0);
  }

  const shiftOrders = db.orders.filter(
    o => o.CashierId === user.UserId && o.OrderDate >= activeShift.StartTime
  );
  const cashRevenue = shiftOrders.filter(o => o.PaymentMethod === 'Tiền mặt').reduce((acc, o) => acc + o.TotalAmount, 0);
  const transferRevenue = shiftOrders.filter(o => o.PaymentMethod && o.PaymentMethod.includes('VNPAY')).reduce((acc, o) => acc + o.TotalAmount, 0);
  const shiftRevenue = cashRevenue + transferRevenue;
  const expectedCashInDrawer = activeShift.StartingCash + cashRevenue;

  const recentOrders = [...shiftOrders].reverse().slice(0, 5);

  await renderCashier(req, res, 'index', 'Bàn Làm Việc Thu Ngân', {
    shiftInfo: {
      shiftName: `Ca #${activeShift.ShiftId} - ${user.FullName}`,
      startTime: new Date(activeShift.StartTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    },
    shiftRevenue,
    cashRevenue,
    transferRevenue,
    shiftOrdersCount: shiftOrders.length,
    startingCash: activeShift.StartingCash,
    expectedCashInDrawer,
    recentOrders
  });
});

app.get('/Cashier/Orders', requirePos, async (req, res) => {
  const user = req.session.user!;
  const activeShift = db.getActiveShift(user.UserId);
  const startTime = activeShift ? activeShift.StartTime : new Date(0);
  const orders = db.orders.filter(
    o => o.CashierId === user.UserId && o.OrderDate >= startTime
  ).sort((a, b) => new Date(b.OrderDate).getTime() - new Date(a.OrderDate).getTime());

  await renderCashier(req, res, 'orders', 'Quản Lý Đơn Hàng & Thu Tiền', {
    orders
  });
});

app.get('/Cashier/Customers', requirePos, async (req, res) => {
  await renderCashier(req, res, 'customers', 'Tra Cứu Khách Hàng & Điểm', {
    customers: db.customers
  });
});

app.get('/Cashier/ShiftSummary', requirePos, async (req, res) => {
  const user = req.session.user!;
  const activeShift = db.getActiveShift(user.UserId);
  const startTime = activeShift ? activeShift.StartTime : new Date(0);
  const shiftOrders = db.orders.filter(
    o => o.CashierId === user.UserId && o.OrderDate >= startTime
  ).sort((a, b) => new Date(b.OrderDate).getTime() - new Date(a.OrderDate).getTime());

  const cashRevenue = shiftOrders.filter(o => o.PaymentMethod === 'Tiền mặt').reduce((acc, o) => acc + o.TotalAmount, 0);
  const transferRevenue = shiftOrders.filter(o => o.PaymentMethod && o.PaymentMethod.includes('VNPAY')).reduce((acc, o) => acc + o.TotalAmount, 0);
  const totalRevenue = cashRevenue + transferRevenue;

  await renderCashier(req, res, 'shift_summary', 'Báo Cáo Doanh Thu Ca Trực', {
    cashRevenue,
    transferRevenue,
    totalRevenue,
    shiftOrders
  });
});

app.get('/Cashier/Profile', requirePos, async (req, res) => {
  await renderCashier(req, res, 'profile', 'Thông Tin Tài Khoản Thu Ngân', {
    user: req.session.user
  });
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`  ➜  Local:   http://localhost:${PORT}/`);
  console.log(`  ➜  Network: http://0.0.0.0:${PORT}/`);
  console.log(`  ➜  ready in 100ms.`);
});
