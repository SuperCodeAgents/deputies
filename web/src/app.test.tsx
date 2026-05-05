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

function mockApi(options: { submittedPrompts?: string[] } = {}) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? 'GET';

    if (url.pathname === '/health') {
      return jsonResponse({ status: 'ok', runMode: 'all', apiAuthMode: 'none' });
    }

    if (url.pathname === '/sessions' && method === 'GET') {
      return jsonResponse({ sessions: [session] });
    }

    if (url.pathname === `/sessions/${session.id}/messages` && method === 'GET') {
      return jsonResponse({ messages: [] });
    }

    if (url.pathname === `/sessions/${session.id}/messages` && method === 'POST') {
      const body = JSON.parse(String(init?.body)) as { prompt: string };
      options.submittedPrompts?.push(body.prompt);
      return jsonResponse({
        message: {
          id: '00000000-0000-4000-8000-000000000101',
          sessionId: session.id,
          sequence: 1,
          status: 'pending',
          prompt: body.prompt,
          createdAt: '2026-05-05T12:01:00.000Z',
        },
      }, 202);
    }

    if (url.pathname === `/sessions/${session.id}/events`) {
      return jsonResponse({ events: [] });
    }

    if (url.pathname === `/sessions/${session.id}/artifacts`) {
      return jsonResponse({ artifacts: [] });
    }

    if (url.pathname === `/sessions/${session.id}/events/stream`) {
      return new Response(new ReadableStream(), { status: 200 });
    }

    return jsonResponse({ error: 'not_found', message: 'Not found' }, 404);
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
