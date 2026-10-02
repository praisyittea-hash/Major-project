import Razorpay from 'razorpay';
import {HttpError} from '../middleware/errorHandler.js';
export function razorpayConfig(env=process.env){
 if(!env.RAZORPAY_KEY_ID?.startsWith('rzp_test_')||!env.RAZORPAY_KEY_SECRET)throw new HttpError(503,'Razorpay test credentials are not configured');
 return {key_id:env.RAZORPAY_KEY_ID,key_secret:env.RAZORPAY_KEY_SECRET};
}
export function razorpayClient(){return new Razorpay(razorpayConfig());}
