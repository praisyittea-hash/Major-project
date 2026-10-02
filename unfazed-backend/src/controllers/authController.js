import bcrypt from 'bcryptjs';
import Therapist from '../models/Therapist.js';
export async function register(req,res){
 const {name,email,password}=req.body;
 const therapist=await Therapist.create({name,email,password_hash:await bcrypt.hash(password,12)});
 res.status(201).json({therapist});
}
