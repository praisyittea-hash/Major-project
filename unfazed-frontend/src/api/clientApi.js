import axios from 'axios';
import api from './axiosInstance.js';
const clientApi = axios.create({ baseURL: api.defaults.baseURL, timeout: 20000 });
clientApi.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('unfazed-client-token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
export function acceptPortalLink() {
  const fragment = new URLSearchParams(location.hash.slice(1));
  const token = fragment.get('access');
  if (token) {
    sessionStorage.setItem('unfazed-client-token', token);
    history.replaceState(null, '', location.pathname + location.search);
  }
}
export default clientApi;
