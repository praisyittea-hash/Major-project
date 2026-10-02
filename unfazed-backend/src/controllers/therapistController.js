import Therapist from '../models/Therapist.js';
import {HttpError} from '../middleware/errorHandler.js';
export async function updateProfile(req,res){
 const allowed=['slug','name','bio','specializations','languages','timezone','services'];
 for(const key of allowed)if(req.body[key]!==undefined)req.therapist[key]=req.body[key];
 if(req.body.slug && await Therapist.exists({slug:req.body.slug,_id:{$ne:req.therapist.id}}))throw new HttpError(409,'This branded link is taken');
 await req.therapist.save();res.json({therapist:req.therapist});
}
