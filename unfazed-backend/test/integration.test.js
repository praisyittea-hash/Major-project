import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import {database} from './helpers.js';
import {app} from '../src/app.js';
import Therapist from '../src/models/Therapist.js';
process.env.NODE_ENV='test';
process.env.JWT_SECRET='isolated-test-secret-never-used-in-production';
let close;
before(async()=>{close=await database();await Therapist.init();});
after(async()=>{if(close)await close();});
const credentials={name:'Dr Meera Sharma',email:'meera@example.test',password:'Safe-testing-password!'};
export let token;
test('register persists bcrypt hash and rejects duplicate/invalid accounts',async()=>{
 const result=await request(app).post('/api/auth/register').send(credentials).expect(201);
 assert.equal(result.body.therapist.password_hash,undefined);
 const record=await Therapist.findOne({email:credentials.email}).select('+password_hash');
 assert.notEqual(record.password_hash,credentials.password);
 assert.ok(await bcrypt.compare(credentials.password,record.password_hash));
 await request(app).post('/api/auth/register').send(credentials).expect(409);
 await request(app).post('/api/auth/register').send({email:'invalid',password:'short'}).expect(400);
});
test('JWT login and protected account access',async()=>{
 await request(app).post('/api/auth/login').send({...credentials,password:'wrong'}).expect(401);
 const result=await request(app).post('/api/auth/login').send(credentials).expect(200);token=result.body.token;
 assert.ok(token);assert.equal(result.body.therapist.password_hash,undefined);
 await request(app).get('/api/auth/me').expect(401);
 await request(app).get('/api/auth/me').set('Authorization','Bearer invalid').expect(401);
 const me=await request(app).get('/api/auth/me').set('Authorization',`Bearer ${token}`).expect(200);
 assert.equal(me.body.therapist.email,credentials.email);
});
test('profile updates are validated and protected; privileged fields ignored',async()=>{
 await request(app).patch('/api/therapists/me').send({bio:'x'}).expect(401);
 const result=await request(app).patch('/api/therapists/me').set('Authorization',`Bearer ${token}`).send({bio:'Compassionate, evidence-informed care.',specializations:['Anxiety'],languages:['English','Hindi'],services:[{name:'Individual therapy',duration:60,rate:150000}],email:'intruder@example.test'}).expect(200);
 assert.equal(result.body.therapist.email,credentials.email);
 assert.equal(result.body.therapist.bio,'Compassionate, evidence-informed care.');
 await request(app).patch('/api/therapists/me').set('Authorization',`Bearer ${token}`).send({timezone:'not/a-zone'}).expect(400);
});
