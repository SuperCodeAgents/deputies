import { createEmulator } from 'emulate';

describe.skipIf(process.env.RUN_SLACK_EMULATE_TEST !== 'true')('Slack emulate', () => {
  it('starts the Slack emulator for integration-test use', async () => {
    const slack = await createEmulator({ service: 'slack', port: 4103 });
    try {
      const response = await fetch(`${slack.url}/api/auth.test`, {
        method: 'POST',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.headers.get('content-type')).toContain('application/json');
    } finally {
      await slack.close();
    }
  });
});
