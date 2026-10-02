import {bookingIntake} from '../controllers/intakeController.js';
import {intakeRules} from './portalRoutes.js';
import {Router} from 'express';
import {body,query,param} from 'express-validator';
import {authenticate,therapistOnly} from '../middleware/authMiddleware.js';
import {requireFeature} from '../middleware/entitlementMiddleware.js';
import {validate} from '../middleware/validate.js';
import {assertWeekly,assertWindows} from '../services/schedulingService.js';
import {getAvailability,saveWeekly,slots,saveExceptions,saveSettings,book,sessions,waitlist,cancelSession,getBooking} from '../controllers/schedulingController.js';
export const publicScheduling=Router();
publicScheduling.get('/:slug/slots',query('from').isDate({format:'YYYY-MM-DD'}),query('to').isDate({format:'YYYY-MM-DD'}),query('duration').isInt().isIn([30,45,60,90]),validate,slots);
publicScheduling.post('/:slug/book',body('serviceId').isMongoId(),body('start').isISO8601({strict:true}),body('name').isString().trim().isLength({min:2,max:100}),body('email').isEmail().trim().toLowerCase(),validate,book);
publicScheduling.post('/:slug/waitlist',body('date').isDate({format:'YYYY-MM-DD'}),body('duration').isInt().isIn([30,45,60,90]),body('name').isString().trim().isLength({min:2,max:100}),body('email').isEmail().trim().toLowerCase(),validate,waitlist);
export const bookingRoutes=Router();
bookingRoutes.get('/:id',authenticate,param('id').isMongoId(),validate,getBooking);
bookingRoutes.post('/:id/intake',authenticate,param('id').isMongoId(),...intakeRules(),validate,bookingIntake);
const router=Router();router.use(authenticate,therapistOnly,requireFeature('scheduling'));
router.get('/sessions',sessions);
router.post('/sessions/:id/cancel',param('id').isMongoId(),validate,cancelSession);
router.get('/availability',getAvailability);
router.put('/availability/weekly',body('weekly').custom(assertWeekly),body('timezone').optional().custom(v=>{new Intl.DateTimeFormat('en',{timeZone:v});return true;}),validate,saveWeekly);
router.put('/availability/exceptions',
 body('overrides').isArray({max:100}).custom(list=>new Set(list.map(o=>o.date)).size===list.length),
 body('overrides.*.date').isDate({format:'YYYY-MM-DD'}),
 body('overrides.*.blocked').isBoolean({strict:true}),
 body('overrides.*.windows').custom(assertWindows),
 body('blocked').isArray({max:200}),
 body('blocked.*.start').isISO8601({strict:true}),body('blocked.*.end').isISO8601({strict:true}),
 body('blocked').custom(list=>list.every(b=>new Date(b.end)>new Date(b.start))),validate,saveExceptions);
router.put('/availability/settings',body('durations').isArray({min:1,max:4}).custom(v=>new Set(v).size===v.length&&v.every(d=>[30,45,60,90].includes(d))),body('bufferMinutes').isInt({min:0,max:120}),validate,saveSettings);
export default router;
