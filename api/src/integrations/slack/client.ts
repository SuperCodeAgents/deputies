export class SlackClient {
  constructor(
    private readonly options: { apiBaseUrl: string; botToken?: string },
  ) {}

  async postThreadReply(input: { channel: string; threadTs: string; text: string }): Promise<{ ok: boolean; ts?: string; error?: string }> {
    if (!this.options.botToken) throw new Error('SLACK_BOT_TOKEN is required to post Slack replies');
    const response = await fetch(`${this.options.apiBaseUrl.replace(/\/$/, '')}/chat.postMessage`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.options.botToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ channel: input.channel, thread_ts: input.threadTs, text: input.text }),
    });
    return (await response.json()) as { ok: boolean; ts?: string; error?: string };
  }
}
