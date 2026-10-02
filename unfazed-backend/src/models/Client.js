import mongoose from 'mongoose';
const intakeSchema=new mongoose.Schema({
 demographics:{age:{type:Number,min:0,max:120},pronouns:{type:String,maxLength:50},location:{type:String,maxLength:200},occupation:{type:String,maxLength:200}},
 presentingConcern:{type:String,maxLength:5000},
 history:{priorTherapy:{type:String,maxLength:3000},medicalHistory:{type:String,maxLength:3000},medications:{type:String,maxLength:3000}},
 submittedAt:Date,templateVersion:String,
},{_id:false});
const schema=new mongoose.Schema({
 therapist:{type:mongoose.Schema.Types.ObjectId,ref:'Therapist',required:true,index:true},
 name:{type:String,required:true,trim:true,maxLength:100},email:{type:String,required:true,trim:true,lowercase:true},
 phone:{type:String,maxLength:30},status:{type:String,enum:['active','inactive','archived'],default:'active'},
 tags:[{label:{type:String,required:true,maxLength:50},_id:false}],
 lastSession:Date,
 intake:{type:intakeSchema,select:false},
 consentAt:Date,consentVersion:String,
},{timestamps:true});
schema.index({therapist:1,email:1},{unique:true});
export default mongoose.model('Client',schema);
