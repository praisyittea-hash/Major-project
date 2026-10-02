import mongoose from 'mongoose';
// Storage boundary for CRM history only. Note authoring is outside Day 1 scope.
const schema=new mongoose.Schema({therapist:{type:mongoose.Schema.Types.ObjectId,ref:'Therapist',required:true},client:{type:mongoose.Schema.Types.ObjectId,ref:'Client',required:true},session:{type:mongoose.Schema.Types.ObjectId,ref:'Session'},privateContent:{type:String,select:false},sharedContent:{type:String,default:''}},{timestamps:true});
schema.index({therapist:1,client:1});
export default mongoose.model('SessionNote',schema);
