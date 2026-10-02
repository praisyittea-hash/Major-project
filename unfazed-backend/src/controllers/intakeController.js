import {intakeTemplate} from '../config/intake.js';
export async function submitIntake(req,res){
 req.client.intake={demographics:req.body.demographics,presentingConcern:req.body.presentingConcern,history:req.body.history,submittedAt:new Date(),templateVersion:intakeTemplate.version};
 await req.client.save();res.json({client:req.client});
}
