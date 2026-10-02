import {clientHistory} from '../services/clientHistoryService.js';
import ConsentAudit from '../models/ConsentAudit.js';
import Client from '../models/Client.js';
import {HttpError} from '../middleware/errorHandler.js';
import {entitlementsFor} from '../services/entitlementService.js';
const fields=['name','email','phone','status','tags'];
const pick=body=>Object.fromEntries(fields.filter(key=>body[key]!==undefined).map(key=>[key,body[key]]));
export async function createClient(req,res){
 const access=await entitlementsFor(req.therapist),count=await Client.countDocuments({therapist:req.therapist.id,status:{$ne:'archived'}});
 if(Number.isFinite(access.caps.clients)&&count>=access.caps.clients)throw new HttpError(403,'Client capacity reached');
 const client=await Client.create({...pick(req.body),therapist:req.therapist.id});res.status(201).json({client});
}
export async function listClients(req,res){
 const filter={therapist:req.therapist._id};if(req.query.status)filter.status=req.query.status;
 if(req.query.search)filter.name={$regex:req.query.search.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),$options:'i'};
 if(req.query.tag)filter['tags.label']=req.query.tag;
 const sortField=['name','lastSession','status','createdAt'].includes(req.query.sort)?req.query.sort:'name';
 const direction=req.query.direction==='desc'?-1:1,page=Number(req.query.page||1),limit=Number(req.query.limit||50);
 const [clients,total]=await Promise.all([Client.aggregate([{$match:filter},{$lookup:{from:'sessions',let:{client:'$_id',therapist:'$therapist'},pipeline:[{$match:{$expr:{$and:[{$eq:['$client','$$client']},{$eq:['$therapist','$$therapist']},{$lte:['$start',new Date()]},{$in:['$status',['confirmed','completed']]}]}}},{$sort:{start:-1}},{$limit:1},{$project:{start:1}}],as:'latest'}},{$addFields:{lastSession:{$arrayElemAt:['$latest.start',0]}}},{$project:{intake:0,latest:0}},{$sort:{[sortField]:direction,_id:1}},{$skip:(page-1)*limit},{$limit:limit}]),Client.countDocuments(filter)]);
 res.json({clients,total,page,limit});
}
export async function ownedClient(req){const client=await Client.findOne({_id:req.params.id,therapist:req.therapist.id}).select('+intake');if(!client)throw new HttpError(404,'Client not found');return client;}
export async function getClient(req,res){const client=await ownedClient(req);res.json({client,consentAudit:await ConsentAudit.find({client:client.id,therapist:req.therapist.id}).sort({acceptedAt:1})});}
export async function updateClient(req,res){const client=await ownedClient(req);Object.assign(client,pick(req.body));await client.save();res.json({client});}
export async function archiveClient(req,res){const client=await ownedClient(req);client.status='archived';await client.save();res.json({client,message:'Client archived; history preserved'});}

export async function history(req,res){const client=await ownedClient(req);res.json(await clientHistory(client));}
