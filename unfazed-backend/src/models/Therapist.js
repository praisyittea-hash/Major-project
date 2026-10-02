import mongoose from 'mongoose';
const serviceSchema = new mongoose.Schema({
  name: {type:String,required:true,maxLength:100},
  description: {type:String,maxLength:1000},
  duration: {type:Number,enum:[30,45,60,90],default:60},
  rate: {type:Number,min:0,validate:Number.isSafeInteger,default:0}, // integer paise
});
const schema = new mongoose.Schema({
  email: {type:String,required:true,unique:true,lowercase:true,trim:true},
  password_hash: {type:String,required:true,select:false},
  name: {type:String,required:true,trim:true,maxLength:100},
  slug: {type:String,unique:true,sparse:true,lowercase:true,trim:true},
  bio: {type:String,default:'',maxLength:3000},
  specializations: [{type:String,maxLength:100}],
  languages: [{type:String,maxLength:50}],
  services: [serviceSchema],
  timezone: {type:String,default:'Asia/Kolkata'},
  subscriptionConfig: {type:String,default:'default',select:false},
}, {timestamps:true});
schema.set('toJSON',{transform:(_doc,value)=>{delete value.password_hash;delete value.subscriptionConfig;return value;}});
export default mongoose.model('Therapist',schema);
