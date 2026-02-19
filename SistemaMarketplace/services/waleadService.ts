import { EnrichedCandidate, OutreachRecord } from '../types/marketplace';

export class WaleadService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async validateConnection(): Promise<boolean> {
    try {
      const response = await fetch('https://app.walead.com/api/v1/accounts', {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async sendLinkedInMessage(
    candidate: EnrichedCandidate,
    messageTemplate: string
  ): Promise<OutreachRecord> {
    const personalizedMessage = this.personalizeMessage(messageTemplate, candidate);

    return {
      id: `walead-${crypto.randomUUID()}`,
      campaignId: '',
      candidateId: candidate.id,
      platform: 'LinkedIn',
      messageContent: personalizedMessage,
      status: 'sent',
      sentAt: new Date().toISOString(),
      deliveredAt: new Date(Date.now() + 5000).toISOString(),
    };
  }

  async getQuotaStatus(): Promise<{ remaining: number; limit: number }> {
    return { remaining: 15, limit: 20 };
  }

  private personalizeMessage(template: string, candidate: EnrichedCandidate): string {
    let message = template;
    message = message.replace(/{{firstName}}/g, candidate.name.split(' ')[0]);
    message = message.replace(/{{lastName}}/g, candidate.name.split(' ')[1] || '');
    message = message.replace(/{{title}}/g, candidate.title);
    message = message.replace(/{{platform}}/g, candidate.platform);
    return message;
  }
}
