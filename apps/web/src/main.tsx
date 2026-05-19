import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app.js';
import { StaticDemoApp } from './static-demo/app.js';
import './styles.css';

const RootApp = import.meta.env.VITE_STATIC_DEMO === 'true' ? StaticDemoApp : App;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootApp />
  </StrictMode>,
);
