
import React, { useState, useEffect } from 'react';
import { Clock, Check, Power, Calendar } from 'lucide-react';

interface SchedulerProps {
    onScheduleChange: (enabled: boolean, time: string, leads: number) => void;
    initialEnabled?: boolean;
    initialTime?: string; // "09:00"
    initialLeads?: number;
}

const Scheduler: React.FC<SchedulerProps> = ({
    onScheduleChange,
    initialEnabled = false,
    initialTime = "09:00",
    initialLeads = 10
}) => {
    const [enabled, setEnabled] = useState(initialEnabled);
    const [time, setTime] = useState(initialTime);
    const [leads, setLeads] = useState(initialLeads);
    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => {
        // Debounce update to parent
        const timer = setTimeout(() => {
            onScheduleChange(enabled, time, leads);
        }, 500);
        return () => clearTimeout(timer);
    }, [enabled, time, leads]);

    return (
        <div
            className={`
                relative overflow-hidden rounded-2xl p-6 transition-all duration-500 border
                ${enabled
                    ? 'bg-gradient-to-br from-indigo-900/40 to-cyan-900/40 border-cyan-500/50 shadow-[0_0_30px_rgba(6,182,212,0.15)]'
                    : 'bg-slate-900/40 border-slate-800'
                }
            `}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Background Effects */}
            {enabled && (
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.1),transparent_70%)] animate-pulse-slow"></div>
                </div>
            )}

            <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl transition-colors ${enabled ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30' : 'bg-slate-800 text-slate-400'}`}>
                            <Clock className={`h-6 w-6 ${enabled ? 'animate-pulse' : ''}`} />
                        </div>
                        <div>
                            <h3 className={`text-lg font-bold ${enabled ? 'text-white' : 'text-slate-400'}`}>Auto-Pilot</h3>
                            <p className="text-xs text-slate-500">Daily Candidate Sourcing</p>
                        </div>
                    </div>

                    <button
                        onClick={() => setEnabled(!enabled)}
                        className={`
                            relative w-14 h-8 rounded-full transition-colors duration-300 focus:outline-none ring-2 ring-offset-2 ring-offset-slate-950
                            ${enabled ? 'bg-cyan-500 ring-cyan-500/50' : 'bg-slate-700 ring-transparent'}
                        `}
                    >
                        <div className={`
                            absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow transition-transform duration-300 flex items-center justify-center
                            ${enabled ? 'translate-x-6' : 'translate-x-0'}
                        `}>
                            {enabled ? <Check className="h-3 w-3 text-cyan-600" /> : <Power className="h-3 w-3 text-slate-400" />}
                        </div>
                    </button>
                </div>

                <div className={`space-y-4 transition-all duration-300 ${enabled ? 'opacity-100' : 'opacity-50 grayscale'}`}>
                    {/* Time Picker */}
                    <div className="bg-slate-950/50 rounded-xl p-3 border border-slate-800 flex items-center justify-between group-hover:border-slate-700 transition-colors">
                        <div className="flex items-center gap-2 text-slate-400">
                            <Clock className="h-4 w-4" />
                            <span className="text-sm font-medium">Run Daily At</span>
                        </div>
                        <input
                            type="time"
                            value={time}
                            onChange={(e) => setTime(e.target.value)}
                            disabled={!enabled}
                            className="bg-transparent text-white font-mono text-lg focus:outline-none text-right w-32 cursor-pointer"
                        />
                    </div>

                    {/* Leads Slider */}
                    <div className="bg-slate-950/50 rounded-xl p-3 border border-slate-800 group-hover:border-slate-700 transition-colors">
                        <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2 text-slate-400">
                                <Calendar className="h-4 w-4" />
                                <span className="text-sm font-medium">Daily Candidates</span>
                            </div>
                            <span className="text-cyan-400 font-bold font-mono text-lg">{leads}</span>
                        </div>
                        <input
                            type="range"
                            min="1"
                            max="50"
                            value={leads}
                            onChange={(e) => setLeads(parseInt(e.target.value))}
                            disabled={!enabled}
                            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-400 transition-all"
                        />
                        <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                            <span>1</span>
                            <span>25</span>
                            <span>50</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Scheduler;
