import ClientPackage from '../models/ClientPackage.js';
import {HttpError} from '../middleware/errorHandler.js';
export async function activatePackage(payment,transaction){
 if(payment.status!=='captured'||!payment.packageSnapshot)throw new HttpError(409,'A captured package payment is required');
 const snapshot=payment.packageSnapshot;
 return ClientPackage.findOneAndUpdate({payment:payment.id},{$setOnInsert:{therapist:payment.therapist,client:payment.client,package:payment.package,name:snapshot.name,serviceId:snapshot.serviceId,sessionCount:snapshot.sessionCount,amount:payment.amount,perSessionRate:payment.amount/snapshot.sessionCount,baseRate:Math.floor(payment.amount/snapshot.sessionCount),rateRemainder:payment.amount%snapshot.sessionCount,expiresAt:new Date(new Date(payment.capturedAt).getTime()+snapshot.expiryDays*86400000)}},{upsert:true,new:true,session:transaction,runValidators:true});
}
export async function redeemPackage(id,client,therapist,service,start,transaction){
 const pkg=await ClientPackage.findOne({_id:id,client,therapist,status:'active'}).session(transaction);
 if(!pkg||String(pkg.serviceId)!==service.id)throw new HttpError(400,'This package does not cover the selected service');
 if(pkg.expiresAt<=new Date()||pkg.expiresAt<start)throw new HttpError(409,'Package expires before this session');
 if(pkg.usedSessions.length>=pkg.sessionCount)throw new HttpError(409,'No package sessions remaining');return pkg;
}
