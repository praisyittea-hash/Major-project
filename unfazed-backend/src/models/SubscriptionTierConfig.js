import mongoose from 'mongoose';
const schema=new mongoose.Schema({key:{type:String,unique:true,required:true},features:{type:Map,of:Boolean,default:{}},caps:{type:Map,of:Number,default:{}}},{timestamps:true});
export default mongoose.model('SubscriptionTierConfig',schema);
