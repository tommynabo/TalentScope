import { MarketplaceRaid, EnrichedCandidate, OutreachCampaign } from '../types/marketplace';

/**
 * CSV Export utilities for Marketplace Raid
 * Generates downloadable CSV files with candidate data
 */
export class MarketplaceCSVExport {

  /**
   * SMART SPLIT EXPORT: Auto-downloads 2 CSVs
   * - LINKEDIN_marketplace_...csv → candidates WITH LinkedIn URL
   * - EMAIL_marketplace_...csv → candidates WITH email but NO LinkedIn
   * Returns summary string for toast/UI
   */
  static exportCandidatesSplit(
    raid: MarketplaceRaid,
    candidates: EnrichedCandidate[] = []
  ): string {
    const data = candidates.length > 0 ? candidates : raid.enrichedCandidates;

    if (data.length === 0) {
      alert('❌ No hay candidatos para exportar');
      return '';
    }

    const today = new Date().toISOString().split('T')[0];
    const raidTag = raid.raidName.replace(/[^a-zA-Z0-9]/g, '_');

    // Split candidates by contact type
    const linkedinCandidates = data.filter(c => c.linkedInUrl && c.linkedInUrl.trim().length > 0);
    const emailOnlyCandidates = data.filter(c =>
      c.emails && c.emails.length > 0 && c.emails[0].trim().length > 0 &&
      (!c.linkedInUrl || c.linkedInUrl.trim().length === 0)
    );

    const buildCSV = (items: EnrichedCandidate[]): string => {
      const headers = [
        'Nombre', 'Plataforma', 'Username', 'Título', 'País',
        'Tarifa_Hora', 'Success_Rate', 'LinkedIn', 'Emails',
        'Identidad_Score', 'Fecha_Scraping'
      ];
      const rows = items.map(c => [
        `"${c.name}"`,
        `"${c.platform}"`,
        `"${c.platformUsername}"`,
        `"${c.title}"`,
        `"${c.country}"`,
        c.hourlyRate.toFixed(2),
        `${c.jobSuccessRate.toFixed(0)}%`,
        `"${c.linkedInUrl || ''}"`,
        `"${c.emails.join('; ')}"`,
        c.identityConfidenceScore.toFixed(2),
        `"${c.scrapedAt.split('T')[0]}"`
      ]);
      return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    };

    // Download LinkedIn CSV
    if (linkedinCandidates.length > 0) {
      this.downloadCSV(
        buildCSV(linkedinCandidates),
        `LINKEDIN_marketplace_${raidTag}_${today}.csv`
      );
    }

    // Download Email CSV (small delay to avoid browser blocking)
    if (emailOnlyCandidates.length > 0) {
      setTimeout(() => {
        this.downloadCSV(
          buildCSV(emailOnlyCandidates),
          `EMAIL_marketplace_${raidTag}_${today}.csv`
        );
      }, 500);
    }

    // Build summary
    const parts: string[] = [];
    if (emailOnlyCandidates.length > 0) parts.push(`${emailOnlyCandidates.length} Email`);
    if (linkedinCandidates.length > 0) parts.push(`${linkedinCandidates.length} LinkedIn`);
    const noContact = data.length - linkedinCandidates.length - emailOnlyCandidates.length;
    if (noContact > 0) parts.push(`${noContact} sin contacto`);

    return `✅ Exportados ${data.length} candidatos → ${parts.join(' + ')}`;
  }

  /**
   * Legacy single-file export (kept for backward compatibility)
   */
  static exportCandidates(
    raid: MarketplaceRaid,
    candidates: EnrichedCandidate[] = []
  ): void {
    // Delegate to the new split export
    this.exportCandidatesSplit(raid, candidates);
  }

