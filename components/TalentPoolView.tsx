
import React, { useState } from 'react';
import { Search, Plus, Upload, Filter, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import { calculateSymmetryScore } from '../lib/openai';
import { CandidateService } from '../lib/services';
import KanbanBoard from './KanbanBoard';
import Toast from './Toast';

const TalentPoolView: React.FC = () => {
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban');
  const [showAddModal, setShowAddModal] = useState(false);
  const [scraperInput, setScraperInput] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{ score: number, analysis: string } | null>(null);
  const [toast, setToast] = useState({ show: false, message: '' });

  const handleAnalyze = async () => {
    if (!scraperInput.trim()) return;
    setAnalyzing(true);
    setAnalysisResult(null);

    try {
      // 1. Analyze with OpenAI
      const result = await calculateSymmetryScore(scraperInput);
      setAnalysisResult(result);
    } catch (e) {
      console.error(e);
      setToast({ show: true, message: 'Error analyzing profile.' });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveCandidate = async () => {
    if (!analysisResult) return;

    try {
      // Mock parsing name from text for now, in reality OpenAI would extract this
      const nameMatch = scraperInput.match(/([A-Z][a-z]+ [A-Z][a-z]+)/);
      const name = nameMatch ? nameMatch[0] : 'Unknown Candidate';

      await CandidateService.create({
        full_name: name,
        symmetry_score: analysisResult.score,
        ai_analysis: analysisResult.analysis,
        // In a real app, we'd parse email, role, etc.
        job_title: 'Detected from Profile',
        skills: ['Flutter', 'Dart'] // Mock
      });

      setToast({ show: true, message: 'Candidate saved to pool!' });
      setShowAddModal(false);
      setScraperInput('');
      setAnalysisResult(null);
      // Refresh list would go here
    } catch (e) {
      console.error(e);
      setToast({ show: true, message: 'Error saving candidate.' });
    }
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Talent Pool</h1>
          <p className="text-slate-400">Gestiona y analiza tus candidatos "A-Player".</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setViewMode('kanban')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'kanban' ? 'bg-cyan-950 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-white'}`}
          >
            Kanban
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'list' ? 'bg-cyan-950 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-white'}`}
          >
            Lista
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-medium shadow-lg shadow-cyan-900/20 transition-all"
          >
            <Plus className="h-4 w-4" /> Add Candidate
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 bg-slate-900/30 border border-slate-800/50 rounded-2xl overflow-hidden relative">
        {viewMode === 'kanban' ? (
          <KanbanBoard candidates={[]} onStatusChange={() => { }} />
        ) : (
          <div className="p-10 text-center text-slate-500">List View Coming Soon</div>
        )}
      </div>

      {/* Add Candidate Modal (Scraper Input) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-cyan-400" />
                Symmetry Analysis
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-500 hover:text-white">
                <Plus className="h-6 w-6 rotate-45" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="col-span-1 md:col-span-2 space-y-2">
                <label className="text-sm font-medium text-slate-300">Paste Profile Text / LinkedIn Data</label>
                <textarea
                  value={scraperInput}
                  onChange={(e) => setScraperInput(e.target.value)}
                  className="w-full h-40 bg-slate-950 border border-slate-700 rounded-xl p-4 text-slate-300 focus:outline-none focus:border-cyan-500 transition-colors resize-none font-mono text-sm"
                  placeholder="Paste raw text from LinkedIn profile here..."
                ></textarea>
                <p className="text-xs text-slate-500">Our AI will extract the name, role, and calculate the fit score.</p>
              </div>

              {analysisResult && (
                <div className="col-span-1 md:col-span-2 bg-slate-950/50 rounded-xl p-4 border border-cyan-900/50 animate-in fade-in slide-in-from-top-2">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm text-slate-400">Symmetry Score</span>
                    <span className={`text-2xl font-bold ${analysisResult.score >= 80 ? 'text-emerald-400' : analysisResult.score >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {analysisResult.score}/100
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full mb-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${analysisResult.score >= 80 ? 'bg-emerald-500' : analysisResult.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${analysisResult.score}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-slate-300 bg-slate-900 p-3 rounded-lg border border-slate-800">
                    {analysisResult.analysis}
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-slate-400 hover:text-white font-medium"
              >
                Cancel
              </button>
              {!analysisResult ? (
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing || !scraperInput}
                  className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold shadow-lg shadow-cyan-900/20 transition-all flex items-center gap-2"
                >
                  {analyzing ? <span className="animate-spin">⏳</span> : <Sparkles className="h-4 w-4" />}
                  Analyze Profile
                </button>
              ) : (
                <button
                  onClick={handleSaveCandidate}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow-lg shadow-emerald-900/20 transition-all flex items-center gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Save to Pool
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <Toast isVisible={toast.show} message={toast.message} onClose={() => setToast({ ...toast, show: false })} />
    </div>
  );
};

export default TalentPoolView;