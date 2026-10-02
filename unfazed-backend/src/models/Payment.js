import mongoose from 'mongoose';
const schema=new mongoose.Schema({
 therapist:{type:mongoose.Schema.Types.ObjectId,ref:'Therapist',required:true,index:true},
 client:{type:mongoose.Schema.Types.ObjectId,ref:'Client',required:true,index:true},
 session:{type:mongoose.Schema.Types.ObjectId,ref:'Session'},
 package:{type:mongoose.Schema.Types.ObjectId,ref:'Package'},
 purchaseKey:{type:String,unique:true,required:true},
 gateway_order_id:{type:String,unique:true,sparse:true},
 gateway_transaction_id:{type:String,unique:true,sparse:true},
 amount:{type:Number,required:true,min:1,validate:Number.isSafeInteger},
 currency:{type:String,default:'INR'},
 platform_fee:{type:Number,required:true,min:0},net_amount:{type:Number,required:true,min:0},
 subtotal:{type:Number,required:true,min:0},tax:{type:Number,default:0,min:0},
 status:{type:String,enum:['created','verified','failed','captured','order_error','refund_required','refunded'],default:'created'},
 orderRequestedAt:Date,verifiedAt:Date,capturedAt:Date,
 webhookEvents:{type:[String],select:false},
 packageSnapshot:mongoose.Schema.Types.Mixed,
 invoiceSnapshot:mongoose.Schema.Types.Mixed,
 invoiceNumber:{type:String,unique:true,sparse:true},
 failureReason:String,
},{timestamps:true});
export default mongoose.model('Payment',schema);
