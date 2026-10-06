// In-memory data store for FastFoodWeb
export * from './models/types.js';
import {
  Role,
  User,
  Category,
  Product,
  Shift,
  Customer,
  PointHistory,
  OrderDetail,
  Order,
  Complaint
} from './models/types.js';

class Database {
  roles: Role[] = [
    { RoleId: 1, RoleName: 'Admin' },
    { RoleId: 2, RoleName: 'Cashier' },
    { RoleId: 3, RoleName: 'Customer' }
  ];

  users: User[] = [
    {
      UserId: 1,
      Username: 'admin',
      PasswordHash: '123456',
      FullName: 'Quản Trị Viên (ADMIN)',
      RoleId: 1,
      HourlyRate: 35000,
      IsActive: true,
      PhoneNumber: '0900000001',
      Email: 'admin@fastfoodexpress.vn'
    },
    {
      UserId: 2,
      Username: 'thungan',
      PasswordHash: '123',
      FullName: 'Thu Ngân Quầy Bán Hàng (THU NGÂN)',
      RoleId: 2,
      HourlyRate: 25000,
      IsActive: true,
      PhoneNumber: '0900000002',
      Email: 'thungan@fastfoodexpress.vn'
    },
    {
      UserId: 3,
      Username: 'khachhang',
      PasswordHash: '123',
      FullName: 'Nguyễn Văn Khách (KHÁCH HÀNG)',
      RoleId: 3,
      HourlyRate: 0,
      IsActive: true,
      PhoneNumber: '0987654321',
      Email: 'khachhang@gmail.com'
    }
  ];

  categories: Category[] = [
    { CategoryId: 1, CategoryName: 'Đồ ăn nhanh' },
    { CategoryId: 2, CategoryName: 'Combo Tiết Kiệm' },
    { CategoryId: 3, CategoryName: 'Đồ uống & Tráng miệng' }
  ];

  products: Product[] = [
    {
      ProductId: 1,
      ProductName: 'Gà Rán Giòn Cay',
      Description: 'Miếng gà tươi tẩm ướp 11 loại gia vị bí truyền, chiên vàng giòn rụm bên ngoài, mọng nước bên trong với vị cay nồng đặc trưng.',
      Price: 45000,
      ImageURL: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=500',
      IsCombo: false,
      IsActive: true,
      CategoryId: 1,
      StockQuantity: 50
    },
    {
      ProductId: 2,
      ProductName: 'Burger Bò Phô Mai',
      Description: 'Bánh mì hạt mè kẹp thịt bò nướng than hoa thượng hạng, phô mai Cheddar tan chảy, xà lách tươi và sốt đặc biệt.',
      Price: 55000,
      ImageURL: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500',
      IsCombo: false,
      IsActive: true,
      CategoryId: 1,
      StockQuantity: 40
    },
    {
      ProductId: 3,
      ProductName: 'Khoai Tây Chiên (L)',
      Description: 'Khoai tây vàng giòn kiểu Pháp, rắc muối tiêu biển thơm lừng, dùng kèm tương ớt hoặc sốt mayonnaise.',
      Price: 30000,
      ImageURL: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=500',
      IsCombo: false,
      IsActive: true,
      CategoryId: 1,
      StockQuantity: 60
    },
    {
      ProductId: 4,
      ProductName: 'Nước Ngọt Pepsi',
      Description: 'Nước ngọt có gas Pepsi ướp lạnh sảng khoái, xua tan cảm giác ngấy và tiếp thêm năng lượng.',
      Price: 15000,
      ImageURL: 'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=500',
      IsCombo: false,
      IsActive: true,
      CategoryId: 3,
      StockQuantity: 100
    },
    {
      ProductId: 5,
      ProductName: 'Combo 1: Gà Rán + Khoai + Pepsi',
      Description: 'Phần ăn tiết kiệm bao gồm 1 miếng gà rán giòn cay, 1 phần khoai tây chiên cỡ vừa và 1 ly Pepsi mát lạnh.',
      Price: 80000,
      ImageURL: 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=500',
      IsCombo: true,
      IsActive: true,
      CategoryId: 2,
      StockQuantity: 35
    },
    {
      ProductId: 6,
      ProductName: 'Combo 2: Burger Bò + Khoai + Pepsi',
      Description: 'Combo bán chạy nhất: 1 burger bò phô mai béo ngậy, 1 khoai tây chiên vàng giòn và 1 ly Pepsi mát lạnh.',
      Price: 90000,
      ImageURL: 'https://images.unsplash.com/photo-1561758033-d89a9ad46330?w=500',
      IsCombo: true,
      IsActive: true,
      CategoryId: 2,
      StockQuantity: 30
    },
    {
      ProductId: 7,
      ProductName: 'Combo Gia Đình (2 Gà + 2 Burger + 2 Pepsi)',
      Description: 'Bữa tiệc no nê cho nhóm và gia đình: 2 miếng gà rán giòn rụm, 2 burger bò phô mai đậm đà và 2 lon Pepsi mát lạnh.',
      Price: 180000,
      ImageURL: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=500',
      IsCombo: true,
      IsActive: true,
      CategoryId: 2,
      StockQuantity: 20
    },
    {
      ProductId: 8,
      ProductName: 'Kem Sundae Dâu Tây Giòn',
      Description: 'Kem tươi vani sánh mịn phủ sốt dâu tây chua ngọt tự nhiên và bánh quế giòn tan (Món tráng miệng đặc biệt - hiện tạm hết hàng trong kho).',
      Price: 25000,
      ImageURL: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=500',
      IsCombo: false,
      IsActive: true,
      CategoryId: 3,
      StockQuantity: 0
    }
  ];

