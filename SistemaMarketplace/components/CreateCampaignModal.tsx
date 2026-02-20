import React, { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { Campaign } from '../types/campaigns';
import { FreelancePlatform } from '../types/marketplace';

interface CreateCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (campaign: Campaign) => void;
}

export const CreateCampaignModal: React.FC<CreateCampaignModalProps> = ({ isOpen, onClose, onCreate }) => {
  if (!isOpen) return null;
  const [platform, setPlatform] = useState<FreelancePlatform>('Upwork');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [currentKeyword, setCurrentKeyword] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    minHourlyRate: 40,
    maxHourlyRate: 200,
    minJobSuccessRate: 85,
    certifications: [] as string[],
    countries: [] as string[],
    languages: [] as string[],
    upworkCategory: 'Web Development',
    fiverrlevel: 'top-rated-plus' as const,
  });

  const handleAddKeyword = () => {
    if (currentKeyword.trim() && !keywords.includes(currentKeyword.trim())) {
      setKeywords([...keywords, currentKeyword.trim()]);
      setCurrentKeyword('');
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setKeywords(keywords.filter(k => k !== keyword));
  };

  const handleCreateCampaign = () => {
    if (!formData.name.trim() || keywords.length === 0) {
      alert('Rellena nombre y añade al menos un keyword');
      return;
    }

    const newCampaign: Campaign = {
      id: crypto.randomUUID(),
      name: formData.name,
      platform,
      createdAt: new Date().toISOString(),
      searchTerms: {
        keyword: keywords.join(', '),
        keywords: keywords,
        minHourlyRate: formData.minHourlyRate,
        maxHourlyRate: formData.maxHourlyRate,
        minJobSuccessRate: formData.minJobSuccessRate,
        certifications: formData.certifications,
        countries: formData.countries,
        languages: formData.languages,
        upworkCategory: platform === 'Upwork' ? formData.upworkCategory : undefined,
        fiverrlevel: platform === 'Fiverr' ? formData.fiverrlevel : undefined,
      },
      candidates: [],
      stats: {
        total: 0,
        inTodo: 0,
        inContacted: 0,
        inReplied: 0,
        inRejected: 0,
        inHired: 0,
        contactRate: 0,
        responseRate: 0,
      },
      status: 'active',
    };

    onCreate(newCampaign);
    // Reset form
    setFormData({
      name: '',
      minHourlyRate: 40,
      maxHourlyRate: 200,
      minJobSuccessRate: 85,
      certifications: [],
      countries: [],
      languages: [],
      upworkCategory: 'Web Development',
      fiverrlevel: 'top-rated-plus',
    });
    setKeywords([]);
    setCurrentKeyword('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-slate-900 to-slate-800 border-b border-slate-700 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Nueva Campaña</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Campaign Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Nombre de Campaña *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="ej: Flutter Senior Squad Q1"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white"
            />
          </div>

          {/* Platform Selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Plataforma *
            </label>
            <div className="flex gap-3">
              {(['Upwork', 'Fiverr', 'LinkedIn'] as FreelancePlatform[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={`flex-1 py-3 rounded-lg font-medium transition-all ${platform === p
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Keywords/Skills */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Keywords/Skills * (Añade múltiples)
            </label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={currentKeyword}
                onChange={(e) => setCurrentKeyword(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddKeyword();
                  }
                }}
                placeholder="ej: Flutter, React, Node.js..."
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleAddKeyword}
                className="px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Añadir
              </button>
            </div>

            {/* Keywords List */}
            <div className="flex flex-wrap gap-2">
              {keywords.map(keyword => (
                <div
                  key={keyword}
                  className="flex items-center gap-2 px-3 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-lg"
                >
                  <span className="text-emerald-300 text-sm font-medium">{keyword}</span>
                  <button
                    onClick={() => handleRemoveKeyword(keyword)}
                    className="text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            {keywords.length === 0 && (
              <p className="text-slate-500 text-sm mt-2">Sin words aún. Añade al menos una.</p>
            )}
          </div>

          {/* Hourly Rate Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Tarifa Mínima: ${formData.minHourlyRate}
              </label>
              <input
                type="range"
                min="20"
                max="200"
                value={formData.minHourlyRate}
                onChange={(e) => setFormData({ ...formData, minHourlyRate: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-300 mb-2">
                Tarifa Máxima: ${formData.maxHourlyRate}
              </label>
              <input
                type="range"
                min="40"
                max="500"
                value={formData.maxHourlyRate}
                onChange={(e) => setFormData({ ...formData, maxHourlyRate: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>

          {/* Job Success Rate */}
          <div>
            <label className="block text-sm font-semibold text-slate-300 mb-2">
              Job Success Rate Mínimo: {formData.minJobSuccessRate}%
            </label>
            <input
              type="range"
              min="50"
              max="100"
              value={formData.minJobSuccessRate}
              onChange={(e) => setFormData({ ...formData, minJobSuccessRate: parseInt(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Upwork Specific */}
          {platform === 'Upwork' && (
            <div className="space-y-4 p-4 bg-slate-800/30 border border-slate-700 rounded-lg">
              <h3 className="font-semibold text-slate-200">Configuración Upwork</h3>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Categoría Upwork
                </label>
                <select
                  value={formData.upworkCategory}
                  onChange={(e) => setFormData({ ...formData, upworkCategory: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white"
                >
                  <option>Web Development</option>
                  <option>Mobile App Development</option>
                  <option>Desktop Software Development</option>
                  <option>Other - Software Development</option>
                  <option>DevOps & Cloud Development</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Certificaciones Upwork
                </label>
                <div className="space-y-2">
                  {['Top Rated', 'Top Rated Plus', 'Rising Talent'].map(cert => (
                    <label key={cert} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.certifications.includes(cert)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              certifications: [...formData.certifications, cert],
                            });
                          } else {
                            setFormData({
                              ...formData,
                              certifications: formData.certifications.filter(c => c !== cert),
                            });
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-slate-300">{cert}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Fiverr Specific */}
          {platform === 'Fiverr' && (
            <div className="space-y-4 p-4 bg-slate-800/30 border border-slate-700 rounded-lg">
              <h3 className="font-semibold text-slate-200">Configuración Fiverr</h3>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Nivel Mínimo
                </label>
                <select
                  value={formData.fiverrlevel}
                  onChange={(e) => setFormData({ ...formData, fiverrlevel: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white"
                >
                  <option value="basic">Basic</option>
                  <option value="pro">Pro</option>
                  <option value="top-rated">Top Rated</option>
                  <option value="top-rated-plus">Top Rated Plus</option>
                </select>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleCreateCampaign}
              className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-lg hover:from-emerald-500 hover:to-teal-500"
            >
              Crear Campaña
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
