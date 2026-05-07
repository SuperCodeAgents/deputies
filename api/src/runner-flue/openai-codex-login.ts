import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { dirname } from 'node:path';
import { loginOpenAICodex } from '@mariozechner/pi-ai/oauth';
import { defaultOpenAICodexAuthFile } from './openai-codex-auth.js';

const provider = 'openai-codex';

async function main(): Promise<void> {
  const authFile = process.env.FLUE_OPENAI_CODEX_AUTH_FILE || defaultOpenAICodexAuthFile();
  const credentials = await loginOpenAICodex({
    originator: 'deputies',
    onAuth(info) {
      output.write(`Open this URL to authenticate OpenAI Codex:\n${info.url}\n`);
      if (info.instructions) output.write(`${info.instructions}\n`);
    },
    onPrompt: question,
    onProgress(message) {
      output.write(`${message}\n`);
    },
  });
  const auth = await readAuthFileIfPresent(authFile);
  auth[provider] = { type: 'oauth', ...credentials };
  await writeAuthFile(authFile, auth);
  output.write(`Saved OpenAI Codex OAuth credentials to ${authFile}\n`);
}

async function question(prompt: { message: string; placeholder?: string; allowEmpty?: boolean }): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    while (true) {
      const answer = await rl.question(`${prompt.message} `);
      if (answer || prompt.allowEmpty) return answer;
    }
  } finally {
    rl.close();
  }
}

async function readAuthFileIfPresent(authFile: string): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await readFile(authFile, 'utf8')) as Record<string, unknown>;
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`Invalid Pi auth file JSON at ${authFile}`);
    if (isNodeError(error) && error.code === 'ENOENT') return {};
    throw error;
  }
}

async function writeAuthFile(authFile: string, auth: Record<string, unknown>): Promise<void> {
  await mkdir(dirname(authFile), { recursive: true });
  await writeFile(authFile, `${JSON.stringify(auth, null, 2)}\n`, { mode: 0o600 });
  await chmod(authFile, 0o600);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
