import axios from 'axios';
const api=axios.create({baseURL:import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',timeout:20000});
api.interceptors.request.use(config=>{const token=sessionStorage.getItem('unfazed-token');if(token&&!config.headers.Authorization)config.headers.Authorization=`Bearer ${token}`;return config;});
export const messageOf=error=>error.response?.data?.message || error.message || 'Something went wrong';
export default api;
