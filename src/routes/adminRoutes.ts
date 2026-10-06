import { Router } from 'express';
import { AdminController } from '../controllers/AdminController.js';
import { requireAdmin } from '../middlewares/authMiddleware.js';

const router = Router();

// Dashboard
router.get(['/', '/Index'], requireAdmin, AdminController.index);

// Products
router.get('/Products', requireAdmin, AdminController.products);
router.get('/CreateProduct', requireAdmin, AdminController.createProductPage);
router.post('/CreateProduct', requireAdmin, AdminController.createProduct);
router.get('/EditProduct/:id', requireAdmin, AdminController.editProductPage);
router.post('/EditProduct/:id', requireAdmin, AdminController.editProduct);
router.post('/DeleteProduct', requireAdmin, AdminController.deleteProduct);

// Inventory
router.get('/Inventory', requireAdmin, AdminController.inventory);
router.post('/UpdateStock', requireAdmin, AdminController.updateStock);

// Orders
router.get('/Orders', requireAdmin, AdminController.orders);
router.get('/OrderDetails/:id', requireAdmin, AdminController.orderDetails);
router.post('/UpdateOrderStatus', AdminController.updateOrderStatus);

// Reports
router.get('/RevenueReport', requireAdmin, AdminController.revenueReport);
router.get('/Reports', requireAdmin, AdminController.reports);
router.get('/SalaryReport', requireAdmin, AdminController.salaryReport);

// Staff
router.get('/Staff', requireAdmin, AdminController.staff);
router.get('/CreateStaff', requireAdmin, AdminController.createStaffPage);
router.post('/CreateStaff', requireAdmin, AdminController.createStaff);
router.get('/EditStaff/:id', requireAdmin, AdminController.editStaffPage);
router.post('/EditStaff/:id', requireAdmin, AdminController.editStaff);
router.post('/DeleteUser', requireAdmin, AdminController.deleteUser);

// Categories
router.get('/Categories', requireAdmin, AdminController.categories);
router.post('/CreateCategory', requireAdmin, AdminController.createCategory);
router.post('/EditCategory', requireAdmin, AdminController.editCategory);
router.post('/DeleteCategory', requireAdmin, AdminController.deleteCategory);

// Customers
router.get('/Customers', requireAdmin, AdminController.customers);
router.post('/CreateCustomer', requireAdmin, AdminController.createCustomer);
router.post('/EditCustomer', requireAdmin, AdminController.editCustomer);
router.post('/DeleteCustomer', requireAdmin, AdminController.deleteCustomer);

// Reviews & Complaints
router.get(['/Reviews', '/Complaints'], requireAdmin, AdminController.reviews);
router.post('/ReplyReview', requireAdmin, AdminController.replyReview);
router.post('/DeleteReview', requireAdmin, AdminController.deleteReview);

// Profile
router.get('/Profile', requireAdmin, AdminController.profile);

export default router;