  customers: Customer[] = [
    {
      CustomerId: 1,
      Phone: '0987654321',
      FullName: 'Nguyễn Văn Khách',
      TotalPoints: 35,
      MembershipTier: 'Bạc'
    }
  ];

  pointHistories: PointHistory[] = [
    {
      HistoryId: 1,
      CustomerId: 1,
      Points: 35,
      Description: 'Cộng điểm mở tài khoản thành viên',
      CreatedAt: new Date(Date.now() - 86400000 * 3)
    }
  ];

  shifts: Shift[] = [];
  orders: Order[] = [];
  orderDetails: OrderDetail[] = [];
  complaints: Complaint[] = [];

  private nextProductId = 9;
  private nextUserId = 4;
  private nextShiftId = 1;
  private nextOrderId = 1;
  private nextDetailId = 1;
  private nextCustomerId = 2;
  private nextHistoryId = 2;
  private nextComplaintId = 1;

  constructor() {
    // Seed some initial orders for demonstration
    this.seedOrders();
  }

  private seedOrders() {
    const order1: Order = {
      OrderId: this.nextOrderId++,
      OrderCode: 'HD' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '1001',
      CashierId: 2,
      CustomerId: 1,
      CustomerPhone: '0987654321',
      OrderDate: new Date(Date.now() - 3600000 * 4),
      OrderStatus: 'Hoàn tất',
      PaymentMethod: 'Tiền mặt',
      SubTotal: 125000,
      TotalAmount: 125000,
      ShippingAddress: 'Mua tại quầy (POS)'
    };
    this.orders.push(order1);
    this.orderDetails.push(
      { DetailId: this.nextDetailId++, OrderId: order1.OrderId, ProductId: 1, Quantity: 1, UnitPrice: 45000 },
      { DetailId: this.nextDetailId++, OrderId: order1.OrderId, ProductId: 5, Quantity: 1, UnitPrice: 80000 }
    );

    const order2: Order = {
      OrderId: this.nextOrderId++,
      OrderCode: 'ONLINE' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '7842',
      CashierId: 1,
      CustomerId: 1,
      CustomerPhone: '0987654321',
      OrderDate: new Date(Date.now() - 75 * 1000), // Đặt 75 giây trước (đang trong 5 phút chuẩn bị)
      OrderStatus: 'Processing',
      PaymentMethod: 'COD',
      SubTotal: 55000,
      TotalAmount: 55000,
      ShippingAddress: 'hn',
      ShipperName: 'Lê Hoàng Tốc Độ',
      ShipperPhone: '0987654321',
      ShippingStatus: 'Đang chuẩn bị món'
    };
    this.orders.push(order2);
    this.orderDetails.push(
      { DetailId: this.nextDetailId++, OrderId: order2.OrderId, ProductId: 2, Quantity: 1, UnitPrice: 55000 }
    );

    // Seed completed past shift for salary calculation demonstration
    const pastShift: Shift = {
      ShiftId: this.nextShiftId++,
      UserId: 2,
      StartTime: new Date(Date.now() - 86400000),
      EndTime: new Date(Date.now() - 86400000 + 3600000 * 9), // 9 hours (8 standard + 1 OT)
      StartingCash: 500000,
      ActualCash: 625000,
      CashDifference: 0,
      TotalHours: 9,
      StandardHours: 8,
      OvertimeHours: 1,
      OvertimeBonus: 1 * 25000 * 1.5,
      LatePenalty: 0,
      TotalSalary: 8 * 25000 + 1 * 25000 * 1.5
    };
    this.shifts.push(pastShift);
  }

