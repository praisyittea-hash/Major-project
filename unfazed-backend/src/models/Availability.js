import mongoose from 'mongoose';
const windowSchema=new mongoose.Schema({start:{type:String,required:true},end:{type:String,required:true}},{_id:false});
const schema=new mongoose.Schema({
 therapist:{type:mongoose.Schema.Types.ObjectId,ref:'Therapist',required:true,unique:true},
 timezone:{type:String,default:'Asia/Kolkata'},
 weekly:[{day:{type:Number,min:0,max:6,required:true},windows:[windowSchema],_id:false}],
 overrides:[{date:{type:String,required:true},windows:[windowSchema],blocked:{type:Boolean,default:false},_id:false}],
 blocked:[{start:{type:Date,required:true},end:{type:Date,required:true},_id:false}],
 durations:{type:[Number],default:[30,45,60,90]},
 bufferMinutes:{type:Number,default:10,min:0,max:120},
 revision:{type:Number,default:0},
},{timestamps:true});
export default mongoose.model('Availability',schema);
