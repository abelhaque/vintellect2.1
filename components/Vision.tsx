
import React, { useState } from 'react';
import { analyzeImage } from '../services/geminiService';

const Vision: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('Explain what is in this image in detail.');
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!image || loading) return;
    setLoading(true);
    setResult(null);

    try {
      const base64Data = image.split(',')[1];
      const mimeType = image.split(',')[0].split(':')[1].split(';')[0];
      const analysis = await analyzeImage(prompt, base64Data, mimeType);
      setResult(analysis);
    } catch (err) {
      console.error(err);
      setResult("Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 h-full flex flex-col">
      <h2 className="text-3xl font-bold mb-2">Visual Intelligence</h2>
      <p className="text-slate-400 mb-8">Upload an image and let Vintellect analyze it with precision.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
        <div className="space-y-6">
          <div 
            className={`relative border-2 border-dashed rounded-3xl h-64 flex flex-col items-center justify-center transition-all overflow-hidden ${
              image ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-700 bg-slate-800/20 hover:border-slate-600'
            }`}
          >
            {image ? (
              <>
                <img src={image} alt="Upload" className="w-full h-full object-contain" />
                <button 
                  onClick={() => setImage(null)}
                  className="absolute top-2 right-2 p-2 bg-red-500/80 rounded-full text-white hover:bg-red-500"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </>
            ) : (
              <label className="cursor-pointer text-center p-4">
                <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                <svg className="w-12 h-12 text-slate-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h14a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-slate-400">Click to upload or drag & drop</p>
                <p className="text-xs text-slate-600 mt-2">PNG, JPG up to 10MB</p>
              </label>
            )}
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-semibold text-slate-300 uppercase tracking-wider">Analysis Directive</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full glass rounded-2xl p-4 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-32"
              placeholder="What would you like to know about this image?"
            />
            <button
              onClick={handleAnalyze}
              disabled={!image || loading}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold tracking-wide transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : 'Run Analysis'}
            </button>
          </div>
        </div>

        <div className="glass rounded-3xl p-6 overflow-y-auto max-h-[600px]">
          <h3 className="text-lg font-bold mb-4 border-b border-slate-700 pb-2 text-indigo-400">Analysis Result</h3>
          {result ? (
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">{result}</p>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center px-4">
              <svg className="w-16 h-16 mb-2 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>Upload an image and run analysis to see insights here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Vision;
