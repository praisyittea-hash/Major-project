import mongoose from 'mongoose';
import {formatInTimeZone} from 'date-fns-tz';
import Availability from '../models/Availability.js';
import Session from '../models/Session.js';
import {availableSlots} from './schedulingService.js';
import {HttpError} from '../middleware/errorHandler.js';
// Every booking writes the same therapist availability document in a transaction.
// MongoDB retries write conflicts; the retried slot check sees the winning booking.
export async function createBooking(therapist,service,contact,start){
 return mongoose.connection.transaction(async transaction=>{
  const availability=await Availability.findOneAndUpdate({therapist:therapist.id},{$inc:{revision:1}},{new:true,session:transaction});
  if(!availability)throw new HttpError(409,'No availability configured');
  const date=formatInTimeZone(start,availability.timezone,'yyyy-MM-dd');
  const offered=await availableSlots(therapist.id,date,date,service.duration,transaction);
  if(!offered.some(s=>s.start===start.toISOString()))throw new HttpError(409,'This time is no longer available');
  const [session]=await Session.create([{therapist:therapist.id,contact,serviceId:service.id,start,end:new Date(start.getTime()+service.duration*60000),duration:service.duration,bufferMinutes:availability.bufferMinutes,rate:service.rate}],{session:transaction});
  return session;
 });
}
