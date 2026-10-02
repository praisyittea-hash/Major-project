import {sessionOrder,ownedPayment} from '../services/paymentService.js';
export async function createSessionOrder(req,res){res.status(201).json(await sessionOrder(req));}
export async function getPayment(req,res){res.json({payment:await ownedPayment(req)});}
