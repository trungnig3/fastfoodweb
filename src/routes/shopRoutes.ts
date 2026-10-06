import { Router } from 'express';
import { ShopController } from '../controllers/ShopController.js';

const router = Router();

router.get(['/', '/Shop', '/Shop/Index', '/Home', '/Home/Index'], ShopController.index);
router.get(['/Shop/GetCustomerPoints', '/Customer/Points'], ShopController.getCustomerPoints);
router.get(['/Shop/TrackOrder', '/Order/Track'], ShopController.trackOrder);
router.post('/Shop/Checkout', ShopController.checkout);
router.get('/Shop/PaymentCallback', ShopController.paymentCallback);
router.post('/Shop/ChatBot', ShopController.chatBot);
router.post('/Shop/SendComplaint', ShopController.sendComplaint);

export default router;
