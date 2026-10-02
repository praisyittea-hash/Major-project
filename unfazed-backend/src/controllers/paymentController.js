import {sessionOrder,ownedPayment,gatewayFor} from '../services/paymentService.js';
import {generateInvoice} from '../services/invoiceService.js';
import Payment from '../models/Payment.js';
import Session from '../models/Session.js';
import {HttpError} from '../middleware/errorHandler.js';
export async function createSessionOrder(req,res){res.status(201).json(await sessionOrder(req));}
export async function getPayment(req,res){res.json({payment:await ownedPayment(req)});}
export async function verifyPayment(req,res){
 const payment=await ownedPayment(req),gateway=gatewayFor(req);
 if(payment.gateway_order_id!==req.body.razorpay_order_id||!gateway.verifyCheckout(payment.gateway_order_id,req.body.razorpay_payment_id,req.body.razorpay_signature))throw new HttpError(400,'Payment signature is invalid');
 const remote=await gateway.fetchPayment(req.body.razorpay_payment_id);
 if(!remote||remote.order_id!==payment.gateway_order_id||remote.amount!==payment.amount||remote.currency!==payment.currency)throw new HttpError(400,'Payment details do not match the order');
 if(['captured','refund_required','refunded'].includes(payment.status))return res.json({payment});
 if(remote.status==='failed'){payment.status='failed';payment.failureReason='Gateway reported a failed attempt';await payment.save();if(payment.session)await Session.updateOne({_id:payment.session,paymentStatus:{$ne:'paid'}},{$set:{paymentStatus:'failed'}});throw new HttpError(402,'Payment failed; please retry checkout');}
 if(!['authorized','captured'].includes(remote.status))throw new HttpError(409,'Payment is not yet authorized');
 const updated=await Payment.findOneAndUpdate({_id:payment.id,status:{$in:['created','failed','verified']}},{$set:{status:'verified',verifiedAt:new Date(),gateway_transaction_id:remote.id}},{new:true,runValidators:true});
 res.json({payment:updated||await Payment.findById(payment.id),message:'Verified. Awaiting webhook confirmation.'});
}
export async function listPayments(req,res){res.json({payments:await Payment.find({therapist:req.therapist.id}).sort({createdAt:-1}).limit(200)});}
export async function downloadInvoice(req,res){const payment=await ownedPayment(req);const pdf=await generateInvoice(payment);res.set('Content-Type','application/pdf');res.set('Content-Disposition',`attachment; filename="${payment.invoiceNumber}.pdf"`);res.set('Cache-Control','private, no-store');res.send(pdf);}
