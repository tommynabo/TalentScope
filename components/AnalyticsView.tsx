
import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Calendar } from 'lucide-react';

const mockData30 = Array.from({ length: 30 }, (_, i) => ({
  name: `Day ${i + 1}`,
  leads: Math.floor(Math.random() * 50) + 10,
  replies: Math.floor(Math.random() * 20) + 5,
}));

const mockData7 = mockData30.slice(-7);

const AnalyticsView: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d'>('7d');
  const [data, setData] = useState(mockData7);

  useEffect(() => {
    setData(timeRange === '7d' ? mockData7 : mockData30);
  }, [timeRange]);

  return (
    <div className="p-6 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Analytics & Performance</h1>
          <p className="text-slate-400">Deep dive into your outreach metrics.</p>
        </div>

        {/* Time Range Selector */}
        <div className="bg-slate-900 p-1 rounded-lg border border-slate-800 flex">
          <button
            onClick={() => setTimeRange('7d')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${timeRange === '7d' ? 'bg-cyan-900/50 text-cyan-400 shadow-sm' : 'text-slate-400 hover:text-white'}`}
          >
            Last 7 Days
          </button>
          <button
            onClick={() => setTimeRange('30d')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${timeRange === '30d' ? 'bg-cyan-900/50 text-cyan-400 shadow-sm' : 'text-slate-400 hover:text-white'}`}
          >
            Last 30 Days
          </button>
        </div>
      </div>

      {/* Main Chart */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 h-[400px]">
        <div className="flex items-center gap-2 mb-6">
          <Calendar className="h-5 w-5 text-cyan-400" />
          <h3 className="text-lg font-semibold text-white">Growth Trend</h3>
        </div>

        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorReplies" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#64748b' }} />
            <YAxis stroke="#64748b" tick={{ fill: '#64748b' }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
              itemStyle={{ color: '#f8fafc' }}
            />
            <Area type="monotone" dataKey="leads" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#colorLeads)" />
            <Area type="monotone" dataKey="replies" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorReplies)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
          <p className="text-slate-400 text-sm mb-1">Conversion Rate</p>
          <p className="text-3xl font-bold text-white">4.2%</p>
          <p className="text-emerald-400 text-xs mt-2">+0.8% from last month</p>
        </div>
        <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
          <p className="text-slate-400 text-sm mb-1">Avg. Response Time</p>
          <p className="text-3xl font-bold text-white">12h</p>
          <p className="text-emerald-400 text-xs mt-2">-2h from last month</p>
        </div>
        <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
          <p className="text-slate-400 text-sm mb-1">Active Campaigns</p>
          <p className="text-3xl font-bold text-white">3</p>
          <p className="text-slate-500 text-xs mt-2">All systems operational</p>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsView;