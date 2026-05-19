import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

export default defineConfig({
  plugins: [staticDemoMissingPlugin()],
});

function staticDemoMissingPlugin(): Plugin {
  return {
    name: 'deputies-www-static-demo-missing',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!request.url?.startsWith('/static-demo')) return next();

        const demoIndex = resolve(server.config.root, 'public/static-demo/index.html');
        if (existsSync(demoIndex)) return next();

        response.statusCode = 404;
        response.setHeader('Content-Type', 'text/plain; charset=utf-8');
        response.end('Static demo has not been built. Run pnpm --dir apps/web build:static-demo.');
      });
    },
  };
}
