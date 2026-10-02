import {randomUUID} from 'node:crypto';
import Package from '../models/Package.js';
import ClientPackage from '../models/ClientPackage.js';
import Payment from '../models/Payment.js';
import Therapist from '../models/Therapist.js';
import {paymentConfig,moneyBreakdown} from '../config/payments.js';
import {hasFeature} from '../services/entitlementService.js';
import {gatewayFor,orderForPayment} from '../services/paymentService.js';
import {HttpError} from '../middleware/errorHandler.js';
export async function listPackages(req,res){res.json({packages:await Package.find({therapist:req.therapist.id}),options:{counts:paymentConfig().packageCounts,expiryDays:paymentConfig().packageExpiryDays}});}
export async function createPackage(req,res){if(!req.therapist.services.id(req.body.serviceId))throw new HttpError(400,'Select one of your published services');const {name,serviceId,sessionCount,amount,expiryDays}=req.body;res.status(201).json({package:await Package.create({therapist:req.therapist.id,name,serviceId,sessionCount,amount,expiryDays})});}
export async function archivePackage(req,res){const pkg=await Package.findOneAndUpdate({_id:req.params.id,therapist:req.therapist.id},{$set:{active:false}},{new:true});if(!pkg)throw new HttpError(404,'Package not found');res.json({package:pkg});}
export async function portalPackages(req,res){const therapist=await Therapist.findById(req.client.therapist);if(!await hasFeature(therapist,'packages'))throw new HttpError(403,'Packages unavailable');res.json({available:await Package.find({therapist:req.client.therapist,active:true}),purchased:await ClientPackage.find({client:req.client.id,therapist:req.client.therapist}),services:therapist.services,slug:therapist.slug});}
export async function purchasePackage(req,res){
 const therapist=await Therapist.findById(req.client.therapist);if(!await hasFeature(therapist,'packages')||!await hasFeature(therapist,'payments'))throw new HttpError(403,'Package payments unavailable');
 if(!req.client.consentAt)throw new HttpError(409,'Complete intake and consent before purchasing');
 const pkg=await Package.findOne({_id:req.params.id,therapist:req.client.therapist,active:true});if(!pkg)throw new HttpError(404,'Package not found');
 const gateway=gatewayFor(req),key=gateway.publicKey();
 const purchaseKey=`package:${req.client.id}:${req.body.idempotencyKey||randomUUID()}`;
 const payment=await Payment.findOneAndUpdate({purchaseKey},{$setOnInsert:{therapist:req.client.therapist,client:req.client.id,package:pkg.id,...moneyBreakdown(pkg.amount),packageSnapshot:{name:pkg.name,sessionCount:pkg.sessionCount,serviceId:pkg.serviceId,expiryDays:pkg.expiryDays,amount:pkg.amount}}},{upsert:true,new:true,runValidators:true});
 if(String(payment.package)!==pkg.id)throw new HttpError(409,'This purchase key belongs to another package');
 res.status(201).json({payment:await orderForPayment(payment,gateway),key});
}
