import {Router} from 'express';
import {body} from 'express-validator';
import {authenticate,therapistOnly} from '../middleware/authMiddleware.js';
import {validate} from '../middleware/validate.js';
import {updateProfile} from '../controllers/therapistController.js';
const router=Router();
router.use(authenticate,therapistOnly);
router.get('/me',(req,res)=>res.json({therapist:req.therapist}));
router.patch('/me',
 body('name').optional().isString().trim().isLength({min:2,max:100}),
 body('bio').optional().isString().isLength({max:3000}),
 ...['specializations','languages'].flatMap(key=>[body(key).optional().isArray({max:20}),body(`${key}.*`).isString().trim().isLength({min:1,max:50})]),
 body('timezone').optional().custom(value=>{new Intl.DateTimeFormat('en',{timeZone:value});return true;}),
 body('services').optional().isArray({max:12}),
 body('services.*.name').isString().trim().isLength({min:2,max:100}),
 body('services.*.description').optional().isString().isLength({max:1000}),
 body('services.*.duration').isInt().isIn([30,45,60,90]),
 body('services.*.rate').isInt({min:0,max:100000000}),validate,updateProfile);
export default router;
