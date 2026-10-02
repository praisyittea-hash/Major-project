import Session from '../models/Session.js';
export async function clientHistory(client){return {sessions:await Session.find({client:client.id,therapist:client.therapist}).sort({start:-1}).limit(200)};}
