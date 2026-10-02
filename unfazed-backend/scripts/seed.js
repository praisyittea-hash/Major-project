import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import {connectDB} from '../src/config/db.js';
import Therapist from '../src/models/Therapist.js';
import SubscriptionTierConfig from '../src/models/SubscriptionTierConfig.js';
import {defaultEntitlements} from '../src/config/features.js';
export async function seed(){
 if(process.env.SEED_DATABASE_ALLOW!=='true')throw new Error('Set SEED_DATABASE_ALLOW=true explicitly for a development database. Seed never deletes or updates existing records.');
 if(!process.env.SEED_PASSWORD || process.env.SEED_PASSWORD.length<10)throw new Error('Set SEED_PASSWORD to a development-only password (10+ characters)');
 const therapists=[{name:'Dr Meera Sharma',email:'meera@unfazed.example',slug:'dr-meera-sharma',bio:'I offer a warm, collaborative space to explore anxiety, life transitions and relationships. Together, we work at your pace.',specializations:['Anxiety','Life transitions','Relationships'],languages:['English','Hindi']},{name:'Dr Arjun Nair',email:'arjun@unfazed.example',slug:'dr-arjun-nair',bio:'An evidence-informed approach to wellbeing, supporting adults navigating work stress and burnout.',specializations:['Burnout','Stress'],languages:['English','Malayalam']}];
 await SubscriptionTierConfig.updateOne({key:'default'},{$setOnInsert:defaultEntitlements},{upsert:true});
 for(const data of therapists)await Therapist.updateOne({email:data.email},{$setOnInsert:{...data,password_hash:await bcrypt.hash(process.env.SEED_PASSWORD,12),services:[{name:'Individual therapy',description:'A private one-to-one session, online.',duration:60,rate:150000}]}},{upsert:true});
 console.log('Development therapists ready. Existing records preserved.');
}
if(process.argv[1]===new URL(import.meta.url).pathname){try{await connectDB();await seed();}finally{await mongoose.disconnect();}}
