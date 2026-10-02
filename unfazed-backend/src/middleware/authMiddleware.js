import Therapist from '../models/Therapist.js';
import {readToken} from '../services/tokenService.js';
import {HttpError} from './errorHandler.js';
export function authenticate(req,_res,next){
 try{const header=req.headers.authorization;if(!header?.startsWith('Bearer '))throw new Error();req.auth=readToken(header.slice(7));next();}
 catch{next(new HttpError(401,'Please sign in to continue'));}
}
export async function therapistOnly(req,_res,next){
 if(req.auth.role!=='therapist')throw new HttpError(403,'Therapist access required');
 const therapist=await Therapist.findById(req.auth.sub);
 if(!therapist)throw new HttpError(401,'Account unavailable');
 req.therapist=therapist;next();
}
