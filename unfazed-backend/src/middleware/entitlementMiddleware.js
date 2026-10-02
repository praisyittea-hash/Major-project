import {hasFeature} from '../services/entitlementService.js';
import {HttpError} from './errorHandler.js';
export const requireFeature=feature=>async(req,_res,next)=>{if(!await hasFeature(req.therapist,feature))throw new HttpError(403,'This feature is unavailable for your practice');next();};
