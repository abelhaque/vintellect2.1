
import React, { useState } from 'react';
import { generateImage } from '../services/geminiService';

const Creator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    try {
      const result = await generateImage(prompt);
      if (result) {
        setGeneratedImage(result);
      }
    } catch (err) {
      console.error(err);
      alert("Image generation failed. Try a different prompt.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col h-full">
      <div className="mb-8">
        <h2 className="text-3xl font-bold mb-2">Creative Hub</h2>
        <p className="text-slate-400">Describe your vision and watch Vintellect manifest it.</p>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-8">
        <div className="lg:w-1/3 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-400 uppercase tracking-widest">Image Description</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full glass rounded-2xl p-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-48 border border-slate-700/50"
              placeholder="e.g., A futuristic cyberpunk cityscape with neon lights, raining, cinematic lighting, 8k resolution..."
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || loading}
            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-2xl font-bold transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-50"
          >
            {loading ? 'Manifesting...' : 'Generate Art'}
          </button>

          <div className="p-4 glass rounded-2xl">
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Generation Tips</h4>
            <ul className="text-xs text-slate-400 space-y-2 list-disc pl-4">
              <li>Be descriptive about lighting and mood</li>
              <li>Mention artistic styles (e.g., oil painting, 3D render)</li>
              <li>Specify the background details</li>
            </ul>
          </div>
        </div>

        <div className="lg:w-2/3">
          <div className="glass rounded-3xl aspect-square w-full flex items-center justify-center overflow-hidden relative group border border-slate-700/50 shadow-2xl">
            {generatedImage ? (
              <>
                <img src={generatedImage} alt="Generated" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <a 
                  href={generatedImage} 
                  download="vintellect-art.png" 
                  className="absolute bottom-4 right-4 p-3 bg-black/60 hover:bg-black/80 rounded-full text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </a>
              </>
            ) : (
              <div className="text-center px-12">
                {loading ? (
                  <div className="flex flex-col items-center">
                    <div className="relative w-24 h-24 mb-6">
                      <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-t-indigo-500 rounded-full animate-spin"></div>
                    </div>
                    <p className="text-lg font-medium text-indigo-400 animate-pulse">Consulting the creative matrix...</p>
                  </div>
                ) : (
                  <>
                    <div className="w-20 h-20 bg-slate-800/50 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-slate-700">
                      <svg className="w-10 h-10 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h14a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-slate-500">Your masterpiece will appear here</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Creator;
