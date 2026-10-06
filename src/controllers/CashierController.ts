import { Request, Response } from 'express';
import { db } from '../db.js';
import { renderCashier } from '../middlewares/authMiddleware.js';

export class CashierController {
  // Bàn làm việc thu ngân
  static async index(req: Request, res: Response) {
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
  }

  // Quản lý đơn hàng trong ca trực
  static async orders(req: Request, res: Response) {
    const user = req.session.user!;
    const activeShift = db.getActiveShift(user.UserId);
    const startTime = activeShift ? activeShift.StartTime : new Date(0);
    const orders = db.orders.filter(
      o => o.CashierId === user.UserId && o.OrderDate >= startTime
    ).sort((a, b) => new Date(b.OrderDate).getTime() - new Date(a.OrderDate).getTime());

    await renderCashier(req, res, 'orders', 'Quản Lý Đơn Hàng & Thu Tiền', {
      orders
    });
  }

  // Chi tiết hóa đơn bán hàng cho thu ngân
  static async orderDetails(req: Request, res: Response) {
    const id = parseInt(req.params.id, 10);
    const order = db.orders.find(o => o.OrderId === id);
    if (!order) return res.status(404).send('Không tìm thấy hóa đơn!');

    const details = db.getOrderDetails(id);
    const cashier = db.getUserById(order.CashierId);

    await renderCashier(req, res, 'order_details', 'Chi Tiết Hóa Đơn', {
      order: { ...order, Cashier: cashier },
      details
    });
  }

  // Cập nhật trạng thái đơn hàng (Thu ngân)
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
      return res.redirect(`/Cashier/OrderDetails/${id}`);
    }

    if (isAjax) {
      return res.json({ success: false, message: 'Không tìm thấy đơn hàng #' + id });
    }
    return res.redirect('/Cashier/Orders');
  }

  // Tra cứu danh sách thành viên tích điểm
  static async customers(req: Request, res: Response) {
    await renderCashier(req, res, 'customers', 'Tra Cứu Khách Hàng & Điểm', {
      customers: db.customers
    });
  }

  // Báo cáo doanh thu ca trực thu ngân
  static async shiftSummary(req: Request, res: Response) {
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
  }

  // Thông tin tài khoản thu ngân
  static async profile(req: Request, res: Response) {
    await renderCashier(req, res, 'profile', 'Thông Tin Tài Khoản Thu Ngân', {
      user: req.session.user
    });
  }
}
