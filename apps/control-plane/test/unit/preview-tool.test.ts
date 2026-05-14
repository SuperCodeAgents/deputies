import { createPreviewTool } from '../../src/runner-flue/preview-tool.js';

describe('preview tool', () => {
  it('publishes, lists, and unpublishes previews in session context', async () => {
    let context: Record<string, unknown> = {};
    const tool = createPreviewTool({
      sessionId: 'session-1',
      providerSandboxId: 'sandbox-1',
      getContext: () => context,
      setContext: (next) => {
        context = next;
      },
      async updateSessionContext(next) {
        context = next;
        return context;
      },
    });

    await expect(
      tool.execute({ action: 'publish', port: 5173, label: 'Vite app', path: '/dashboard' }).then(JSON.parse),
    ).resolves.toEqual({
      previews: [{ port: 5173, label: 'Vite app', path: '/dashboard', providerSandboxId: 'sandbox-1' }],
    });
    await expect(tool.execute({ action: 'list' }).then(JSON.parse)).resolves.toEqual({
      previews: [{ port: 5173, label: 'Vite app', path: '/dashboard', providerSandboxId: 'sandbox-1' }],
    });
    await expect(tool.execute({ action: 'unpublish', port: 5173 })).resolves.toBe(JSON.stringify({ previews: [] }));
  });
});
