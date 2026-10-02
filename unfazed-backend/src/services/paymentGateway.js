import {createHmac,timingSafeEqual} from 'node:crypto';
import {razorpayClient,razorpayConfig} from '../config/razorpay.js';
import {HttpError} from '../middleware/errorHandler.js';
export function matchesSignature(body,signature,secret){if(!secret||typeof signature!=='string'||!/^[a-f0-9]{64}$/i.test(signature))return false;const expected=createHmac('sha256',secret).update(body).digest();return timingSafeEqual(expected,Buffer.from(signature,'hex'));}
export const paymentGateway={
 createOrder:async data=>{try{return await razorpayClient().orders.create(data);}catch(e){if(e instanceof HttpError)throw e;throw new HttpError(502,'Payment gateway order creation failed; please retry');}},
 fetchPayment:async id=>{try{return await razorpayClient().payments.fetch(id);}catch(e){if(e instanceof HttpError)throw e;throw new HttpError(502,'Payment gateway verification unavailable');}},
 publicKey:()=>razorpayConfig().key_id,
 verifyCheckout:(orderId,paymentId,signature)=>matchesSignature(`${orderId}|${paymentId}`,signature,razorpayConfig().key_secret),
 verifyWebhook:(raw,signature)=>matchesSignature(raw,signature,process.env.RAZORPAY_WEBHOOK_SECRET),
};