  /**
   * Export campaign with outreach data
   */
  static exportCampaignResults(
    campaign: OutreachCampaign,
    records: any[]
  ): void {
    const headers = [
      'Candidato',
      'Plataforma',
      'Mensaje',
      'Estado',
      'Enviado',
      'Entregado',
      'Abierto'
    ];

    const rows = records.map(r => [
      `"${r.candidateId}"`,
      `"${r.platform}"`,
      `"${r.messageContent.substring(0, 50)}..."`,
      `"${r.status}"`,
      `"${r.sentAt ? r.sentAt.split('T')[0] : ''}"`,
      `"${r.deliveredAt ? r.deliveredAt.split('T')[0] : ''}"`,
      `"${r.openedAt ? r.openedAt.split('T')[0] : ''}"`
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    this.downloadCSV(csvContent, `campaign_results_${campaign.name}_${new Date().toISOString().split('T')[0]}.csv`);
  }

  /**
   * Export enrichment report with potential emails
   */
  static exportEnrichmentReport(
    raid: MarketplaceRaid,
    candidates: EnrichedCandidate[]
  ): void {
    const headers = [
      'Nombre',
      'Email 1',
      'Email 2',
      'Email 3',
      'LinkedIn URL',
      'Identity Score',
      'Photo Validated',
      'Recomendación'
    ];

    const rows = candidates.map(c => {
      const recommendation = c.identityConfidenceScore > 0.8 ? 'Alto Potencial' :
        c.identityConfidenceScore > 0.6 ? 'Mediano Potencial' :
          'Bajo Potencial';

      return [
        `"${c.name}"`,
        `"${c.emails[0] || ''}"`,
        `"${c.emails[1] || ''}"`,
        `"${c.emails[2] || ''}"`,
        `"${c.linkedInUrl || ''}"`,
        c.identityConfidenceScore.toFixed(2),
        c.photoValidated ? 'Sí' : 'No',
        `"${recommendation}"`
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    this.downloadCSV(csvContent, `enrichment_report_${raid.raidName}_${new Date().toISOString().split('T')[0]}.csv`);
  }

  /**
   * Export contact list — SMART SPLIT by LinkedIn vs Email
   */
  static exportContactList(
    campaign: OutreachCampaign,
    candidates: EnrichedCandidate[]
  ): void {
    if (candidates.length === 0) {
      alert('❌ No hay candidatos para exportar');
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const campaignTag = campaign.name.replace(/[^a-zA-Z0-9]/g, '_');

    const linkedinCandidates = candidates.filter(c => c.linkedInUrl && c.linkedInUrl.trim().length > 0);
    const emailOnlyCandidates = candidates.filter(c =>
      c.emails && c.emails.length > 0 && c.emails[0].trim().length > 0 &&
      (!c.linkedInUrl || c.linkedInUrl.trim().length === 0)
    );

    const headers = ['Nombre', 'Email_Principal', 'Emails_Alternativas', 'LinkedIn_URL', 'Plataforma', 'Tarifa_Hora', 'Notas'];

    const buildCSV = (items: EnrichedCandidate[]): string => {
      const rows = items.map(c => [
        `"${c.name}"`,
        `"${c.emails[0] || 'N/A'}"`,
        `"${c.emails.slice(1).join('; ')}"`,
        `"${c.linkedInUrl || ''}"`,
        `"${c.platform}"`,
        c.hourlyRate.toFixed(2),
        `"Campaña: ${campaign.name}"`
      ]);
      return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    };

    if (linkedinCandidates.length > 0) {
      this.downloadCSV(buildCSV(linkedinCandidates), `LINKEDIN_contactos_${campaignTag}_${today}.csv`);
    }

    if (emailOnlyCandidates.length > 0) {
      setTimeout(() => {
        this.downloadCSV(buildCSV(emailOnlyCandidates), `EMAIL_contactos_${campaignTag}_${today}.csv`);
      }, 500);
    }

    const parts: string[] = [];
    if (emailOnlyCandidates.length > 0) parts.push(`${emailOnlyCandidates.length} Email`);
    if (linkedinCandidates.length > 0) parts.push(`${linkedinCandidates.length} LinkedIn`);
    const noContact = candidates.length - linkedinCandidates.length - emailOnlyCandidates.length;
    if (noContact > 0) parts.push(`${noContact} sin contacto`);

    alert(`✅ Exportados ${candidates.length} contactos → ${parts.join(' + ')}`);
  }

  /**
   * Helper: Download CSV file
   */
  private static downloadCSV(content: string, filename: string): void {
    const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
}
