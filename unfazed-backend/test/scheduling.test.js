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
import {fromZonedTime,formatInTimeZone} from 'date-fns-tz';
test('timezone conversion survives DST and fractional offsets',()=>{
 const india=fromZonedTime('2030-01-07T09:00:00','Asia/Kolkata');assert.equal(india.toISOString(),'2030-01-07T03:30:00.000Z');
 assert.equal(formatInTimeZone(india,'America/New_York','yyyy-MM-dd HH:mm'),'2030-01-06 22:30');
 assert.equal(fromZonedTime('2030-07-08T09:00:00','America/New_York').toISOString(),'2030-07-08T13:00:00.000Z');
});