  // Helper query methods
  getUser(username: string): User | undefined {
    const cleanUser = (username || '').trim().toLowerCase();
    return this.users.find(u => u.Username.toLowerCase() === cleanUser && u.IsActive);
  }

  getUserByEmail(email: string): User | undefined {
    const clean = (email || '').trim().toLowerCase();
    if (!clean) return undefined;
    return this.users.find(u => u.Email && u.Email.toLowerCase() === clean && u.IsActive);
  }

  getUserByPhone(phone: string): User | undefined {
    const clean = (phone || '').trim().replace(/[\s.-]/g, '');
    if (!clean) return undefined;
    return this.users.find(u => u.PhoneNumber && u.PhoneNumber.replace(/[\s.-]/g, '') === clean && u.IsActive);
  }

  getUserByEmailOrPhone(query: string): User | undefined {
    const clean = (query || '').trim();
    if (!clean) return undefined;
    return this.getUserByEmail(clean) || this.getUserByPhone(clean) || this.getUser(clean);
  }

  getUserById(id: number): User | undefined {
    return this.users.find(u => u.UserId === id);
  }

  getRoleById(id: number): Role | undefined {
    return this.roles.find(r => r.RoleId === id);
  }

  getActiveShift(userId: number): Shift | undefined {
    return this.shifts
      .filter(s => s.UserId === userId && s.EndTime === null)
      .sort((a, b) => b.StartTime.getTime() - a.StartTime.getTime())[0];
  }

  getLatestShift(userId: number): Shift | undefined {
    return this.shifts
      .filter(s => s.UserId === userId)
      .sort((a, b) => b.StartTime.getTime() - a.StartTime.getTime())[0];
  }

  createShift(userId: number, startingCash: number = 0): Shift {
    const shift: Shift = {
      ShiftId: this.nextShiftId++,
      UserId: userId,
      StartTime: new Date(),
      EndTime: null,
      StartingCash: startingCash,
      ActualCash: 0,
      CashDifference: 0,
      TotalHours: 0,
      StandardHours: 0,
      OvertimeHours: 0,
      OvertimeBonus: 0,
      LatePenalty: 0,
      TotalSalary: 0
    };
    this.shifts.push(shift);
    return shift;
  }

  getProductById(id: number): Product | undefined {
    return this.products.find(p => p.ProductId === id);
  }

  createProduct(data: Omit<Product, 'ProductId'>): Product {
    const product: Product = {
      ...data,
      ProductId: this.nextProductId++
    };
    this.products.push(product);
    return product;
  }

  updateProduct(id: number, data: Partial<Product>): boolean {
    const p = this.getProductById(id);
    if (!p) return false;
    Object.assign(p, data);
    return true;
  }

  deleteProduct(id: number): boolean {
    const idx = this.products.findIndex(p => p.ProductId === id);
    if (idx !== -1) {
      this.products.splice(idx, 1);
      return true;
    }
    return false;
  }

