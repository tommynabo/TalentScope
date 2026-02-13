import React from 'react';
import { Check, X } from 'lucide-react';
import { ScoreBreakdown } from '../types/database';
import { getScoreLabel } from '../lib/scoring';

interface ScoreBreakdownCardProps {
  score: number;
  breakdown: ScoreBreakdown;
  candidateName?: string;
}

export const ScoreBreakdownCard: React.FC<ScoreBreakdownCardProps> = ({
  score,
  breakdown,
  candidateName
}) => {
  const scoreColor = score >= 80 ? 'text-green-400' : 
                     score >= 70 ? 'text-yellow-400' : 'text-red-400';
  
  const scoreBgColor = score >= 80 ? 'bg-green-950/30 border-green-500/20' :
                       score >= 70 ? 'bg-yellow-950/30 border-yellow-500/20' : 
                       'bg-red-950/30 border-red-500/20';

  const criteria = [
    { label: 'Age (18-30)', points: breakdown.age, max: 1, importance: 'X' },
    { label: 'Engineering Degree', points: breakdown.education, max: 1, importance: 'X' },
    { label: 'Published Apps', points: breakdown.published_apps, max: 2, importance: 'XX' },
    { label: 'Flutter/Dart Experience', points: breakdown.flutter_dart, max: 2, importance: 'XX' },
    { label: 'Online Portfolio', points: breakdown.portfolio, max: 2, importance: 'XX' },
    { label: 'Open Source Activity', points: breakdown.open_source, max: 2, importance: 'XX' },
    { label: 'Startup Experience', points: breakdown.startup, max: 2, importance: 'XX' },
    { label: 'Founded Business', points: breakdown.founder, max: 1, importance: 'X' },
    { label: 'Backend Knowledge', points: breakdown.backend, max: 1, importance: 'X' },
    { label: 'UX/UI Awareness', points: breakdown.ui_ux, max: 1, importance: 'X' },
    { label: 'AI Experience', points: breakdown.ai, max: 1, importance: 'X' }
  ];

  const xxCriteria = criteria.filter(c => c.importance === 'XX');
  const xCriteria = criteria.filter(c => c.importance === 'X');

  return (
    <div className={`rounded-xl border p-5 ${scoreBgColor}`}>
      {/* Header with Score */}
      <div className="mb-5">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-300">
              Score Breakdown {candidateName && `- ${candidateName}`}
            </h3>
            <p className="text-xs text-slate-500 mt-1">{getScoreLabel(score)}</p>
          </div>
          <split className="text-right">
            <span className={`text-3xl font-bold ${scoreColor}`}>{breakdown.normalized}</span>
            <span className="text-xs text-slate-400 ml-1">/100</span>
          </split>
        </div>
        {/* Progress Bar */}
        <div className="w-full bg-slate-950 rounded-full h-2">
          <div
            className={`h-full rounded-full transition-all ${
              breakdown.normalized >= 80 ? 'bg-green-500' :
              breakdown.normalized >= 70 ? 'bg-yellow-500' :
              'bg-red-500'
            }`}
            style={{ width: `${breakdown.normalized}%` }}
          />
        </div>
      </div>

      {/* Criteria Sections */}
      <div className="space-y-4">
        {/* High Importance Criteria (XX) */}
        {xxCriteria.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-emerald-400 uppercase mb-2">High Importance (2pts each)</h4>
            <div className="space-y-2">
              {xxCriteria.map(criterion => (
                <div key={criterion.label} className="flex items-center justify-between text-xs bg-slate-950/50 p-2 rounded">
                  <div className="flex items-center gap-2 flex-1">
                    {criterion.points > 0 ? (
                      <Check className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
                    ) : (
                      <X className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                    )}
                    <span className={criterion.points > 0 ? 'text-slate-200' : 'text-slate-500'}>
                      {criterion.label}
                    </span>
                  </div>
                  <span className={`font-semibold ${criterion.points > 0 ? 'text-green-400' : 'text-slate-500'}`}>
                    {criterion.points}/{criterion.max}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Normal Importance Criteria (X) */}
        {xCriteria.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-yellow-400 uppercase mb-2">Standard + Bonus (1pt each)</h4>
            <div className="space-y-2">
              {xCriteria.map(criterion => (
                <div key={criterion.label} className="flex items-center justify-between text-xs bg-slate-950/50 p-2 rounded">
                  <div className="flex items-center gap-2 flex-1">
                    {criterion.points > 0 ? (
                      <Check className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
                    ) : (
                      <X className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                    )}
                    <span className={criterion.points > 0 ? 'text-slate-200' : 'text-slate-500'}>
                      {criterion.label}
                    </span>
                  </div>
                  <span className={`font-semibold ${criterion.points > 0 ? 'text-green-400' : 'text-slate-500'}`}>
                    {criterion.points}/{criterion.max}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Total Summary */}
      <div className="mt-4 pt-3 border-t border-slate-700/50 flex justify-between">
        <div className="text-xs font-semibold text-slate-300">
          Total Points
        </div>
        <div className="flex gap-2">
          <span className={`text-sm font-bold ${scoreColor}`}>
            {breakdown.total}
          </span>
          <span className="text-xs text-slate-500">/15</span>
        </div>
      </div>

      {/* Status Indicator */}
      <div className="mt-3 pt-3 border-t border-slate-700/50">
        <span className={`text-xs font-semibold ${breakdown.passes_threshold ? 'text-green-400' : 'text-red-400'}`}>
          {breakdown.passes_threshold ? '✅ Passes Threshold (8+ points)' : '❌ Below Threshold (needs 8 points)'}
        </span>
      </div>
    </div>
  );
};

export default ScoreBreakdownCard;
