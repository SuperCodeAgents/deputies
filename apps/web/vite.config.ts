import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {
  shouldEnableServicePreviews,
  shouldProxyServiceRequest,
  viteHmrPath,
  type ProxyBypassRequest,
} from './src/vite-service-proxy.js';

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3583';
const portlessUrl = process.env.VITE_PORTLESS_URL ?? 'https://deputies.localhost';
const defaultAllowedHosts = ['.localhost', '.ngrok-free.app', '.ngrok-free.dev', '.ngrok.io'];
const rawAllowedHosts = process.env.VITE_DEV_ALLOWED_HOSTS;
const servicePreviewsEnabled = shouldEnableServicePreviews(process.env.VITE_SERVICE_PREVIEWS);
const allowedHosts =
  rawAllowedHosts === undefined || rawAllowedHosts === ''
    ? defaultAllowedHosts
    : ['true', '1', 'True', 'TRUE'].includes(rawAllowedHosts)
      ? true
      : rawAllowedHosts
          .split(',')
          .map((host) => host.trim())
          .filter(Boolean);
const apiProxy = { target: apiProxyTarget };
const apiProxyRoutes = {
  '/health': apiProxy,
  '/auth': apiProxy,
  '/sessions': apiProxy,
  '/events': apiProxy,
  '/groups': apiProxy,
  '/repositories': apiProxy,
  '/models': apiProxy,
  '/setup': apiProxy,
  '/users': apiProxy,
  '/webhooks': apiProxy,
};
const serviceProxy = {
  target: apiProxyTarget,
  ws: true,
  xfwd: true,
  bypass(request: ProxyBypassRequest) {
    return shouldProxyServiceRequest(request) ? undefined : request.url;
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss(), portlessUrlPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    hmr: { path: viteHmrPath },
    allowedHosts,
    proxy: servicePreviewsEnabled ? { ...apiProxyRoutes, '/': serviceProxy } : apiProxyRoutes,
  },
});

function portlessUrlPlugin(): Plugin {
  return {
    name: 'deputies-portless-url',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        server.config.logger.info(`  Portless: ${portlessUrl}`);
      });
    },
  };
}
