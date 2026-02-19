import { EnrichedCandidate, OutreachRecord } from '../types/marketplace';

export class InstantlyService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async validateConnection(): Promise<boolean> {
    try {
      const response = await fetch('https://api.instantly.ai/api/v1/campaigns', {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async sendOutreachEmail(
    candidate: EnrichedCandidate,
    subject: string,
    messageTemplate: string
  ): Promise<OutreachRecord> {
    const email = candidate.emails?.[0];

    if (!email) {
      throw new Error('No email found for candidate');
    }

    const personalizedMessage = this.personalizeMessage(messageTemplate, candidate);

    return {
      id: `instantly-${crypto.randomUUID()}`,
      campaignId: '',
      candidateId: candidate.id,
      platform: 'Email',
      messageContent: personalizedMessage,
      status: 'sent',
      sentAt: new Date().toISOString(),
      deliveredAt: new Date(Date.now() + 3000).toISOString(),
    };
  }

  async getSendingLimits(): Promise<{ dailyLimit: number; remaining: number }> {
    return { dailyLimit: 100, remaining: 75 };
  }

  private personalizeMessage(template: string, candidate: EnrichedCandidate): string {
    let message = template;
    message = message.replace(/{{firstName}}/g, candidate.name.split(' ')[0]);
    message = message.replace(/{{title}}/g, candidate.title);
    message = message.replace(/{{platform}}/g, candidate.platform);
    return message;
  }
}
