import 'dotenv/config';
import {app} from './src/app.js';
import {connectDB} from './src/config/db.js';
import {validateEnv} from './src/config/env.js';
validateEnv();
await connectDB();
const server=app.listen(process.env.PORT || 5000,()=>console.log('Unfazed API listening; MongoDB connected'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(async()=>{const {default:mongoose}=await import('mongoose');await mongoose.disconnect();process.exit(0);}));
