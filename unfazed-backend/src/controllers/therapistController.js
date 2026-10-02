export async function updateProfile(req,res){
 const allowed=['name','bio','specializations','languages','timezone','services'];
 for(const key of allowed)if(req.body[key]!==undefined)req.therapist[key]=req.body[key];
 await req.therapist.save();res.json({therapist:req.therapist});
}
