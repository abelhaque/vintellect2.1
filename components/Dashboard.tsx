
import React from 'react';
import { AppView } from '../types';

interface DashboardProps {
  setView: (view: AppView) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ setView }) => {
  const stats = [
    { label: 'Neural Accuracy', value: '99.8%' },
    { label: 'Response Latency', value: '0.4s' },
    { label: 'Uptime', value: '100%' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <header className="mb-12">
        <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-white via-indigo-200 to-indigo-600 bg-clip-text text-transparent">
          Welcome to Vintellect 2.0
        </h1>
        <p className="text-xl text-slate-400 font-light max-w-2xl">
          The next generation of synthetic intelligence. Process complex data, analyze visuals, and manifest creativity.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {stats.map((stat, i) => (
          <div key={i} className="glass p-6 rounded-3xl border border-white/5 hover:border-indigo-500/30 transition-all group">
            <p className="text-xs font-bold text-slate-500 uppercase mb-1">{stat.label}</p>
            <p className="text-3xl font-bold text-slate-100 group-hover:text-indigo-400 transition-colors">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div 
          onClick={() => setView(AppView.CHATS)}
          className="group cursor-pointer glass p-8 rounded-[2.5rem] relative overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <div className="absolute -right-12 -top-12 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl group-hover:bg-indigo-600/20 transition-all"></div>
          <div className="relative z-10">
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-indigo-600/30">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold mb-2">Intellect Hub</h3>
            <p className="text-slate-400 mb-6">High-speed reasoning with real-time web grounding for ultra-accurate responses.</p>
            <span className="flex items-center gap-2 text-indigo-400 font-semibold group-hover:gap-4 transition-all">
              Initialize Connection <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8">
          <div 
            onClick={() => setView(AppView.VISION)}
            className="group cursor-pointer glass p-8 rounded-[2rem] flex items-center justify-between transition-all hover:bg-slate-800/50"
          >
            <div className="flex gap-6 items-center">
              <div className="w-12 h-12 rounded-xl bg-slate-700 flex items-center justify-center text-indigo-400 border border-slate-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <div>
                <h4 className="text-xl font-bold">Vision Processor</h4>
                <p className="text-sm text-slate-500">Analyze multi-modal assets instantly.</p>
              </div>
            </div>
            <svg className="w-6 h-6 text-slate-600 group-hover:text-white transform group-hover:translate-x-2 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </div>

          <div 
            onClick={() => setView(AppView.CREATOR)}
            className="group cursor-pointer glass p-8 rounded-[2rem] flex items-center justify-between transition-all hover:bg-slate-800/50"
          >
            <div className="flex gap-6 items-center">
              <div className="w-12 h-12 rounded-xl bg-slate-700 flex items-center justify-center text-purple-400 border border-slate-600 group-hover:bg-purple-600 group-hover:text-white transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h14a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h4 className="text-xl font-bold">Art Creator</h4>
                <p className="text-sm text-slate-500">Manifest visuals from text descriptions.</p>
              </div>
            </div>
            <svg className="w-6 h-6 text-slate-600 group-hover:text-white transform group-hover:translate-x-2 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
