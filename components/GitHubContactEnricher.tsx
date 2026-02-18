import React, { useState, useEffect } from 'react';
import { Mail, Linkedin, Globe, Loader, Pause, Play, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { GitHubMetrics } from '../types/database';
import { 
    GitHubBatchContactEnricher, 
    EnrichmentProgress, 
    EnrichmentResult,
    EnrichmentOptions 
} from '../lib/githubBatchContactEnricher';

// Re-export EnrichmentResult for consumers
export type { EnrichmentResult, EnrichmentProgress, EnrichmentOptions };

interface GitHubContactEnricherProps {
    candidates: GitHubMetrics[];
    campaignId: string;
    userId: string;
    onComplete?: (results: EnrichmentResult[]) => void;
    onClose?: () => void;
    autoStart?: boolean;
}

export const GitHubContactEnricher: React.FC<GitHubContactEnricherProps> = ({
    candidates,
    campaignId,
    userId,
    onComplete,
    onClose,
    autoStart = true
}) => {
    const [isRunning, setIsRunning] = useState(autoStart);
    const [isPaused, setIsPaused] = useState(false);
    const [progress, setProgress] = useState<EnrichmentProgress | null>(null);
    const [results, setResults] = useState<EnrichmentResult[]>([]);
    const [recentUpdates, setRecentUpdates] = useState<EnrichmentResult[]>([]);
    const [stats, setStats] = useState({
        totalEmails: 0,
        totalLinkedins: 0,
        successRate: 0
    });

    const enricher = new GitHubBatchContactEnricher();

    useEffect(() => {
        if (!isRunning || !candidates.length) return;

        const startEnrichment = async () => {
            const options: EnrichmentOptions = {
                parallelRequests: 1,
                delayBetweenRequests: 300,
                maxRetries: 2,
                persistProgressEvery: 3,
                skipAlreadyEnriched: true
            };

            const enrichmentResults = await enricher.enrichCandidates(
                candidates,
                campaignId,
                userId,
                options,
                (progress, batchResults) => {
                    setProgress(progress);
                    setResults(prev => [...prev, ...batchResults]);
                    setRecentUpdates(batchResults);

                    // Update stats
                    const allResults = [...results, ...batchResults];
                    setStats({
                        totalEmails: allResults.filter(r => r.updated.mentioned_email).length,
                        totalLinkedins: allResults.filter(r => r.updated.linkedin_url).length,
                        successRate: allResults.length > 0 
                            ? Math.round((allResults.filter(r => r.success).length / allResults.length) * 100)
                            : 0
                    });
                }
            );

            setIsRunning(false);
            onComplete?.(enrichmentResults);
        };

        startEnrichment();

        return () => {
            if (!isRunning) {
                enricher.cancel();
            }
        };
    }, [isRunning, candidates, campaignId, userId]);

    const handlePause = () => {
        setIsPaused(true);
        enricher.pause();
    };

    const handleResume = () => {
        setIsPaused(false);
        enricher.resume();
    };

    const handleStop = () => {
        setIsRunning(false);
        enricher.cancel();
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="sticky top-0 bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700 p-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Mail className="h-7 w-7 text-cyan-400" />
                            Contact Research Engine
                        </h2>
                        <p className="text-slate-400 text-sm mt-1">Deep dive into GitHub profiles to find emails and LinkedIn URLs</p>
                    </div>
                    {!isRunning && (
                        <button
                            onClick={onClose}
                            className="text-slate-400 hover:text-white text-2xl font-bold"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Progress Bar */}
                    {progress && (
                        <div className="space-y-4">
                            {/* Main Stats */}
                            <div className="grid grid-cols-4 gap-3">
                                <StatCard
                                    icon={<Mail className="h-5 w-5" />}
                                    label="Emails Found"
                                    value={stats.totalEmails}
                                    color="blue"
                                />
                                <StatCard
                                    icon={<Linkedin className="h-5 w-5" />}
                                    label="LinkedIn Found"
                                    value={stats.totalLinkedins}
                                    color="cyan"
                                />
                                <StatCard
                                    icon={<CheckCircle2 className="h-5 w-5" />}
                                    label="Success Rate"
                                    value={`${stats.successRate}%`}
                                    color="green"
                                />
                                <StatCard
                                    icon={<AlertCircle className="h-5 w-5" />}
                                    label="Failed"
                                    value={progress.failedCount}
                                    color="red"
                                />
                            </div>

                            {/* Progress Bar */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-slate-300">
                                        Progress: {progress.processedCount} / {progress.totalCandidates}
                                    </span>
                                    <span className="text-slate-400">
                                        {progress.percentComplete}%
                                    </span>
                                </div>
                                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                                    <div 
                                        className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full transition-all duration-300"
                                        style={{ width: `${progress.percentComplete}%` }}
                                    />
                                </div>
                            </div>

                            {/* Current & Remaining */}
                            <div className="grid grid-cols-3 gap-3 text-sm">
                                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                                    <p className="text-slate-400">Current</p>
                                    <p className="text-white font-semibold">
                                        {progress.currentProcessing ? `@${progress.currentProcessing}` : '—'}
                                    </p>
                                </div>
                                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                                    <p className="text-slate-400">Remaining</p>
                                    <p className="text-white font-semibold">
                                        {Math.max(0, progress.totalCandidates - progress.processedCount)} users
                                    </p>
                                </div>
                                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                                    <p className="text-slate-400">ETA</p>
                                    <p className="text-white font-semibold">
                                        {progress.estimatedTimeRemaining}s
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Recent Updates */}
                    {recentUpdates.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-slate-300">Recent Updates</h3>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                {recentUpdates.slice(-5).reverse().map(result => (
                                    <div 
                                        key={result.username}
                                        className="bg-slate-800/50 border border-slate-700 rounded-lg p-3"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-white font-medium">@{result.username}</span>
                                            {result.success ? (
                                                <CheckCircle2 className="h-4 w-4 text-green-400" />
                                            ) : (
                                                <AlertCircle className="h-4 w-4 text-red-400" />
                                            )}
                                        </div>
                                        
                                        {result.updated_fields.length > 0 ? (
                                            <div className="flex gap-2 flex-wrap">
                                                {result.updated.mentioned_email && (
                                                    <div className="flex items-center gap-1 bg-blue-900/30 border border-blue-700/50 rounded px-2 py-1">
                                                        <Mail className="h-3 w-3 text-blue-400" />
                                                        <span className="text-xs text-blue-300 truncate">
                                                            {result.updated.mentioned_email}
                                                        </span>
                                                    </div>
                                                )}
                                                {result.updated.linkedin_url && (
                                                    <div className="flex items-center gap-1 bg-cyan-900/30 border border-cyan-700/50 rounded px-2 py-1">
                                                        <Linkedin className="h-3 w-3 text-cyan-400" />
                                                        <span className="text-xs text-cyan-300">LinkedIn</span>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-slate-400">No new contact info found</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Loading State */}
                    {isRunning && !progress && (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader className="h-12 w-12 text-cyan-400 animate-spin mb-4" />
                            <p className="text-slate-300">Initializing contact research engine...</p>
                        </div>
                    )}
                </div>

                {/* Footer - Controls */}
                {isRunning && (
                    <div className="sticky bottom-0 bg-slate-800/50 border-t border-slate-700 p-6 flex gap-4">
                        {!isPaused ? (
                            <button
                                onClick={handlePause}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg font-semibold transition"
                            >
                                <Pause className="h-5 w-5" />
                                Pause
                            </button>
                        ) : (
                            <button
                                onClick={handleResume}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-semibold transition"
                            >
                                <Play className="h-5 w-5" />
                                Resume
                            </button>
                        )}
                        <button
                            onClick={handleStop}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-200 rounded-lg font-semibold transition border border-red-700/50"
                        >
                            <X className="h-5 w-5" />
                            Stop
                        </button>
                    </div>
                )}

                {/* Completed State */}
                {!isRunning && progress && (
                    <div className="sticky bottom-0 bg-gradient-to-t from-slate-800 to-slate-800/0 border-t border-slate-700 p-6">
                        <button
                            onClick={onClose}
                            className="w-full px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg font-semibold transition"
                        >
                            ✓ Done - Close
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    color: 'blue' | 'cyan' | 'green' | 'red';
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color }) => {
    const colorClasses = {
        blue: 'text-blue-400 bg-blue-900/20 border-blue-700/50',
        cyan: 'text-cyan-400 bg-cyan-900/20 border-cyan-700/50',
        green: 'text-green-400 bg-green-900/20 border-green-700/50',
        red: 'text-red-400 bg-red-900/20 border-red-700/50'
    };

    return (
        <div className={`bg-slate-800/50 border rounded-lg p-3 ${colorClasses[color]}`}>
            <div className="flex items-center gap-2 mb-1">
                <div className="h-4 w-4">{icon}</div>
                <p className="text-xs text-slate-400">{label}</p>
            </div>
            <p className="text-lg font-bold">{value}</p>
        </div>
    );
};
