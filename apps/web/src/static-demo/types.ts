import type {
  AgentEvent,
  Artifact,
  CallbackDelivery,
  ExternalResource,
  Message,
  SandboxService,
  Session,
} from '../api.js';

export type StaticDemoSession = {
  session: Session;
  messages: Message[];
  events: AgentEvent[];
  artifacts: Artifact[];
  externalResources: ExternalResource[];
  callbacks: CallbackDelivery[];
  services?: SandboxService[];
};

export type StaticDemoData = {
  generatedAt: string;
  sessions: StaticDemoSession[];
};
