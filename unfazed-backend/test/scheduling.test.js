import {test} from 'node:test';
import assert from 'node:assert/strict';
import Availability from '../src/models/Availability.js';
import Session from '../src/models/Session.js';
import mongoose from 'mongoose';
test('availability and session structures preserve therapist ownership',()=>{
 const therapist=new mongoose.Types.ObjectId();
 const a=new Availability({therapist});assert.equal(a.validateSync(),undefined);assert.deepEqual([...a.durations],[30,45,60,90]);
 assert.ok(new Session({therapist,duration:25}).validateSync());
});
