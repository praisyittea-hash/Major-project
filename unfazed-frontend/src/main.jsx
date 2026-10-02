import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import '@fontsource/lato/latin-400.css';
import '@fontsource/lato/latin-400-italic.css';
import '@fontsource/lato/latin-700.css';
import '@fontsource/lato/latin-900.css';
import './style.css';
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
