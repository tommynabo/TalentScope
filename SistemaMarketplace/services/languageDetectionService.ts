/**
 * LanguageDetectionService - Detects if a candidate speaks a specific language
 * 
 * FILTRO HISPANOHABLANTE: Usa el mismo enfoque que LinkedIn (que funciona)
 * Pasa si cumple AL MENOS UNA señal:
 *   1. Nombre o apellido hispano
 *   2. Ubicación en país/ciudad hispanohablante
 *   3. Texto en español en bio/título
 */

import { isLikelyHispanohablante, analyzeSpanishLanguageProficiency, detectSpanishInText } from '../../SistemaGithub/lib/githubSpanishLanguageFilter';

export class LanguageDetectionService {

  /**
   * Detect language from profile text
   * Uses multi-signal approach: name, location, and text content
   */
  static detectLanguage(
    bio: string = '',
    title: string = '',
    country: string = '',
    name: string = ''
  ): 'es' | 'en' | 'unknown' {
    // Quick multi-signal check: name OR location OR text
    if (isLikelyHispanohablante(name || null, null, bio || null, title || null, country || null)) {
      return 'es';
    }
    return 'en';
  }

  /**
   * Check if candidate speaks required language
   * For Spanish: uses multi-signal approach (name OR location OR text)
   * ANY ONE signal is enough to pass
   */
  static speaksLanguage(
    bio: string = '',
    title: string = '',
    country: string = '',
    requiredLanguage: string = 'en',
    name: string = ''
  ): boolean {
    if (!requiredLanguage || requiredLanguage === 'en') {
      return true; // English is default, accept all
    }

    if (requiredLanguage === 'es' || requiredLanguage === 'español') {
      // Multi-signal check: ANY one signal = pass
      return isLikelyHispanohablante(name || null, null, bio || null, title || null, country || null);
    }

    return true; // For other languages, accept all by default
  }
}