  createUser(data: Omit<User, 'UserId'>): User {
    const user: User = {
      ...data,
      UserId: this.nextUserId++
    };
    this.users.push(user);
    return user;
  }

  updateUser(id: number, data: Partial<User>): boolean {
    const u = this.getUserById(id);
    if (!u) return false;
    Object.assign(u, data);
    return true;
  }

  deleteUser(id: number): boolean {
    const idx = this.users.findIndex(u => u.UserId === id);
    if (idx !== -1) {
      this.users.splice(idx, 1);
      return true;
    }
    return false;
  }

  createOrder(data: Omit<Order, 'OrderId'>): Order {
    const order: Order = {
      ...data,
      OrderId: this.nextOrderId++
    };
    this.orders.push(order);
    return order;
  }

  addOrderDetail(detail: Omit<OrderDetail, 'DetailId'>): OrderDetail {
    const d: OrderDetail = {
      ...detail,
      DetailId: this.nextDetailId++
    };
    this.orderDetails.push(d);
    return d;
  }

  getOrderDetails(orderId: number): (OrderDetail & { Product?: Product })[] {
    return this.orderDetails
      .filter(d => d.OrderId === orderId)
      .map(d => ({
        ...d,
        Product: this.getProductById(d.ProductId)
      }));
  }

  getCustomerByPhone(phone: string): Customer | undefined {
    return this.customers.find(c => c.Phone === phone);
  }

  getCustomerById(id: number): Customer | undefined {
    return this.customers.find(c => c.CustomerId === id);
  }

  createCustomer(phone: string, fullName: string): Customer {
    const customer: Customer = {
      CustomerId: this.nextCustomerId++,
      Phone: phone,
      FullName: fullName,
      TotalPoints: 0,
      MembershipTier: 'Đồng'
    };
    this.customers.push(customer);
    return customer;
  }

  addPointHistory(customerId: number, points: number, description: string): PointHistory {
    const h: PointHistory = {
      HistoryId: this.nextHistoryId++,
      CustomerId: customerId,
      Points: points,
      Description: description,
      CreatedAt: new Date()
    };
    this.pointHistories.push(h);
    return h;
  }

  getPointHistory(customerId: number): PointHistory[] {
    return this.pointHistories
      .filter(h => h.CustomerId === customerId)
      .sort((a, b) => new Date(b.CreatedAt).getTime() - new Date(a.CreatedAt).getTime());
  }

  calculateMembershipTier(points: number): string {
    if (points >= 300) return 'Kim Cương';
    if (points >= 150) return 'Vàng';
    if (points >= 50) return 'Bạc';
    return 'Đồng';
  }

  updateCustomer(id: number, data: Partial<Customer>): boolean {
    const c = this.getCustomerById(id);
    if (!c) return false;
    Object.assign(c, data);
    return true;
  }

  deleteCustomer(id: number): boolean {
    const idx = this.customers.findIndex(c => c.CustomerId === id);
    if (idx !== -1) {
      this.customers.splice(idx, 1);
      return true;
    }
    return false;
  }

  getCategoryById(id: number): Category | undefined {
    return this.categories.find(c => c.CategoryId === id);
  }

  createCategory(name: string): Category {
    const maxId = this.categories.reduce((m, c) => Math.max(m, c.CategoryId), 0);
    const cat: Category = {
      CategoryId: maxId + 1,
      CategoryName: name
    };
    this.categories.push(cat);
    return cat;
  }

  updateCategory(id: number, name: string): boolean {
    const cat = this.getCategoryById(id);
    if (!cat) return false;
    cat.CategoryName = name;
    return true;
  }

  deleteCategory(id: number): boolean {
    const idx = this.categories.findIndex(c => c.CategoryId === id);
    if (idx !== -1) {
      this.categories.splice(idx, 1);
      return true;
    }
    return false;
  }

  addComplaint(data: Omit<Complaint, 'ComplaintId' | 'CreatedAt'>): Complaint {
    const complaint: Complaint = {
      ...data,
      ComplaintId: this.nextComplaintId++,
      CreatedAt: new Date()
    };
    this.complaints.push(complaint);
    return complaint;
  }
}

export const db = new Database();
