import {Router} from 'express';
import {param} from 'express-validator';
import {authenticate} from '../middleware/authMiddleware.js';
import {validate} from '../middleware/validate.js';
import {createSessionOrder,getPayment} from '../controllers/paymentController.js';
const router=Router();router.use(authenticate);
router.post('/session/:id/orders',param('id').isMongoId(),validate,createSessionOrder);
router.get('/:id',param('id').isMongoId(),validate,getPayment);
export default router;
