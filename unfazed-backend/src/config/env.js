export function validateEnv(env=process.env){
 if(!env.MONGO_URI) throw new Error('MONGO_URI is required');
 if(!env.JWT_SECRET || env.JWT_SECRET.length<32 || env.JWT_SECRET.startsWith('replace-')) throw new Error('JWT_SECRET must be a unique secret of at least 32 characters');
 return env;
}
