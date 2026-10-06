import { Request, Response } from 'express';
import { db, User } from '../db.js';
import { renderAdmin } from '../middlewares/authMiddleware.js';
import { checkAndCancelExpiredVnPayOrders } from '../services/vnpayService.js';

export class AdminController {
  // Bảng điều khiển tổng quan Admin (Dashboard)
  static async index(req: Request, res: Response) {
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

    // Xu hướng doanh thu 7 ngày gần nhất
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

    // Top các món bán chạy nhất
    const soldMap = new Map<string, { product: any; count: number }>();
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
  }

  // Quản lý danh sách món ăn / thực đơn
  static async products(req: Request, res: Response) {
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
  }

  // Giao diện thêm món ăn mới
  static async createProductPage(req: Request, res: Response) {
    await renderAdmin(req, res, 'create_product', 'Thêm Món Ăn', {
      categories: db.categories
    });
  }

  // Xử lý thêm món ăn mới
  static createProduct(req: Request, res: Response) {
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
  }

  // Giao diện sửa món ăn
  static async editProductPage(req: Request, res: Response) {
    const id = parseInt(req.params.id, 10);
    const product = db.getProductById(id);
    if (!product) return res.status(404).send('Không tìm thấy món ăn!');

    await renderAdmin(req, res, 'edit_product', 'Chỉnh Sửa Món Ăn', {
      product,
      categories: db.categories
    });
  }

  // Xử lý lưu sửa món ăn
  static editProduct(req: Request, res: Response) {
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
  }

  // Xóa món ăn
  static deleteProduct(req: Request, res: Response) {
    const id = parseInt(req.body.id, 10);
    db.deleteProduct(id);
    res.redirect('/Admin/Products');
  }

  // Quản lý tồn kho
  static async inventory(req: Request, res: Response) {
    const products = db.products.map(p => ({
      ...p,
      Category: db.categories.find(c => c.CategoryId === p.CategoryId)
    }));
    await renderAdmin(req, res, 'inventory', 'Quản lý Tồn kho', { products, query: req.query });
  }

  // Cập nhật số lượng tồn kho qua AJAX
  static updateStock(req: Request, res: Response) {
    const id = parseInt(req.body.id, 10);
    const stock = parseInt(req.body.stock, 10);
    const ok = db.updateProduct(id, { StockQuantity: stock });
    if (ok) {
      return res.json({ success: true, message: 'Cập nhật kho thành công!' });
    }
    return res.json({ success: false, message: 'Không tìm thấy sản phẩm!' });
  }

  // Quản lý toàn bộ danh sách hóa đơn
  static async orders(req: Request, res: Response) {
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
  }

  // Chi tiết hóa đơn Admin
  static async orderDetails(req: Request, res: Response) {
    const id = parseInt(req.params.id, 10);
    const order = db.orders.find(o => o.OrderId === id);
    if (!order) return res.status(404).send('Không tìm thấy hóa đơn!');

    const details = db.getOrderDetails(id);
    const cashier = db.getUserById(order.CashierId);

    await renderAdmin(req, res, 'order_details', 'Chi Tiết Hóa Đơn', {
      order: { ...order, Cashier: cashier },
      details
    });
  }

