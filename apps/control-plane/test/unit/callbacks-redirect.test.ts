import { EventEmitter } from 'node:events';
import { vi } from 'vitest';

import type { CompletionCallbackPayload } from '../../src/callbacks/service.js';

const httpMock = vi.hoisted(() => ({
  request: vi.fn(),
}));

vi.mock('node:http', () => ({
  request: httpMock.request,
}));

type MockRequest = EventEmitter & {
  destroy(error: Error): void;
  end(body: string): void;
  setTimeout(timeoutMs: number): void;
};

type MockResponse = EventEmitter & { resume(): void; statusCode: number };

const payload: CompletionCallbackPayload = {
  event: 'message_completed',
  sessionId: 'session-1',
  runId: 'run-1',
  messageId: 'message-1',
  text: 'done',
  artifacts: [],
};

describe('HttpCompletionCallbackSender production redirects', () => {
  beforeEach(() => {
    httpMock.request.mockReset();
  });

  it('rejects redirects from the production HTTP request path', async () => {
    httpMock.request.mockImplementation(
      (_options: unknown, onResponse: (response: MockResponse) => void): MockRequest => {
        const request = new EventEmitter() as MockRequest;
        request.destroy = (error) => request.emit('error', error);
        request.end = () => {
          const response = new EventEmitter() as MockResponse;
          response.statusCode = 302;
          response.resume = () => queueMicrotask(() => response.emit('end'));
          onResponse(response);
        };
        request.setTimeout = () => undefined;
        return request;
      },
    );

    const { HttpCompletionCallbackSender } = await import('../../src/callbacks/service.js');
    const sender = new HttpCompletionCallbackSender({
      resolveHostname: async () => [{ address: '93.184.216.34', family: 4 }],
    });

    await expect(
      sender.deliver({ type: 'http', target: { url: 'http://example.com/callback' } }, payload),
    ).rejects.toThrow('HTTP callback redirects are not allowed');
  });

  it('destroys never-ending production HTTP responses at the total deadline', async () => {
    const destroy = vi.fn((request: EventEmitter, error: Error) => request.emit('error', error));
    httpMock.request.mockImplementation(
      (_options: unknown, onResponse: (response: MockResponse) => void): MockRequest => {
        const request = new EventEmitter() as MockRequest;
        request.destroy = (error) => destroy(request, error);
        request.end = () => {
          const response = new EventEmitter() as MockResponse;
          response.statusCode = 204;
          response.resume = () => undefined;
          onResponse(response);
        };
        request.setTimeout = () => undefined;
        return request;
      },
    );

    const { HttpCompletionCallbackSender } = await import('../../src/callbacks/service.js');
    const sender = new HttpCompletionCallbackSender({
      timeoutMs: 1,
      resolveHostname: async () => [{ address: '93.184.216.34', family: 4 }],
    });

    await expect(
      sender.deliver({ type: 'http', target: { url: 'http://example.com/callback' } }, payload),
    ).rejects.toThrow('HTTP callback timed out');
    expect(destroy).toHaveBeenCalledWith(expect.any(EventEmitter), expect.any(Error));
    expect(destroy.mock.calls[0]?.[1].message).toBe('HTTP callback timed out');
  });
});
