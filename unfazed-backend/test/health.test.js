import {test} from 'node:test';
import request from 'supertest';
import {app} from '../src/app.js';
test('API health',async()=>{await request(app).get('/api/health').expect(200);});
