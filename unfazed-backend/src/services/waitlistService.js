import {formatInTimeZone} from 'date-fns-tz';
import Availability from '../models/Availability.js';
import Waitlist from '../models/Waitlist.js';
import {notificationService} from './notificationService.js';
export async function notifyWaitlist(session){
 const availability=await Availability.findOne({therapist:session.therapist});if(!availability)return;
 const date=formatInTimeZone(session.start,availability.timezone,'yyyy-MM-dd');
 const entries=await Waitlist.find({therapist:session.therapist,date,notificationQueuedAt:{$exists:false}});
 for(const entry of entries){await notificationService.queue({key:`waitlist:${session.id}:${entry.id}`,kind:'slot_available',recipient:entry.email,payload:{date,duration:entry.duration}});entry.notificationQueuedAt=new Date();await entry.save();}
}
