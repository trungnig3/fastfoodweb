// Data models & types for FastFood MVC Architecture

export interface Role {
  RoleId: number;
  RoleName: string;
}

export interface User {
  UserId: number;
  Username: string;
  PasswordHash: string;
  FullName: string;
  RoleId: number;
  HourlyRate: number;
  IsActive: boolean;
  PhoneNumber?: string;
  Email?: string;
}

export interface Category {
  CategoryId: number;
  CategoryName: string;
}

export interface Product {
  ProductId: number;
  ProductName: string;
  Description?: string;
  Price: number;
  ImageURL: string;
  IsCombo: boolean;
  IsActive: boolean;
  CategoryId: number;
  StockQuantity: number;
}

export interface Shift {
  ShiftId: number;
  UserId: number;
  StartTime: Date;
  EndTime: Date | null;
  StartingCash: number;
  ActualCash: number;
  CashDifference: number;
  TotalHours: number;
  StandardHours: number;
  OvertimeHours: number;
  OvertimeBonus: number;
  LatePenalty: number;
  TotalSalary: number;
}

export interface Customer {
  CustomerId: number;
  Phone: string;
  FullName: string;
  TotalPoints: number;
  MembershipTier: string;
}

export interface PointHistory {
  HistoryId: number;
  CustomerId: number;
  Points: number;
  Description: string;
  CreatedAt: Date;
}

export interface OrderDetail {
  DetailId: number;
  OrderId: number;
  ProductId: number;
  Quantity: number;
  UnitPrice: number;
}

export interface Order {
  OrderId: number;
  OrderCode: string;
  CashierId: number;
  CustomerId?: number;
  OrderDate: Date;
  OrderStatus: string;
  PaymentMethod: string;
  SubTotal?: number;
  DiscountAmount?: number;
  TotalAmount: number;
  ShippingFee?: number;
  ShippingAddress?: string;
  DeliveryAddress?: string;
  ShipperName?: string;
  ShipperPhone?: string;
  ShippingStatus?: string;
  CustomerPhone?: string;
  CustomerName?: string;
  Notes?: string;
  OrderDetails?: OrderDetail[];
}

export interface Complaint {
  ComplaintId: number;
  CustomerName?: string;
  Phone?: string;
  Content: string;
  CreatedAt: Date;
}

export interface Attendance {
  AttendanceId: number;
  UserId: number;
  Date: string; // YYYY-MM-DD
  CheckIn: Date;
  CheckOut: Date | null;
  TotalHours: number;
  Status: string;
}
