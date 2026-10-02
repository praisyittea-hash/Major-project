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
