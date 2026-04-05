/**
 * lib/core — Public API
 *
 * Re-exports everything needed to build a search engine on top of the
 * shared infrastructure. Import from here, not from individual files.
 *
 * @example
 *   import { BaseSearchEngine, SharedDeduplicationService,
 *             isLikelySpanishSpeaker, SYSTEM_PROMPTS } from '../../lib/core';
 */

export { BaseSearchEngine }     from './BaseSearchEngine';
export type { RawCandidate, BaseSearchOptions, LogCallback } from './BaseSearchEngine';

export { SharedDeduplicationService } from './SharedDeduplicationService';
export type { DeduplicationKey, LoadOptions } from './SharedDeduplicationService';

export { SharedBatchScoringService, SYSTEM_PROMPTS } from './SharedBatchScoringService';
export type { ScoringProfile, ScoringResult, BatchScoringOptions } from './SharedBatchScoringService';

export {
    isLikelySpanishSpeaker,
    hasSpanishName,
    hasSpanishLocationOrText,
} from './SharedLanguageFilter';
export type { SpanishDetectionResult } from './SharedLanguageFilter';
