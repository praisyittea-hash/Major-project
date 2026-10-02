import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateEnv} from '../src/config/env.js';
test('missing and placeholder secrets rejected',()=>{assert.throws(()=>validateEnv({}));assert.throws(()=>validateEnv({MONGO_URI:'local',JWT_SECRET:'short'}));assert.ok(validateEnv({MONGO_URI:'local',JWT_SECRET:'a'.repeat(40)}));});
