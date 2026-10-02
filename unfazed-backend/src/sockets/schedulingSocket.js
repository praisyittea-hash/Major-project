import {Server} from 'socket.io';
import Therapist from '../models/Therapist.js';
let io;
export function attachSchedulingSocket(server){
 io=new Server(server,{cors:{origin:process.env.FRONTEND_URL||'http://localhost:5173'}});
 io.on('connection',socket=>{socket.on('watch-availability',async slug=>{if(typeof slug==='string'&&slug.length<=63&&await Therapist.exists({slug}))socket.join(`availability:${slug}`);});});return io;
}
export function availabilityChanged(slug){io?.to(`availability:${slug}`).emit('availability-changed');} // no clinical or client data
