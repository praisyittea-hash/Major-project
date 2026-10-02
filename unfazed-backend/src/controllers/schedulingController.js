import {createBooking} from '../services/bookingService.js';
import Session from '../models/Session.js';
import {issueToken} from '../services/tokenService.js';
import Waitlist from '../models/Waitlist.js';
import {notifyWaitlist} from '../services/waitlistService.js';
import {availabilityChanged} from '../sockets/schedulingSocket.js';
import Availability from '../models/Availability.js';
import Therapist from '../models/Therapist.js';
import {availableSlots} from '../services/schedulingService.js';
import {HttpError} from '../middleware/errorHandler.js';
import {hasFeature} from '../services/entitlementService.js';
export async function getAvailability(req,res){const availability=await Availability.findOne({therapist:req.therapist.id});res.json({availability:availability||{timezone:req.therapist.timezone,weekly:[],overrides:[],blocked:[],durations:[30,45,60,90],bufferMinutes:10}});}
export async function saveWeekly(req,res){const availability=await Availability.findOneAndUpdate({therapist:req.therapist.id},{$set:{weekly:req.body.weekly,timezone:req.body.timezone||req.therapist.timezone},$inc:{revision:1}},{upsert:true,new:true,runValidators:true});res.json({availability});}
export async function practice(req){const therapist=await Therapist.findOne({slug:req.params.slug});if(!therapist)throw new HttpError(404,'Practice not found');if(!await hasFeature(therapist,'scheduling'))throw new HttpError(403,'Scheduling is unavailable');return therapist;}
export async function slots(req,res){const therapist=await practice(req);res.json({slots:await availableSlots(therapist.id,req.query.from,req.query.to,Number(req.query.duration))});}

export async function saveExceptions(req,res){
 const availability=await Availability.findOneAndUpdate({therapist:req.therapist.id},{$set:{overrides:req.body.overrides,blocked:req.body.blocked},$inc:{revision:1}},{upsert:true,new:true,runValidators:true});res.json({availability});
}

export async function saveSettings(req,res){
 const availability=await Availability.findOneAndUpdate({therapist:req.therapist.id},{$set:{durations:req.body.durations,bufferMinutes:req.body.bufferMinutes},$inc:{revision:1}},{upsert:true,new:true,runValidators:true});res.json({availability});
}
export async function book(req,res){
 const therapist=await practice(req),service=therapist.services.id(req.body.serviceId);
 if(!service)throw new HttpError(400,'Select a published service');
 const session=await createBooking(therapist,service,{name:req.body.name,email:req.body.email},new Date(req.body.start));
 availabilityChanged(therapist.slug);
 res.status(201).json({session,bookingToken:issueToken(session.id,'booking',{therapistId:therapist.id})});
}
export async function sessions(req,res){res.json({sessions:await Session.find({therapist:req.therapist.id}).sort({start:1}).limit(500)});}
export async function waitlist(req,res){const therapist=await practice(req);const entry=await Waitlist.findOneAndUpdate({therapist:therapist.id,email:req.body.email,date:req.body.date,duration:req.body.duration},{$setOnInsert:{name:req.body.name}},{upsert:true,new:true});res.status(201).json({id:entry.id,message:'Added to waitlist. Notification delivery is currently stubbed.'});}
export async function cancelSession(req,res){
 const session=await Session.findOne({_id:req.params.id,therapist:req.therapist.id});if(!session)throw new HttpError(404,'Session not found');
 if(session.status!=='cancelled'){session.status='cancelled';await session.save();}
 await notifyWaitlist(session);availabilityChanged(req.therapist.slug);res.json({session});
}
export async function getBooking(req,res){
 const session=await Session.findById(req.params.id);if(!session)throw new HttpError(404,'Booking not found');
 if(!(req.auth.role==='booking'&&req.auth.sub===session.id)&&!(req.auth.role==='therapist'&&req.auth.sub===String(session.therapist)))throw new HttpError(403,'Booking access denied');
 res.json({session});
}
