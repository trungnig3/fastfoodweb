import { Router } from 'express';
import { PosController } from '../controllers/PosController.js';
import { requirePos } from '../middlewares/authMiddleware.js';

const router = Router();

router.get(['/', '/Index'], requirePos, PosController.index);
router.post('/SaveStartingCash', requirePos, PosController.saveStartingCash);
router.post('/CloseShift', requirePos, PosController.closeShift);
router.get('/EndShiftReport', requirePos, PosController.endShiftReport);
router.post('/Checkout', requirePos, PosController.checkout);
router.get('/PaymentCallback', PosController.paymentCallback);
router.get('/FindCustomer', requirePos, PosController.findCustomer);
router.get('/GetOrderHistory', requirePos, PosController.getOrderHistory);

export default router;
