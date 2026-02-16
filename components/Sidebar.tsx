import React, { useState, useEffect } from 'react';
import { PRICE_TIERS, SUPERMARKETS, WINE_TYPES } from '../constants';
import { Wine as WineIcon, Info, ShoppingBag, X, Store, Filter, Bookmark, Trash2, SlidersHorizontal, ChevronDown, ChevronUp, Award, Star, Database, FileText, Upload } from 'lucide-react';
import { Wine } from '../types';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeSupermarkets: string[];
  toggleSupermarket: (name: string) => void;
  activeWineTypes: string[];
  toggleWineType: (type: string) => void;
  activePriceTier: string | null;
  togglePriceTier: (label: string) => void;
  cellar: Wine[];
  removeFromCellar: (name: string) => void;
  onWineClick: (wine: Wine) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, onClose, activeSupermarkets, toggleSupermarket,
  activeWineTypes, toggleWineType, activePriceTier, togglePriceTier,
  cellar, removeFromCellar, onWineClick
}) => {
  const [isCellarExpanded, setIsCellarExpanded] = useState(true);
  const [kbName, setKbName] = useState<string | null>(localStorage.getItem('vintellect_kb_filename'));

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      localStorage.setItem('vintellect_custom_kb', text);
      localStorage.setItem('vintellect_kb_filename', file.name);
      setKbName(file.name);
      window.location.reload();
    };
    reader.readAsText(file);
  };

  const clearKb = () => {
    localStorage.removeItem('vintellect_custom_kb');
    localStorage.removeItem('vintellect_kb_filename');
    setKbName(null);
    window.location.reload();
  };

  return (
    <div 
      className={`fixed lg:static top-0 left-0 inset-0 w-full lg:w-80 h-[100dvh] lg:h-full bg-white border-r border-slate-200 shadow-2xl z-[100] lg:z-50 overflow-y-auto transition-transform duration-300 ease-in-out flex flex-col ${
        isOpen ? 'translate-x-0' : '-translate-x-full lg:hidden'
      }`}
    >
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
        <h2 className="text-lg font-bold text-[#800020] flex items-center gap-2">
          <SlidersHorizontal size={18} /> Sommelier Tools
        </h2>
        <button 
          onClick={onClose} 
          className="w-10 h-10 bg-[#800020] text-[#D4AF37] rounded-full flex items-center justify-center hover:brightness-110 active:scale-95 transition-all shadow-lg"
          aria-label="Close sidebar"
        >
           <X size={24} strokeWidth={3} />
        </button>
      </div>

      <div className="p-6 space-y-8 flex-1">
        {/* Retailer Filter */}
        <section>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Store size={14} /> Retailers
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {SUPERMARKETS.map((name) => (
              <button
                key={name}
                onClick={() => toggleSupermarket(name)}
                className={`px-2 py-2 rounded-lg text-[10px] font-bold transition-all border ${
                  activeSupermarkets.includes(name) 
                    ? 'bg-[#800020] text-[#F7E1A1] border-[#800020] shadow-sm' 
                    : 'bg-white text-slate-500 border-slate-200 hover:border-[#800020]/30'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </section>

        {/* Wine Type Filter */}
        <section>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Filter size={14} /> Wine Type
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {WINE_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => toggleWineType(type)}
                className={`px-3 py-2 rounded-lg text-[10px] font-bold transition-all border ${
                  activeWineTypes.includes(type) 
                    ? 'bg-[#800020] text-[#F7E1A1] border-[#800020] shadow-sm' 
                    : 'bg-white text-slate-500 border-slate-200 hover:border-[#800020]/30'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </section>

        {/* Price Tiers */}
        <section>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <ShoppingBag size={14} /> Price Range
          </h3>
          <div className="space-y-2">
            {PRICE_TIERS.map((tier) => (
              <button 
                key={tier.label} 
                onClick={() => togglePriceTier(tier.label)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  activePriceTier === tier.label 
                    ? 'bg-[#800020] border-[#800020] text-[#F7E1A1] shadow-md scale-[1.02]' 
                    : 'bg-white border-slate-100 hover:bg-slate-50'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold">{tier.label}</span>
                  <span className="text-[9px] opacity-60 uppercase tracking-tighter">{tier.description}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <div className="h-px bg-slate-100"></div>

        {/* Digital Cellar */}
        <section className="animate-in fade-in slide-in-from-bottom-4">
          <button 
            onClick={() => setIsCellarExpanded(!isCellarExpanded)}
            className="w-full flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 group hover:text-[#800020] transition-colors"
          >
            <span className="flex items-center gap-2">
              <Bookmark size={14} /> Saved Gems ({cellar.length})
            </span>
            {isCellarExpanded ? <ChevronUp size={14} className="text-[#800020]" /> : <ChevronDown size={14} />}
          </button>
          
          {isCellarExpanded && (
            <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
              {cellar.length === 0 ? (
                <div className="p-6 border border-dashed border-slate-200 rounded-lg text-center bg-slate-50/50">
                   <p className="text-[10px] text-slate-400 italic leading-relaxed text-center">Scan a bottle to begin your cellar.</p>
                </div>
              ) : (
                cellar.map((wine) => (
                  <div 
                    key={wine.name} 
                    onClick={() => onWineClick(wine)}
                    className="p-3 bg-[#F7E1A1]/10 border border-[#F7E1A1]/30 rounded-lg group hover:bg-[#F7E1A1]/30 transition-all hover:shadow-sm hover:border-[#D4AF37] cursor-pointer active:border-[#D4AF37] active:shadow-[0_0_10px_rgba(212,175,55,0.3)]"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex gap-2 items-center min-w-0">
                        <WineIcon size={12} className="text-[#800020] flex-shrink-0" />
                        <p className="text-xs font-bold text-[#800020] truncate">{wine.name}</p>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeFromCellar(wine.name); }} 
                        className="text-slate-300 hover:text-red-500 transition-colors p-1"
                        title="Remove from cellar"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    
                    <div className="flex justify-between items-center mt-1.5 ml-5">
                      <p className="text-[9px] text-slate-500 uppercase font-medium">£{wine.price} • {wine.retailer}</p>
                      {wine.rating && <span className="text-[9px] text-[#800020] font-bold bg-[#F7E1A1]/40 px-1 rounded flex items-center gap-0.5"><Star size={8} fill="currentColor" /> {wine.rating}</span>}
                    </div>

                    {(wine.awards && wine.awards.length > 0) || (wine.criticScores && wine.criticScores.length > 0) ? (
                      <div className="mt-2 ml-5 flex flex-wrap gap-1">
                        {wine.awards?.map((award, i) => (
                          <span key={i} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm bg-[#800020]/10 text-[#800020] text-[8px] font-bold border border-[#800020]/20">
                            <Award size={8} /> {award}
                          </span>
                        ))}
                        {wine.criticScores?.map((score, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded-sm bg-white text-slate-600 text-[8px] font-bold border border-slate-200">
                            {score.critic}: {score.score}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          )}
        </section>
      </div>

      <div className="p-6 bg-slate-50 border-t border-slate-100 mt-auto sticky bottom-0">
         <div className="flex items-center gap-3 text-slate-400">
            <Info size={14} className="flex-shrink-0" />
            <p className="text-[10px] leading-tight">Vintellect relies on real-time UK retail data and global wine ratings.</p>
         </div>
      </div>
    </div>
  );
};

export default Sidebar;