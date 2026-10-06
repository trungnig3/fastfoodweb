import { Router } from 'express';
import { CashierController } from '../controllers/CashierController.js';
import { requirePos } from '../middlewares/authMiddleware.js';

const router = Router();

router.get(['/', '/Index'], requirePos, CashierController.index);
router.get('/Orders', requirePos, CashierController.orders);
router.get('/OrderDetails/:id', requirePos, CashierController.orderDetails);
router.post('/UpdateOrderStatus', CashierController.updateOrderStatus);
router.get('/Customers', requirePos, CashierController.customers);
router.get('/ShiftSummary', requirePos, CashierController.shiftSummary);
router.get('/Profile', requirePos, CashierController.profile);

export default router;
