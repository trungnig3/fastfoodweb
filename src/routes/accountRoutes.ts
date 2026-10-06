import { Router } from 'express';
import { AccountController } from '../controllers/AccountController.js';

const router = Router();

router.get('/Login', AccountController.getLogin);
router.post('/Login', AccountController.postLogin);
router.get('/Register', AccountController.getRegister);
router.post('/Register', AccountController.postRegister);
router.get('/Logout', AccountController.logout);

export default router;
