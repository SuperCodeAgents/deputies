import { AppLifecycle, installProcessShutdownHandlers, type CloseableResource } from './app/lifecycle.js';
import { createServer, createServices } from './app/server.js';
import { loadConfig, requireDatabaseUrl, requireDaytonaApiKey, requireFlueModel } from './config/index.js';
import { FakeRunner } from './runner/fake.js';
import type { Runner } from './runner/types.js';
import { RealFlueAgentFactory } from './runner-flue/agent-factory.js';
import { FlueRunner } from './runner-flue/runner.js';
import { PostgresFlueSessionStore } from './runner-flue/session-store.js';
import { DaytonaSandboxProvider } from './sandbox/daytona.js';
import { FakeSandboxProvider } from './sandbox/fake.js';
import type { SandboxProvider } from './sandbox/types.js';
import { MemoryStore } from './store/memory.js';
import { PostgresStore } from './store/postgres.js';
import { startWorkerLoop, WorkerService } from './worker/service.js';

const config = loadConfig(process.env);
const store = config.appStore === 'postgres' ? new PostgresStore(requireDatabaseUrl(config)) : new MemoryStore();
const services = createServices(store);
const resources: CloseableResource[] = [];
let server: ReturnType<typeof createServer> | undefined;
let workerLoop: ReturnType<typeof startWorkerLoop> | undefined;

if ('close' in store && typeof store.close === 'function') resources.push(store as CloseableResource);

if (config.runMode === 'all' || config.runMode === 'api') {
  server = createServer(config, services);
  server.listen(config.port, () => {
    console.log(`background-agent service listening on :${config.port} (${config.runMode})`);
  });
}

if (config.runMode === 'all' || config.runMode === 'worker') {
  const worker = new WorkerService({
    store,
    events: services.events,
    runner: createRunner(),
    runnerType: config.runner,
    sandboxProvider: createSandboxProvider(),
    leaseOwner: `worker-${process.pid}`,
  });
  workerLoop = startWorkerLoop(worker);
  console.log(`background-agent worker started (${config.runMode})`);
}

const lifecycleOptions = {
  resources,
  onError: (error: unknown) => console.error(error instanceof Error ? error.message : error),
};
if (server) Object.assign(lifecycleOptions, { server });
if (workerLoop) Object.assign(lifecycleOptions, { workerLoop });
installProcessShutdownHandlers(new AppLifecycle(lifecycleOptions));

function createSandboxProvider(): SandboxProvider {
  if (config.sandboxProvider === 'fake') return new FakeSandboxProvider();
  if (config.sandboxProvider === 'daytona') {
    const options = {
      apiKey: requireDaytonaApiKey(config),
      idleTimeoutSeconds: config.sandboxIdleTimeoutSeconds,
    };
    if (config.daytonaApiUrl) Object.assign(options, { apiUrl: config.daytonaApiUrl });
    if (config.daytonaTarget) Object.assign(options, { target: config.daytonaTarget });
    if (config.daytonaImage) Object.assign(options, { image: config.daytonaImage });
    if (config.daytonaSnapshot) Object.assign(options, { snapshot: config.daytonaSnapshot });
    return new DaytonaSandboxProvider(options);
  }

  throw new Error(`SANDBOX_PROVIDER=${config.sandboxProvider} is not wired yet`);
}

function createRunner(): Runner {
  if (config.runner === 'fake') return new FakeRunner();

  const options = {
    model: requireFlueModel(config),
  };
  if (config.flueSessionStore === 'postgres') {
    const sessionStore = new PostgresFlueSessionStore(requireDatabaseUrl(config));
    resources.push(sessionStore);
    Object.assign(options, { sessionStore });
  }

  return new FlueRunner(new RealFlueAgentFactory(options));
}
