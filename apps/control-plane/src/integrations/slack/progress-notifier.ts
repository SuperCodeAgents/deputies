import type { RunProgressNotifier } from '../../worker/service.js';
import type { SlackAssistantThreadClient } from './client.js';

export class SlackRunProgressNotifier implements RunProgressNotifier {
  constructor(private readonly client: SlackAssistantThreadClient) {}

  async onRunStarted(input: Parameters<NonNullable<RunProgressNotifier['onRunStarted']>>[0]): Promise<void> {
    const callback = input.message.context?.callback;
    if (!callback || typeof callback !== 'object' || Array.isArray(callback)) return;
    const type = 'type' in callback ? callback.type : undefined;
    const channel = 'channel' in callback ? callback.channel : undefined;
    const threadTs = 'threadTs' in callback ? callback.threadTs : undefined;
    if (type !== 'slack' || typeof channel !== 'string' || !channel || typeof threadTs !== 'string' || !threadTs)
      return;

    const response = await this.client.setThreadStatus({ channel, threadTs, status: 'Working on your request...' });
    if (!response.ok) throw new Error(`Slack progress status failed${response.error ? `: ${response.error}` : ''}`);
  }
}
