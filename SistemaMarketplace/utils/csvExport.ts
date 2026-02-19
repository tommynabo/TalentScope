import { MarketplaceRaid, EnrichedCandidate, OutreachCampaign } from '../types/marketplace';

/**
 * CSV Export utilities for Marketplace Raid
 * Generates downloadable CSV files with candidate data
 */
export class MarketplaceCSVExport {
  
  /**
   * Export enriched candidates to CSV
   */
  static exportCandidates(
    raid: MarketplaceRaid,
    candidates: EnrichedCandidate[] = []
  ): void {
    const data = candidates.length > 0 ? candidates : raid.enrichedCandidates;

    if (data.length === 0) {
      alert('❌ No hay candidatos para exportar');
      return;
    }

    const headers = [
      'Nombre',
      'Plataforma',
      'Username',
      'Título',
      'País',
      'Tarifa Hora',
      'Success Rate',
      'LinkedIn',
      'Emails',
      'Identidad Score',
      'Fecha Scraping'
    ];

    const rows = data.map(c => [
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

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    this.downloadCSV(csvContent, `marketplace_candidates_${raid.raidName}_${new Date().toISOString().split('T')[0]}.csv`);
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
   * Export contact list ready for manual outreach
   */
  static exportContactList(
    campaign: OutreachCampaign,
    candidates: EnrichedCandidate[]
  ): void {
    const headers = [
      'Nombre',
      'Email Principal',
      'Emails Alternativas',
      'LinkedIn URL',
      'Plataforma Origen',
      'Tarifa Hora',
      'Notas'
    ];

    const rows = candidates.map(c => [
      `"${c.name}"`,
      `"${c.emails[0] || 'N/A'}"`,
      `"${c.emails.slice(1).join('; ')}"`,
      `"${c.linkedInUrl || ''}"`,
      `"${c.platform}"`,
      c.hourlyRate.toFixed(2),
      `"Agregado a: ${campaign.name}"`
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    this.downloadCSV(csvContent, `contact_list_${campaign.name}_${new Date().toISOString().split('T')[0]}.csv`);
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
