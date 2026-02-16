import React, { useMemo } from 'react';
import { Message, Wine } from '../types';
import { Wine as WineIcon, User, ExternalLink, Heart, AlertCircle, RotateCcw, Sparkles } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  onBookmark?: (wine: Wine) => void;
  onRetry?: (prompt: string, image?: string) => void;
  onHaptic?: (pattern: number | number[]) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onBookmark, onRetry, onHaptic }) => {
  const isAssistant = message.role === 'assistant';

  const extractWines = (text: string) => {
    const scanned: Wine[] = [];
    const recommended: Wine[] = [];

    // Helper to strip all possible bolding artifacts for clean UI rendering
    const cleanArtifacts = (s: string) => 
      s.replace(/\[\/?B\]/gi, '')
       .replace(/\*\*/g, '')
       .replace(/\{B\}/gi, '')
       .trim();

    // 1. Ghost Parser for SCANNED_WINE tag: ::SCANNED_WINE::[Name]::[Price]::
    const scannedRegex = /::SCANNED_WINE::(.*?)::(.*?)::/g;
    let scannedMatch;
    while ((scannedMatch = scannedRegex.exec(text)) !== null) {
      const priceStr = cleanArtifacts(scannedMatch[2]).replace(/[^0-9.]/g, '');
      scanned.push({
        name: cleanArtifacts(scannedMatch[1]),
        price: parseFloat(priceStr) || 0,
        retailer: 'Identified from Label',
        vintage: 'NV',
        type: 'Scanned Gem',
        rating: 4.5,
        tags: 'Captured via Vision'
      });
    }

    // 2. Standard Recommendation Regex: [B]Wine Name[/B] (£Price, Retailer)
    const standardRegex = /(?:\[B\]|\*\*)(.*?)(?:\[\/B\]|\*\*)\s*\(£(\d+(?:\.\d+)?),\s*([^)]+)\)/g;
    let match;
    while ((match = standardRegex.exec(text)) !== null) {
      recommended.push({
        name: cleanArtifacts(match[1]),
        price: parseFloat(match[2]),
        retailer: cleanArtifacts(match[3]),
        vintage: 'NV',
        type: 'Recommended',
        rating: 4.0,
        tags: 'Vintellect Select'
      });
    }

    // 3. Fallback for image analysis without explicit tags (older responses or subtle AI deviations)
    if (scanned.length === 0 && recommended.length === 0 && (text.includes("Analysis of uploaded image") || text.includes("Identify the wine"))) {
      const boldRegex = /(?:\[B\]|\*\*)(.*?)(?:\[\/B\]|\*\*)/g;
      const boldMatches = Array.from(text.matchAll(boldRegex)).map(m => cleanArtifacts(m[1]));
      
      if (boldMatches.length > 0) {
        const name = boldMatches[0];
        const priceMatch = text.match(/£(\d+(?:\.\d+)?)/);
        const price = priceMatch ? parseFloat(priceMatch[1]) : 0;
        
        if (name.length > 3 && !name.toLowerCase().includes("analysis")) {
          scanned.push({
            name: name,
            price: price,
            retailer: 'Market Analysis',
            vintage: 'NV',
            type: 'Vision Scan',
            rating: 4.0,
            tags: 'Label Analysis'
          });
        }
      }
    }

    return { scanned, recommended };
  };

  const { scanned, recommended } = useMemo(() => 
    isAssistant && !message.isError ? extractWines(message.content) : { scanned: [], recommended: [] }
  , [isAssistant, message.content, message.isError]);

  const renderContent = (text: string) => {
    if (!isAssistant) return text;
    if (message.isError) return text;

    // STRIP SCANNED_WINE TAGS FROM VISIBLE TEXT
    let processed = text
      .replace(/::SCANNED_WINE::(.*?)::(.*?)::/g, '')
      .replace(/\[H\](.*?)\[\/H\]/g, '# $1')
      .replace(/\[B\](.*?)\[\/B\]/g, '**$1**');

    try {
      // @ts-ignore - marked is loaded via CDN in index.html
      const html = window.marked.parse(processed);
      return html.replace(/<table/g, '<div class="table-container"><table').replace(/<\/table>/g, '</table></div>');
    } catch (e) {
      return processed.replace(/\n/g, '<br/>');
    }
  };

  const handleBookmark = (wine: Wine) => {
    onHaptic?.(10); 
    onBookmark?.(wine);
  };

  if (message.isError) {
    return (
      <div className="flex w-full justify-start animate-fade-in-up">
        <div className="flex max-w-[95%] md:max-w-[85%] gap-3 items-start">
          <div className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center shadow-md bg-red-100 text-red-600">
            <AlertCircle size={20} />
          </div>
          <div className="flex flex-col gap-2">
            <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-3 rounded-lg shadow-sm flex flex-col md:flex-row md:items-center gap-3">
              <span className="text-sm font-medium">{message.content}</span>
              {message.retryData && onRetry && (
                <button 
                  onClick={() => onRetry(message.retryData!.prompt, message.retryData!.image)}
                  className="flex items-center justify-center gap-2 px-3 py-1 bg-red-600 text-white rounded-full text-xs font-bold hover:bg-red-700 transition-all active:scale-95 shadow-sm"
                >
                  <RotateCcw size={12} /> Retry
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const contentToDisplay = !isAssistant && message.displayContent ? message.displayContent : message.content;

  return (
    <div className={`flex w-full ${isAssistant ? 'justify-start' : 'justify-end'} animate-fade-in-up`}>
      <div className={`flex max-w-[95%] md:max-w-[85%] gap-3 ${isAssistant ? 'flex-row' : 'flex-row-reverse'}`}>
        <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center shadow-md ${isAssistant ? 'bg-[#800020] text-[#F7E1A1]' : 'bg-slate-800 text-white'}`}>
          {isAssistant ? <WineIcon size={20} /> : <User size={20} />}
        </div>
        
        <div className="flex flex-col gap-2 w-full min-w-0">
          {message.imageUrl && (
            <div className={`rounded-lg overflow-hidden border border-slate-200 shadow-sm mb-1 ${!isAssistant ? 'ml-auto' : ''}`}>
               <img src={message.imageUrl} alt="Wine label scan" className="max-w-[200px] h-auto object-cover" />
            </div>
          )}
          
          <div className={`wine-card paper-texture p-6 relative overflow-visible ${isAssistant ? '' : 'bg-slate-800 !text-white !border-slate-700'}`}>
            
            {/* RENDER SCANNED WINE AT THE TOP OF THE BUBBLE */}
            {isAssistant && scanned.length > 0 && (
              <div className="mb-6 flex flex-col gap-3 overflow-visible">
                {scanned.map((wine, idx) => (
                  <div 
                    key={`scanned-${idx}`} 
                    className="flex items-center justify-between gap-3 bg-[#D4AF37]/10 p-3 rounded-2xl border-2 border-[#D4AF37]/40 relative z-10 overflow-visible shadow-lg animate-in zoom-in-95 duration-300"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="bg-[#D4AF37] p-2.5 rounded-xl flex-shrink-0 shadow-md">
                         <Sparkles size={18} className="text-[#800020]" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] font-black text-[#800020] uppercase tracking-tighter opacity-60">Scanned Gem Found</span>
                        <span className="text-xs font-black text-[#800020] truncate leading-tight tracking-tight uppercase">{wine.name}</span>
                        <span className="text-[10px] text-[#800020] font-bold tracking-wide">{wine.price > 0 ? `Est. £${wine.price}` : 'Price Unknown'}</span>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleBookmark(wine); }}
                      className="flex-shrink-0 h-11 w-11 bg-[#800020] text-[#D4AF37] rounded-full flex items-center justify-center hover:bg-[#a00028] transition-all shadow-xl active:scale-90 relative z-20 border-2 border-[#D4AF37]"
                      aria-label={`Bookmark Scanned ${wine.name}`}
                    >
                      <Heart size={20} fill="currentColor" />
                    </button>
                  </div>
                ))}
                <div className="h-px bg-[#800020]/10 w-full mb-2"></div>
              </div>
            )}

            <div 
              className={`prose-wine text-sm md:text-base font-medium break-words overflow-hidden leading-relaxed`} 
              dangerouslySetInnerHTML={{ __html: isAssistant ? renderContent(contentToDisplay) : contentToDisplay }} 
            />
            
            {/* RENDER RECOMMENDED ALTERNATIVES AT THE BOTTOM */}
            {isAssistant && recommended.length > 0 && (
              <div className="mt-6 pt-4 border-t border-[#800020]/10 flex flex-col gap-3 overflow-visible">
                <p className="text-[10px] font-bold text-[#800020] uppercase tracking-widest opacity-60">Vintellect Recommendations</p>
                {recommended.map((wine, idx) => (
                  <div 
                    key={`rec-${idx}`} 
                    className="flex items-center justify-between gap-3 bg-[#800020]/5 p-3 rounded-2xl border border-[#800020]/10 relative z-10 overflow-visible shadow-sm hover:border-[#D4AF37]/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="bg-[#800020] p-2.5 rounded-xl flex-shrink-0 shadow-md">
                         <WineIcon size={18} className="text-[#F7E1A1]" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-extrabold text-[#800020] truncate leading-tight tracking-tight uppercase">{wine.name}</span>
                        <span className="text-[10px] text-slate-500 font-bold tracking-wide mt-0.5">{wine.price > 0 ? `£${wine.price}` : 'Price Unknown'} • {wine.retailer}</span>
                      </div>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleBookmark(wine); }}
                      className="flex-shrink-0 h-10 w-10 bg-[#800020] text-[#F7E1A1] rounded-full flex items-center justify-center hover:bg-[#a00028] transition-all shadow-xl active:scale-90 relative z-20 border-2 border-white"
                      aria-label={`Bookmark ${wine.name}`}
                    >
                      <Heart size={18} fill="currentColor" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {isAssistant && message.sources && message.sources.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[#800020]/5 flex flex-wrap gap-2 overflow-hidden">
                {message.sources.map((source, idx) => (
                  <a key={idx} href={source.uri} target="_blank" className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-white/50 border border-slate-200 text-[10px] text-slate-600 truncate max-w-[150px] hover:text-[#800020] transition-colors">
                    {source.title} <ExternalLink size={10} />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;