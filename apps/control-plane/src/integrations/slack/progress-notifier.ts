import type { RunProgressNotifier } from '../../worker/service.js';
import type { SlackAssistantThreadClient, SlackReactionClient, SlackReplyClient } from './client.js';

export class SlackRunProgressNotifier implements RunProgressNotifier {
  constructor(private readonly client: SlackAssistantThreadClient & Partial<SlackReplyClient & SlackReactionClient>) {}

  async onRunStarted(input: Parameters<NonNullable<RunProgressNotifier['onRunStarted']>>[0]): Promise<void> {
    await this.addReaction(input.message, 'hourglass_flowing_sand');
    await this.setSlackThreadStatus(input.message, 'Working on your request...');
  }

  async onRunCompleted(input: Parameters<NonNullable<RunProgressNotifier['onRunCompleted']>>[0]): Promise<void> {
    await this.removeReaction(input.message, 'hourglass_flowing_sand');
    await this.addReaction(input.message, 'white_check_mark');
  }

  async onRunFailed(input: Parameters<NonNullable<RunProgressNotifier['onRunFailed']>>[0]): Promise<void> {
    await this.removeReaction(input.message, 'hourglass_flowing_sand');
    await this.addReaction(input.message, 'x');
    await this.postFailureReply(input.message);
  }

  async onRunCancelled(input: Parameters<NonNullable<RunProgressNotifier['onRunCancelled']>>[0]): Promise<void> {
    await this.setSlackThreadStatus(input.message, '');
    await this.removeReaction(input.message, 'hourglass_flowing_sand');
    await this.addReaction(input.message, 'x');
    await this.postCancellationReply(input.message);
  }

  private async setSlackThreadStatus(
    message: Parameters<NonNullable<RunProgressNotifier['onRunStarted']>>[0]['message'],
    status: string,
  ): Promise<void> {
    const callback = message.context?.callback;
    if (!callback || typeof callback !== 'object' || Array.isArray(callback)) return;
    const type = 'type' in callback ? callback.type : undefined;
    const channel = 'channel' in callback ? callback.channel : undefined;
    const threadTs = 'threadTs' in callback ? callback.threadTs : undefined;
    if (type !== 'slack' || typeof channel !== 'string' || !channel || typeof threadTs !== 'string' || !threadTs)
      return;

    const response = await this.client.setThreadStatus({ channel, threadTs, status });
    if (!response.ok) throw new Error(`Slack progress status failed${response.error ? `: ${response.error}` : ''}`);
  }

  private async addReaction(
    message: Parameters<NonNullable<RunProgressNotifier['onRunStarted']>>[0]['message'],
    name: string,
  ): Promise<void> {
    if (!this.client.addReaction) return;
    const target = reactionTarget(message);
    if (!target) return;
    const response = await this.client.addReaction({ ...target, name });
    if (!response.ok && response.error !== 'already_reacted') {
      throw new Error(`Slack reaction add failed${response.error ? `: ${response.error}` : ''}`);
    }
  }

  private async removeReaction(
    message: Parameters<NonNullable<RunProgressNotifier['onRunStarted']>>[0]['message'],
    name: string,
  ): Promise<void> {
    if (!this.client.removeReaction) return;
    const target = reactionTarget(message);
    if (!target) return;
    const response = await this.client.removeReaction({ ...target, name });
    if (!response.ok && response.error !== 'no_reaction') {
      throw new Error(`Slack reaction remove failed${response.error ? `: ${response.error}` : ''}`);
    }
  }

  private async postCancellationReply(
    message: Parameters<NonNullable<RunProgressNotifier['onRunStarted']>>[0]['message'],
  ): Promise<void> {
    await this.postThreadReply(message, ':no_entry: Execution was cancelled.');
  }

  private async postFailureReply(
    message: Parameters<NonNullable<RunProgressNotifier['onRunStarted']>>[0]['message'],
  ): Promise<void> {
    await this.postThreadReply(message, ':x: Execution failed.');
  }

  private async postThreadReply(
    message: Parameters<NonNullable<RunProgressNotifier['onRunStarted']>>[0]['message'],
    text: string,
  ): Promise<void> {
    if (!this.client.postThreadReply) return;
    const target = threadTarget(message);
    if (!target) return;
    const response = await this.client.postThreadReply({
      ...target,
      text,
      blocks: [{ type: 'section', text: { type: 'mrkdwn', text } }],
    });
    if (!response.ok) throw new Error(`Slack reply failed${response.error ? `: ${response.error}` : ''}`);
  }
}

function reactionTarget(
  message: Parameters<NonNullable<RunProgressNotifier['onRunStarted']>>[0]['message'],
): { channel: string; ts: string } | null {
  const callback = message.context?.callback;
  if (!callback || typeof callback !== 'object' || Array.isArray(callback)) return null;
  const type = 'type' in callback ? callback.type : undefined;
  const channel = 'channel' in callback ? callback.channel : undefined;
  const messageTs = 'messageTs' in callback ? callback.messageTs : undefined;
  if (type !== 'slack' || typeof channel !== 'string' || !channel || typeof messageTs !== 'string' || !messageTs)
    return null;
  return { channel, ts: messageTs };
}

function threadTarget(
  message: Parameters<NonNullable<RunProgressNotifier['onRunStarted']>>[0]['message'],
): { channel: string; threadTs: string } | null {
  const callback = message.context?.callback;
  if (!callback || typeof callback !== 'object' || Array.isArray(callback)) return null;
  const type = 'type' in callback ? callback.type : undefined;
  const channel = 'channel' in callback ? callback.channel : undefined;
  const threadTs = 'threadTs' in callback ? callback.threadTs : undefined;
  if (type !== 'slack' || typeof channel !== 'string' || !channel || typeof threadTs !== 'string' || !threadTs)
    return null;
  return { channel, threadTs };
}
