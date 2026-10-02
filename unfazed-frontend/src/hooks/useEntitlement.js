import {useEffect,useState} from 'react';
import api from '../api/axiosInstance.js';
export default function useEntitlement(feature){const [access,setAccess]=useState({loading:true,allowed:false});useEffect(()=>{let active=true;api.get('/therapists/entitlements').then(({data})=>{if(active)setAccess({loading:false,allowed:data.features[feature]===true});}).catch(()=>{if(active)setAccess({loading:false,allowed:false});});return()=>{active=false;};},[feature]);return access;}
