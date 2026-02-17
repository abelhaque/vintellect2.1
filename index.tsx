import './index.css'; 
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// 1. Locate the entry point in your index.html
const rootElement = document.getElementById('root');

// 2. Safety check for the root element
if (!rootElement) {
  throw new Error("Could not find root element to mount to. Ensure <div id='root'></div> exists in index.html");
}

// 3. Create the React 19 root and render the App
const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);