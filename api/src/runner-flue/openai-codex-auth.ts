import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { getOAuthApiKey, type OAuthCredentials } from '@mariozechner/pi-ai/oauth';

const provider = 'openai-codex';

export type OpenAICodexAuthResult = {
  apiKey: string;
  authFile: string;
};

export async function loadOpenAICodexApiKey(authFile = defaultOpenAICodexAuthFile()): Promise<OpenAICodexAuthResult> {
  const auth = await readAuthFile(authFile);
  const result = await getOAuthApiKey(provider, auth as Record<string, OAuthCredentials>);
  if (!result) {
    throw new Error(`Missing ${provider} OAuth credentials in ${authFile}. Run pnpm --dir api auth:login:openai-codex first.`);
  }

  auth[provider] = { type: 'oauth', ...result.newCredentials };
  await writeAuthFile(authFile, auth);

  return { apiKey: result.apiKey, authFile };
}

export function defaultOpenAICodexAuthFile(): string {
  return join(homedir(), '.pi', 'agent', 'auth.json');
}

async function readAuthFile(authFile: string): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await readFile(authFile, 'utf8')) as Record<string, unknown>;
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`Invalid Pi auth file JSON at ${authFile}`);
    if (isNodeError(error) && error.code === 'ENOENT') {
      throw new Error(`Pi auth file not found at ${authFile}. Run pnpm --dir api auth:login:openai-codex first.`);
    }
    throw error;
  }
}

async function writeAuthFile(authFile: string, auth: Record<string, unknown>): Promise<void> {
  await mkdir(dirname(authFile), { recursive: true });
  await writeFile(authFile, `${JSON.stringify(auth, null, 2)}\n`, { mode: 0o600 });
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