  // Cập nhật trạng thái đơn hàng (Admin)
  static updateOrderStatus(req: Request, res: Response) {
    const isAjax = Boolean(
      req.xhr ||
      req.headers['x-requested-with'] === 'XMLHttpRequest' ||
      (req.headers.accept && req.headers.accept.includes('application/json')) ||
      (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) ||
      (req.body && req.body.ajax) ||
      (req.headers.accept && !req.headers.accept.includes('text/html'))
    );

    if (!req.session.user) {
      if (isAjax) return res.status(401).json({ success: false, message: 'Chưa đăng nhập!' });
      return res.redirect('/Account/Login');
    }

    const id = parseInt(req.body.orderId || req.body.id, 10);
    const status = req.body.status;
    const order = db.orders.find(o => o.OrderId === id);
    if (order) {
      if (status === 'Đang chuẩn bị món' || status === 'Pending' || status === 'Đang xử lý') {
        order.OrderStatus = 'Đang xử lý';
        order.ShippingStatus = 'Đang chuẩn bị món';
      } else if (status === 'Đang giao hàng' || status === 'Đang giao') {
        order.OrderStatus = 'Đang giao';
        order.ShippingStatus = 'Đang giao hàng';
      } else if (status === 'Đã giao thành công' || status === 'Hoàn tất' || status === 'Đã hoàn thành' || status === 'Completed') {
        order.OrderStatus = 'Hoàn tất';
        order.ShippingStatus = 'Đã giao thành công';
      } else if (status === 'Đã hủy' || status === 'Cancelled') {
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

      if (isAjax) {
        return res.json({ 
          success: true, 
          message: 'Đã cập nhật trạng thái đơn hàng #' + id + ' thành công!',
          orderId: id,
          orderStatus: order.OrderStatus,
          shippingStatus: order.ShippingStatus
        });
      }
      return res.redirect(`/Admin/OrderDetails/${id}`);
    }

    if (isAjax) {
      return res.json({ success: false, message: 'Không tìm thấy đơn hàng #' + id });
    }
    return res.redirect('/Admin/Orders');
  }

  // Báo cáo doanh thu chi tiết theo khoảng thời gian
  static async revenueReport(req: Request, res: Response) {
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
  }

  // Báo cáo tổng hợp
  static async reports(req: Request, res: Response) {
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
  }

  // Quản lý nhân viên
  static async staff(req: Request, res: Response) {
    const users = db.users.map(u => ({
      ...u,
      Role: db.getRoleById(u.RoleId)
    }));
    await renderAdmin(req, res, 'staff', 'Quản lý Nhân viên', { users });
  }

  // Thêm nhân viên
  static async createStaffPage(req: Request, res: Response) {
    await renderAdmin(req, res, 'create_staff', 'Thêm Nhân Viên', {
      roles: db.roles
    });
  }

  static createStaff(req: Request, res: Response) {
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
  }

  // Chỉnh sửa nhân viên
  static async editStaffPage(req: Request, res: Response) {
    const id = parseInt(req.params.id, 10);
    const editUser = db.getUserById(id);
    if (!editUser) return res.status(404).send('Không tìm thấy nhân viên!');

    await renderAdmin(req, res, 'edit_staff', 'Chỉnh Sửa Nhân Viên', {
      editUser,
      roles: db.roles
    });
  }

  static editStaff(req: Request, res: Response) {
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
  }

  // Xóa tài khoản nhân viên
  static deleteUser(req: Request, res: Response) {
    const id = parseInt(req.body.id, 10);
    const ok = db.deleteUser(id);
    res.json({ success: ok });
  }

  // Bảng tính lương nhân viên
  static async salaryReport(req: Request, res: Response) {
    const m = parseInt(req.query.month as string, 10) || new Date().getMonth() + 1;
    const y = parseInt(req.query.year as string, 10) || new Date().getFullYear();

    const shifts = db.shifts.filter(s => {
      if (!s.EndTime) return false;
      const sDate = new Date(s.StartTime);
      if (sDate.getMonth() + 1 !== m || sDate.getFullYear() !== y) return false;
      const u = db.getUserById(s.UserId);
      if (!u) return false;
      const r = db.getRoleById(u.RoleId);
      return r && r.RoleName !== 'Admin';
    });

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
  }

  // Quản lý danh mục
  static async categories(req: Request, res: Response) {
    await renderAdmin(req, res, 'categories', 'Quản Lý Danh Mục Món Ăn', {
      categories: db.categories,
      products: db.products
    });
  }

  static createCategory(req: Request, res: Response) {
    const { CategoryName } = req.body;
    if (CategoryName && CategoryName.trim()) {
      db.createCategory(CategoryName.trim());
    }
    res.redirect('/Admin/Categories');
  }

  static editCategory(req: Request, res: Response) {
    const { CategoryId, CategoryName } = req.body;
    const id = parseInt(CategoryId, 10);
    if (id && CategoryName && CategoryName.trim()) {
      db.updateCategory(id, CategoryName.trim());
    }
    res.redirect('/Admin/Categories');
  }

  static deleteCategory(req: Request, res: Response) {
    const id = parseInt(req.body.id, 10);
    const hasProducts = db.products.some(p => p.CategoryId === id);
    if (hasProducts) {
      return res.json({ success: false, message: 'Danh mục đang chứa món ăn, không thể xóa!' });
    }
    const ok = db.deleteCategory(id);
    res.json({ success: ok });
  }

  // Quản lý khách hàng
  static async customers(req: Request, res: Response) {
    await renderAdmin(req, res, 'customers', 'Quản Lý Khách Hàng', {
      customers: db.customers
    });
  }

  static createCustomer(req: Request, res: Response) {
    const { Phone, FullName } = req.body;
    if (Phone && FullName) {
      db.createCustomer(Phone.trim(), FullName.trim());
    }
    res.redirect('/Admin/Customers');
  }

  static editCustomer(req: Request, res: Response) {
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
  }

  static deleteCustomer(req: Request, res: Response) {
    const id = parseInt(req.body.id, 10);
    const ok = db.deleteCustomer(id);
    res.json({ success: ok });
  }

  // Thông tin quản trị viên
  static async profile(req: Request, res: Response) {
    await renderAdmin(req, res, 'profile', 'Thông Tin Quản Trị Viên', {
      user: req.session.user
    });
  }
}
