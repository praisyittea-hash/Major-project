import {test} from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Client from '../src/models/Client.js';
test('CRM client stores tenant relationship, tags and intake as subdocuments',()=>{
 const client=new Client({therapist:new mongoose.Types.ObjectId(),name:'Ananya Rao',email:'Ananya@Example.test',tags:[{label:'Online'}],intake:{demographics:{age:29},presentingConcern:'Support for work stress'}});
 assert.equal(client.validateSync(),undefined);assert.equal(client.email,'ananya@example.test');assert.equal(client.tags[0].label,'Online');
 assert.ok(new Client({name:'Unowned client'}).validateSync());
});
