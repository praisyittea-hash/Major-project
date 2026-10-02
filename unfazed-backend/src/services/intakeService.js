import mongoose from 'mongoose';
import Client from '../models/Client.js';
import ConsentAudit from '../models/ConsentAudit.js';
import {intakeTemplate} from '../config/intake.js';
import {HttpError} from '../middleware/errorHandler.js';
export async function persistIntake(client,body,transaction=null){
 const save=async session=>{
  if(body.consent?.accepted!==true||body.consent?.version!==intakeTemplate.consentVersion)throw new HttpError(400,'Explicit agreement to the current consent text is required');
  const now=new Date();
  const audit=await ConsentAudit.findOneAndUpdate({client:client.id,version:intakeTemplate.consentVersion},{$setOnInsert:{therapist:client.therapist,text:intakeTemplate.consentText,accepted:true,acceptedAt:now,name:client.name,source:'client-portal'}},{upsert:true,new:true,session});
  const updated=await Client.findOneAndUpdate({_id:client.id,therapist:client.therapist},{$set:{intake:{demographics:body.demographics,presentingConcern:body.presentingConcern,history:body.history,submittedAt:now,templateVersion:intakeTemplate.version},consentAt:audit.acceptedAt,consentVersion:audit.version}},{new:true,runValidators:true,session}).select('+intake');
  return updated;
 };
 return transaction?save(transaction):mongoose.connection.transaction(save);
}
