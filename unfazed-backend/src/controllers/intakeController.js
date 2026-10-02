import {persistIntake} from '../services/intakeService.js';
export async function submitIntake(req,res){res.json({client:await persistIntake(req.client,req.body)});}
