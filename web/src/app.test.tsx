import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from './app.js';

const session = {
  id: '00000000-0000-4000-8000-000000000001',
  status: 'idle',
  title: 'Existing session',
  createdAt: '2026-05-05T12:00:00.000Z',
  updatedAt: '2026-05-05T12:00:00.000Z',
};

afterEach(() => {
  vi.restoreAllMocks();
});

it('submits composer text on Enter and preserves Shift Enter for newlines', async () => {
  const submittedPrompts: string[] = [];
  mockApi({ submittedPrompts });
  render(<App />);

  const composer = await screen.findByPlaceholderText('Ask your deputy to investigate, change code, or follow up...');

  fireEvent.change(composer, { target: { value: 'follow up' } });
  fireEvent.keyDown(composer, { key: 'Enter', shiftKey: true });
  expect(submittedPrompts).toEqual([]);

  fireEvent.keyDown(composer, { key: 'Enter' });
  await waitFor(() => expect(submittedPrompts).toEqual(['follow up']));
});

it('keeps sidebar reachable after mobile open, hide, and reopen actions', async () => {
  mockApi();
  render(<App />);

  const mobileOpen = await screen.findByRole('button', { name: 'Open sessions' });
  fireEvent.click(mobileOpen);
  expect(screen.queryByRole('button', { name: 'Open sessions' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Hide sidebar' }));
  fireEvent.click(screen.getByRole('button', { name: 'Open sessions' }));

  expect(screen.getByRole('button', { name: 'Hide sidebar' })).toBeInTheDocument();
});

it('shows and calls cancel run for an active session', async () => {
  let cancelled = false;
  mockApi({
    sessionOverride: { status: 'active' },
    messages: [{
      id: '00000000-0000-4000-8000-000000000102',
      sessionId: session.id,
      sequence: 1,
      status: 'processing',
      prompt: 'running work',
      createdAt: '2026-05-05T12:01:00.000Z',
    }],
    onCancelRun: () => {
      cancelled = true;
    },
  });
  render(<App />);

  fireEvent.click(await screen.findByRole('button', { name: 'Cancel run' }));

  await waitFor(() => expect(cancelled).toBe(true));
});

it('logs in with session auth before loading sessions', async () => {
  const logins: Array<{ username: string; password: string }> = [];
  mockApi({ authMode: 'session', currentUser: null, logins });
  render(<App />);

  fireEvent.change(await screen.findByPlaceholderText('Username'), { target: { value: 'dev' } });
  fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

  await screen.findAllByText('Existing session');
  expect(logins).toEqual([{ username: 'dev', password: 'password' }]);
});

it('requires restoring archived sessions before sending messages', async () => {
  const submittedPrompts: string[] = [];
  mockApi({ sessionOverride: { status: 'archived' }, submittedPrompts });
  render(<App />);

  expect(await screen.findByText('This session is archived.')).toBeInTheDocument();
  const composer = screen.getByPlaceholderText('Restore this archived session before sending new work.');
  expect(composer).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  fireEvent.click(screen.getAllByRole('button', { name: 'Restore session' }).at(-1)!);

  await screen.findByPlaceholderText('Ask your deputy to investigate, change code, or follow up...');
  expect(submittedPrompts).toEqual([]);
});

it('keeps a cancelled middle message inline with its surrounding batch', async () => {
  mockApi({
    messages: [
      messageFixture({ id: '00000000-0000-4000-8000-000000000110', sequence: 10, status: 'completed', prompt: 'please sleep for 30 seconds' }),
      messageFixture({ id: '00000000-0000-4000-8000-000000000111', sequence: 11, status: 'completed', prompt: 'message 1' }),
      messageFixture({ id: '00000000-0000-4000-8000-000000000112', sequence: 12, status: 'cancelled', prompt: 'message 2' }),
      messageFixture({ id: '00000000-0000-4000-8000-000000000113', sequence: 13, status: 'completed', prompt: 'message 3' }),
    ],
    events: [
      eventFixture({ sequence: 1, type: 'message_started', runId: '00000000-0000-4000-8000-000000000210', messageId: '00000000-0000-4000-8000-000000000110', payload: { sequences: [10, 11, 13], batchSize: 3 } }),
      eventFixture({ sequence: 2, type: 'message_cancelled', messageId: '00000000-0000-4000-8000-000000000112', payload: { sequence: 12 } }),
      eventFixture({ sequence: 3, type: 'agent_text_delta', runId: '00000000-0000-4000-8000-000000000210', messageId: '00000000-0000-4000-8000-000000000110', payload: { text: 'batch response' } }),
    ],
  });
  render(<App />);

  await screen.findByText('batch response');
  const message12 = screen.getByText('message 2');
  const response = screen.getByText('Deputy response');

  expect(message12.compareDocumentPosition(response)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  expect(screen.getAllByText(/Diagnostics/)).toHaveLength(1);
});

function mockApi(options: { submittedPrompts?: string[]; messages?: unknown[]; events?: unknown[]; sessionOverride?: Partial<typeof session>; onCancelRun?: () => void; authMode?: 'none' | 'bearer' | 'session'; currentUser?: { username: string } | null; logins?: Array<{ username: string; password: string }> } = {}) {
  let currentSession = { ...session, ...options.sessionOverride };
  let currentUser = options.currentUser;
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? 'GET';

    if (url.pathname === '/health') {
      return jsonResponse({ status: 'ok', runMode: 'all', apiAuthMode: options.authMode ?? 'none' });
    }

    if (url.pathname === '/auth/me') {
      return currentUser ? jsonResponse({ user: currentUser }) : jsonResponse({ error: 'unauthorized', message: 'Missing or invalid session' }, 401);
    }

    if (url.pathname === '/auth/login' && method === 'POST') {
      const body = JSON.parse(String(init?.body)) as { username: string; password: string };
      options.logins?.push(body);
      currentUser = { username: body.username };
      return jsonResponse({ user: currentUser });
    }

    if (url.pathname === '/auth/logout' && method === 'POST') {
      currentUser = null;
      return jsonResponse({ ok: true });
    }

    if (url.pathname === '/sessions' && method === 'GET') {
      return jsonResponse({ sessions: [currentSession] });
    }

    if (url.pathname === `/sessions/${currentSession.id}/unarchive` && method === 'POST') {
      currentSession = { ...currentSession, status: 'idle' };
      return jsonResponse({ session: currentSession });
    }

    if (url.pathname === `/sessions/${currentSession.id}/messages` && method === 'GET') {
      return jsonResponse({ messages: options.messages ?? [] });
    }

    if (url.pathname === `/sessions/${currentSession.id}/messages` && method === 'POST') {
      const body = JSON.parse(String(init?.body)) as { prompt: string };
      options.submittedPrompts?.push(body.prompt);
      return jsonResponse({
        message: {
          id: '00000000-0000-4000-8000-000000000101',
          sessionId: currentSession.id,
          sequence: 1,
          status: 'pending',
          prompt: body.prompt,
          createdAt: '2026-05-05T12:01:00.000Z',
        },
      }, 202);
    }

    if (url.pathname === `/sessions/${currentSession.id}/runs/current/cancel` && method === 'POST') {
      options.onCancelRun?.();
      return jsonResponse({ messages: (options.messages ?? []).map((message) => ({ ...(message as object), status: 'cancelling' })) });
    }

    if (url.pathname === `/sessions/${currentSession.id}/events`) {
      return jsonResponse({ events: options.events ?? [] });
    }

    if (url.pathname === `/sessions/${currentSession.id}/artifacts`) {
      return jsonResponse({ artifacts: [] });
    }

    if (url.pathname === `/sessions/${currentSession.id}/events/stream`) {
      return new Response(new ReadableStream(), { status: 200 });
    }

    return jsonResponse({ error: 'not_found', message: 'Not found' }, 404);
  });
}

function messageFixture(input: { id: string; sequence: number; status: string; prompt: string }) {
  return {
    ...input,
    sessionId: session.id,
    createdAt: '2026-05-05T12:01:00.000Z',
  };
}

function eventFixture(input: { sequence: number; type: string; payload: Record<string, unknown>; runId?: string; messageId?: string }) {
  return {
    ...input,
    sessionId: session.id,
    createdAt: '2026-05-05T12:02:00.000Z',
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
