import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Info, Copy } from 'lucide-react';
import { GitHubFilterCriteria } from '../../types/database';
import { GITHUB_FILTER_PRESETS, PRESET_INSIGHTS } from '../../lib/githubPresets';

interface GitHubFilterConfigProps {
    initialCriteria?: GitHubFilterCriteria;
    onSave: (criteria: GitHubFilterCriteria) => void;
}

const DEFAULT_CRITERIA: GitHubFilterCriteria = {
    min_stars: 50,
    max_stars: 10000,
    min_forks: 0,
    languages: ['dart', 'flutter', 'typescript'],
    min_public_repos: 5,
    min_followers: 10,
    min_contributions_per_month: 5,
    min_originality_ratio: 30,
    exclude_generic_repos: true,
    require_recent_activity: true,
    max_months_since_last_commit: 6,
    require_app_store_link: false,
    locations: ['Spain'],
    available_for_hire: false,
    score_threshold: 60
};

export const GitHubFilterConfig: React.FC<GitHubFilterConfigProps> = ({
    initialCriteria = DEFAULT_CRITERIA,
    onSave
}) => {
    const [criteria, setCriteria] = useState<GitHubFilterCriteria>(initialCriteria);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        presets: true,
        repositoryMetrics: true,
        developers: true,
        codeQuality: false,
        store: true,
        geography: false,
        scoring: true
    });

    const toggleSection = (section: string) => {
        setExpandedSections({
            ...expandedSections,
            [section]: !expandedSections[section]
        });
    };

    const loadPreset = (presetName: string) => {
        const preset = GITHUB_FILTER_PRESETS[presetName as keyof typeof GITHUB_FILTER_PRESETS];
        if (preset) {
            setCriteria(preset);
        }
    };

    const handleLanguageToggle = (language: string) => {
        const currentLangs = criteria.languages || [];
        if (currentLangs.includes(language)) {
            setCriteria({
                ...criteria,
                languages: currentLangs.filter(l => l !== language)
            });
        } else {
            setCriteria({
                ...criteria,
                languages: [...currentLangs, language]
            });
        }
    };

    const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const locations = e.target.value.split(',').map(l => l.trim()).filter(l => l);
        setCriteria({ ...criteria, locations });
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 rounded-xl border border-slate-700">
                <h2 className="text-2xl font-bold text-white mb-2">GitHub Developer Search</h2>
                <p className="text-slate-400">Configure criteria to find high-quality developers with app shipping experience</p>
            </div>

            {/* Repository Metrics Section */}
            <Section
                title="Repository Metrics"
                section="repositoryMetrics"
                expanded={expandedSections.repositoryMetrics}
                onToggle={toggleSection}
            >
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">
                            Minimum Stars
                        </label>
                        <input
                            type="number"
                            value={criteria.min_stars}
                            onChange={(e) => setCriteria({ ...criteria, min_stars: parseInt(e.target.value) })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-cyan-500 outline-none"
                            min="0"
                            step="10"
                        />
                        <p className="text-xs text-slate-500 mt-1">Filters out bootcamp projects</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">
                            Maximum Stars
                        </label>
                        <input
                            type="number"
                            value={criteria.max_stars}
                            onChange={(e) => setCriteria({ ...criteria, max_stars: parseInt(e.target.value) })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-cyan-500 outline-none"
                            min="100"
                            step="1000"
                        />
                        <p className="text-xs text-slate-500 mt-1">Avoid finding mega-stars</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">
                            Minimum Forks
                        </label>
                        <input
                            type="number"
                            value={criteria.min_forks}
                            onChange={(e) => setCriteria({ ...criteria, min_forks: parseInt(e.target.value) })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-cyan-500 outline-none"
                            min="0"
                            step="5"
                        />
                        <p className="text-xs text-slate-500 mt-1">People who can fork their code</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">
                            Minimum Originality (%)
                        </label>
                        <input
                            type="number"
                            value={criteria.min_originality_ratio}
                            onChange={(e) => setCriteria({ ...criteria, min_originality_ratio: parseInt(e.target.value) })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-cyan-500 outline-none"
                            min="0"
                            max="100"
                            step="5"
                        />
                        <p className="text-xs text-slate-500 mt-1">Anti-bootcamp filter: % of non-fork repos</p>
                    </div>
                </div>

                <div className="mt-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={criteria.exclude_generic_repos}
                            onChange={(e) => setCriteria({ ...criteria, exclude_generic_repos: e.target.checked })}
                            className="rounded border-slate-600 text-cyan-500"
                        />
                        <span className="text-slate-300">Exclude generic repo names (todo, calc, weather, clone, etc)</span>
                    </label>
                    <p className="text-xs text-slate-500 mt-2 ml-7">Filters out tutorial projects</p>
                </div>
            </Section>

            {/* Developer Signals Section */}
            <Section
                title="Developer Signals"
                section="developers"
                expanded={expandedSections.developers}
                onToggle={toggleSection}
            >
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">
                            Minimum Public Repos
                        </label>
                        <input
                            type="number"
                            value={criteria.min_public_repos}
                            onChange={(e) => setCriteria({ ...criteria, min_public_repos: parseInt(e.target.value) })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-cyan-500 outline-none"
                            min="1"
                            max="100"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-400 mb-2">
                            Minimum Followers
                        </label>
                        <input
                            type="number"
                            value={criteria.min_followers}
                            onChange={(e) => setCriteria({ ...criteria, min_followers: parseInt(e.target.value) })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-cyan-500 outline-none"
                            min="0"
                            step="5"
                        />
                        <p className="text-xs text-slate-500 mt-1">Community recognition signal</p>
                    </div>

                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-slate-400 mb-2">
                            Min Monthly Contributions
                        </label>
                        <input
                            type="number"
                            value={criteria.min_contributions_per_month}
                            onChange={(e) => setCriteria({ ...criteria, min_contributions_per_month: parseInt(e.target.value) })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-cyan-500 outline-none"
                            min="1"
                            max="50"
                        />
                        <p className="text-xs text-slate-500 mt-1">Detect active developers (green squares)</p>
                    </div>
                </div>
            </Section>

            {/* Code Quality Section */}
            <Section
                title="Code Quality & Activity"
                section="codeQuality"
                expanded={expandedSections.codeQuality}
                onToggle={toggleSection}
            >
                <div className="space-y-4">
                    <div>
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={criteria.require_recent_activity}
                                onChange={(e) => setCriteria({ ...criteria, require_recent_activity: e.target.checked })}
                                className="rounded border-slate-600 text-cyan-500"
                            />
                            <span className="text-slate-300">Require Recent Activity</span>
                        </label>
                    </div>

                    {criteria.require_recent_activity && (
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">
                                Max Months Since Last Commit
                            </label>
                            <input
                                type="number"
                                value={criteria.max_months_since_last_commit}
                                onChange={(e) => setCriteria({ ...criteria, max_months_since_last_commit: parseInt(e.target.value) })}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-cyan-500 outline-none"
                                min="1"
                                max="24"
                            />
                        </div>
                    )}

                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                        <p className="text-sm text-slate-400 flex items-center gap-2">
                            <Info className="h-4 w-4" />
                            Active developers = those with commits in last 3-6 months
                        </p>
                    </div>
                </div>
            </Section>

            {/* App Store Link - THE CRITICAL SIGNAL */}
            <Section
                title="🎯 App Store Presence (Critical Signal)"
                section="store"
                expanded={expandedSections.store}
                onToggle={toggleSection}
            >
                <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/50 rounded-lg p-4 mb-4">
                    <p className="text-purple-200 font-semibold mb-2">The Proof of Shipping</p>
                    <p className="text-sm text-slate-300">
                        Developers with links to Play Store or App Store in their README are proven "Builders", not just coders.
                        This signal gets a +50% score boost automatically.
                    </p>
                </div>

                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={criteria.require_app_store_link}
                        onChange={(e) => setCriteria({ ...criteria, require_app_store_link: e.target.checked })}
                        className="rounded border-slate-600 text-purple-500"
                    />
                    <span className="text-slate-300 font-semibold">Require App Store / Play Store Link</span>
                </label>
                <p className="text-xs text-slate-500 mt-2 ml-7">
                    If enabled, only shows developers who have published apps
                </p>
            </Section>

            {/* Programming Languages */}
            <Section
                title="Programming Languages"
                section="geography"
                expanded={expandedSections.geography}
                onToggle={toggleSection}
            >
                <div className="space-y-2">
                    {['Dart', 'Flutter', 'TypeScript', 'Kotlin', 'Swift', 'Go', 'Python', 'Rust'].map((lang) => (
                        <label key={lang} className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={criteria.languages.includes(lang.toLowerCase())}
                                onChange={() => handleLanguageToggle(lang.toLowerCase())}
                                className="rounded border-slate-600 text-cyan-500"
                            />
                            <span className="text-slate-300">{lang}</span>
                        </label>
                    ))}
                </div>

                <div className="mt-4">
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                        Or specify custom languages (comma-separated)
                    </label>
                    <input
                        type="text"
                        value={criteria.languages.join(', ')}
                        onChange={(e) => setCriteria({
                            ...criteria,
                            languages: e.target.value.split(',').map(l => l.trim().toLowerCase()).filter(l => l)
                        })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:border-cyan-500 outline-none"
                        placeholder="e.g., dart, flutter, rust"
                    />
                </div>
            </Section>

            {/* Scoring Threshold */}
            <Section
                title="Scoring & Filtering"
                section="scoring"
                expanded={expandedSections.scoring}
                onToggle={toggleSection}
            >
                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-3">
                        Score Threshold: {criteria.score_threshold}/100
                    </label>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={criteria.score_threshold}
                        onChange={(e) => setCriteria({ ...criteria, score_threshold: parseInt(e.target.value) })}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-slate-500 mt-2">
                        <span>Below Average (0-40)</span>
                        <span>Good (50-70)</span>
                        <span>Excellent (80+)</span>
                    </div>

                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 mt-4">
                        <p className="text-sm text-slate-400">
                            <span className="font-semibold">Current setting: </span>
                            Only show developers with a GitHub score of <span className="text-cyan-400">{criteria.score_threshold}</span> or higher.
                        </p>
                    </div>
                </div>
            </Section>

            {/* Action Buttons */}
            <div className="flex gap-4 mt-8">
                <button
                    onClick={() => setCriteria(DEFAULT_CRITERIA)}
                    className="flex-1 px-6 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-white font-medium transition"
                >
                    Reset to Default
                </button>
                <button
                    onClick={() => onSave(criteria)}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg text-white font-medium transition"
                >
                    Save Criteria
                </button>
            </div>

            {/* Summary */}
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-slate-300 mb-2">Current Configuration Summary</h4>
                <ul className="text-xs text-slate-400 space-y-1">
                    <li>✓ Languages: {criteria.languages.join(', ')}</li>
                    <li>✓ Score Threshold: {criteria.score_threshold}/100</li>
                    <li>✓ Min Stars: {criteria.min_stars} | Max: {criteria.max_stars}</li>
                    <li>✓ Originality: ≥{criteria.min_originality_ratio}%</li>
                    <li>✓ App Store Required: {criteria.require_app_store_link ? 'Yes ⭐' : 'No'}</li>
                    <li>✓ Generic repos excluded: {criteria.exclude_generic_repos ? 'Yes' : 'No'}</li>
                </ul>
            </div>
        </div>
    );
};

interface SectionProps {
    title: string;
    section: string;
    expanded: boolean;
    onToggle: (section: string) => void;
    children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, section, expanded, onToggle, children }) => (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <button
            onClick={() => onToggle(section)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-900/70 transition"
        >
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            {expanded ? (
                <ChevronUp className="h-5 w-5 text-cyan-400" />
            ) : (
                <ChevronDown className="h-5 w-5 text-slate-500" />
            )}
        </button>
        {expanded && (
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/30">
                {children}
            </div>
        )}
    </div>
);
