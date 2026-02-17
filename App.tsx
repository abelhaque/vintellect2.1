import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import LiveSommelier from './components/LiveSommelier';
import { Message, Wine } from './types';
import { WINE_DATABASE } from './constants';
import { generateWineResponseStream } from './services/geminiService';
import { Menu, Wine as WineIcon, ChevronRight, Mic, Sparkles, Trash2 } from 'lucide-react';

const WELCOME_MESSAGE: Message = {
  id: '1',
  role: 'assistant',
  content: "[H]Welcome to Vintellect 2.0[/H]\n\nI am your elite digital sommelier, curated for discerning Brits. I assist with:\n\n• [B]Scan Labels:[/B] Instant analysis of any bottle for tasting notes and UK retail pricing.\n• [B]Analyse Wine Lists:[/B] Photograph/Upload a restaurant menu or wine list for value-driven recommendations.\n• [B]Expert Pairing:[/B] Describe your meal for a bespoke cellar match.\n• [B]Smart Filtering:[/B] Focus your search by retailer or specific budget tiers.\n\nHow may I assist your palate or your wallet today?",
  timestamp: new Date()
};

const App: React.FC = () => {
  const [showApp, setShowApp] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // --- CHANGE 1: UPDATED STATE FOR LIVE MODES ---
  // Replaces: const [isLiveMode, setIsLiveMode] = useState(false);
  const [liveMode, setLiveMode] = useState<'off' | 'voice' | 'chat'>('off');
  
  const [isTyping, setIsTyping] = useState(false);
  const [cellar, setCellar] = useState<Wine[]>([]);
  const [activeSupermarkets, setActiveSupermarkets] = useState<string[]>([]);
  const [activeWineTypes, setActiveWineTypes] = useState<string[]>([]);
  const [activePriceTier, setActivePriceTier] = useState<string | null>(null);
  const [latencyNotice, setLatencyNotice] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [viewportHeight, setViewportHeight] = useState<number>(window.innerHeight);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const cyclerRef = useRef<number | null>(null);

  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('vintellect_chat_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }));
      } catch (e) {
        return [WELCOME_MESSAGE];
      }
    }
    return [WELCOME_MESSAGE];
  });

  useEffect(() => {
    const handleVisualViewportResize = () => {
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
      } else {
        setViewportHeight(window.innerHeight);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportResize);
      window.visualViewport.addEventListener('scroll', handleVisualViewportResize);
    }
    window.addEventListener('resize', handleVisualViewportResize);

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportResize);
        window.visualViewport.removeEventListener('scroll', handleVisualViewportResize);
      }
      window.removeEventListener('resize', handleVisualViewportResize);
    };
  }, []);

  const getAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioContextRef.current = new AudioContextClass();
      }
    }
    
    if (audioContextRef.current?.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const triggerHaptic = useCallback(async (pattern: number | number[]) => {
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(pattern);
    } else {
      const ctx = await getAudioContext();
      if (!ctx) return;

      const playPulse = (dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(60, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (dur / 1000));
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + (dur / 1000));
      };

      if (Array.isArray(pattern)) {
        let timeOffset = 0;
        pattern.forEach((duration, index) => {
          if (index % 2 === 0) {
            setTimeout(() => playPulse(duration), timeOffset);
          }
          timeOffset += duration;
        });
      } else {
        playPulse(pattern);
      }
    }
  }, [getAudioContext]);

  const playUpscaleJingle = async () => {
    const ctx = await getAudioContext();
    if (!ctx) return;

    const playTone = (freq: number, startTime: number, duration: number, volume: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volume, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    playTone(784.00, now, 2.0, 0.15); 
    playTone(1046.50, now + 0.02, 2.5, 0.12);
  };

  const playBookmarkChime = async () => {
    const ctx = await getAudioContext();
    if (!ctx) return;

    const playNote = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.12, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    playNote(1396.91, now, 0.35); 
    playNote(1760.00, now + 0.08, 0.45);
  };

  const playPageTurnSound = async () => {
    const ctx = await getAudioContext();
    if (!ctx) return;

    const bufferSize = 0.2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1200, ctx.currentTime);
    filter.Q.setValueAtTime(1, ctx.currentTime);

    const gainNode = ctx.createGain();
    const now = ctx.currentTime;

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.08, now + 0.04);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    noiseSource.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    noiseSource.start(now);
    noiseSource.stop(now + 0.2);
  };

  const playTrashSound = async () => {
    const ctx = await getAudioContext();
    if (!ctx) return;

    const bufferSize = 0.25 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let b0, b1, b2, b3, b4, b5, b6;
    b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      output[i] *= 0.11; 
      b6 = white * 0.115926;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    const gainNode = ctx.createGain();
    const now = ctx.currentTime;
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.2, now + 0.01);
    for (let t = 0.02; t < 0.2; t += 0.02) {
      gainNode.gain.setValueAtTime(Math.random() * 0.15 + 0.05, now + t);
    }
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

    noiseSource.connect(gainNode);
    gainNode.connect(ctx.destination);
    noiseSource.start(now);
    noiseSource.stop(now + 0.25);
  };

  const handleEnterCellar = () => {
    getAudioContext().then(() => {
      playUpscaleJingle();
      triggerHaptic(20);
      setShowApp(true);
    });
  };

  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if (navigator.wakeLock && typeof navigator.wakeLock.request === 'function') {
          wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch (err: any) {
        console.debug('Wake Lock failed:', err);
      }
    };
    const handleVisibilityChange = async () => {
      if (wakeLock !== null && document.visibilityState === 'visible') {
        await requestWakeLock();
      }
    };
    if (showApp) {
      requestWakeLock();
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) {
        wakeLock.release().catch((e: any) => console.debug('Wake Lock release error:', e));
      }
    };
  }, [showApp]);

  useEffect(() => {
    const savedCellar = localStorage.getItem('vintellect_cellar');
    if (savedCellar) setCellar(JSON.parse(savedCellar));
  }, []);

  useEffect(() => {
    localStorage.setItem('vintellect_cellar', JSON.stringify(cellar));
  }, [cellar]);

  useEffect(() => {
    localStorage.setItem('vintellect_chat_history', JSON.stringify(messages));
  }, [messages]);

  const handleSendMessage = useCallback(async (content: string, imageUrl?: string, displayContent?: string) => {
    if (!content.trim() && !imageUrl) return;

    getAudioContext();

    const userMessage: Message = { 
      id: Date.now().toString(), 
      role: 'user', 
      content: content, 
      displayContent: displayContent,
      timestamp: new Date(), 
      imageUrl: imageUrl 
    };

    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);
    setLatencyNotice(null);

    const latencyTimer = setTimeout(() => {
      setLatencyNotice('Still searching the cellars... almost there');
    }, 3000);

    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', timestamp: new Date() }]);

    try {
      const { sources } = await generateWineResponseStream(
        [...messages, userMessage], activeSupermarkets, activeWineTypes, activePriceTier,
        (currentText) => {
          if (cyclerRef.current) {
            clearInterval(cyclerRef.current);
            cyclerRef.current = null;
            setStatusMessage(null);
          }
          setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: currentText } : m));
        }
      );
      setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, sources } : m));
    } catch (error) {
      console.error("Vintellect Sommelier Error:", error);
      setMessages(prev => prev.map(m => m.id === assistantId ? { 
        ...m, 
        content: "Connection hiccup. Please try asking that again.", 
        isError: true,
        retryData: { prompt: content, image: imageUrl }
      } : m));
    } finally { 
      if (cyclerRef.current) {
        clearInterval(cyclerRef.current);
        cyclerRef.current = null;
      }
      setStatusMessage(null);
      clearTimeout(latencyTimer);
      setIsTyping(false); 
      setLatencyNotice(null);
    }
  }, [messages, activeSupermarkets, activeWineTypes, activePriceTier, getAudioContext]);

  const handleWineClick = (wine: Wine) => {
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
    getAudioContext();
    
    // Determine quality tier based on price/tags for research signaling
    const isFineWine = wine.price > 15 || wine.tags.toLowerCase().includes('premium') || wine.tags.toLowerCase().includes('prestige');
    const researchTarget = isFineWine ? "specialist fine wine merchants and critics" : "supermarket inventories";
    
    // Immediate Research Feedback
    setIsTyping(true);
    setStatusMessage(`Vincent is scanning ${researchTarget}...`);
    
    if (cyclerRef.current) clearInterval(cyclerRef.current);

    // Yield main thread to prevent Safari lockup
    setTimeout(() => {
      // Step A: Stricter Local CSV Scan (Keyword Match in JS)
      const queryKeywords = (wine.tags + " " + wine.type).toLowerCase().split(/[\s,]+/).filter(k => k.length > 3);
      const localMatches = WINE_DATABASE.filter(w => {
        if (w.name === wine.name) return false;
        const wText = (w.name + " " + w.tags + " " + w.type).toLowerCase();
        return queryKeywords.some(k => wText.includes(k));
      }).slice(0, 5);

      // Step B: Logic Expansion & 'Web-First' Trigger
      let internetFallbackInstruction = "";
      if (localMatches.length < 3) {
        const qualityPrefix = isFineWine ? "Fine wine" : "Everyday";
        setStatusMessage(`Cellar empty. Checking global ${qualityPrefix} records...`);
        internetFallbackInstruction = `IMPORTANT: My local cellar matches for [B]${wine.type}[/B] or [B]${wine.tags}[/B] are POOR. 
        You MUST ignore the limited local data and search the wider internet for the best alternative. 
        If premium, use specialist merchants and Decanter. If everyday, use supermarkets.`;
      } else {
        setStatusMessage("Consulting the cellar database...");
      }

      const marketData = `[CURRENT MARKET DATA: ${wine.retailer} - £${wine.price}]`;
      const qualityContext = isFineWine ? "QUALITY: Fine Wine / Special Occasion." : "QUALITY: Everyday / Value.";
      const honestyClause = `HONESTY CLAUSE: If you cannot find a direct match in the cellar data, state: "My cellar is out of ${wine.type}, but Decanter highly rates the [Wine Name] (£Price) available at [Merchant]."`;
      
      const technicalPrompt = `
        Detailed analysis for [B]${wine.name}[/B]. ${marketData}. 
        ${qualityContext}
        ${honestyClause}
        ${internetFallbackInstruction}
        
        Style Context: ${wine.type}, ${wine.tags}.
        Search the web to provide a high-authority alternative (BBR/Wine Society for fine, Supermarkets for everyday).
      `;

      const uiDisplayMessage = `Analyzing ${wine.name} and finding a high-authority alternative...`;
      handleSendMessage(technicalPrompt, undefined, uiDisplayMessage);
    }, 100);
  };

  const addToCellar = (wine: Wine) => {
    playBookmarkChime();
    setCellar(prev => {
      const exists = prev.some(w => w.name === wine.name);
      if (exists) return prev;
      return [...prev, wine];
    });
  };

  const removeFromCellar = (name: string) => {
    setCellar(prev => prev.filter(w => w.name !== name));
  };

  const clearHistory = () => {
    getAudioContext().then(() => {
      playTrashSound();
      triggerHaptic([30, 50, 30]);
      localStorage.removeItem('vintellect_chat_history');
      setMessages([WELCOME_MESSAGE]);
      if (window.innerWidth < 1024) setIsSidebarOpen(false);
    });
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const unlock = () => { getAudioContext(); };
    window.addEventListener('click', unlock);
    return () => window.removeEventListener('click', unlock);
  }, [getAudioContext]);

  return (
    <div 
      className="w-full overflow-hidden bg-[#F7E1A1] relative"
      style={{ height: `${viewportHeight}px` }}
    >
      {/* --- CHANGE 2: UPDATED LIVE SOMMELIER CALL --- */}
      {/* This now connects the "Live Text" box to your chat history */}
      {liveMode !== 'off' && (
        <LiveSommelier 
          isChatMode={liveMode === 'chat'} 
          onClose={() => setLiveMode('off')} 
          onSwitchMode={() => setLiveMode(prev => prev === 'voice' ? 'chat' : 'voice')}
          activeSupermarkets={activeSupermarkets}
          activeWineTypes={activeWineTypes}
          activePriceTier={activePriceTier}
          messages={messages}
          handleSendMessage={handleSendMessage}
          isTyping={isTyping}
        />
      )}
      
      {!showApp ? (
        <div className="fixed inset-0 bg-[#800020] flex flex-col items-center justify-center p-6 z-[100] overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/pinstripe-dark.png')]"></div>
          <div className="relative z-10 flex flex-col items-center text-center space-y-12 animate-in fade-in zoom-in duration-1000">
            <div className="p-6 rounded-full bg-[#F7E1A1]/10 border border-[#F7E1A1]/20 shadow-2xl">
              <WineIcon size={80} className="text-[#F7E1A1]" />
            </div>
            <div>
              <h1 className="text-5xl sm:text-7xl md:text-9xl font-bold text-[#F7E1A1] tracking-tighter font-serif break-words px-2">Vintellect</h1>
              <p className="text-2xl text-[#F7E1A1]/80 font-light mt-4 font-serif italic">Your elite supermarket sommelier.</p>
            </div>
            <button 
              onClick={handleEnterCellar}
              className="group flex items-center gap-4 bg-[#F7E1A1] text-[#800020] px-12 py-6 rounded-full font-bold text-xl shadow-2xl hover:bg-white transition-all active:scale-95"
            >
              <Sparkles size={24} />
              <span className="uppercase tracking-widest">Enter Cellar</span>
              <ChevronRight />
            </button>
          </div>
        </div>
      ) : (
        <>
          <Sidebar 
            isOpen={isSidebarOpen} 
            onClose={() => {
              setIsSidebarOpen(false);
              playPageTurnSound();
            }} 
            activeSupermarkets={activeSupermarkets}
            toggleSupermarket={(name) => setActiveSupermarkets(prev => prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name])}
            activeWineTypes={activeWineTypes}
            toggleWineType={(t) => setActiveWineTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
            activePriceTier={activePriceTier}
            togglePriceTier={(p) => setActivePriceTier(prev => prev === p ? null : p)}
            cellar={cellar}
            removeFromCellar={removeFromCellar}
            onWineClick={handleWineClick}
          />

          <div className="flex flex-col md:flex-row h-full w-full">
            <div className="flex-1 flex flex-col h-full relative overflow-hidden">
              <header className="flex-none bg-[#800020] text-white p-4 shadow-xl flex items-center justify-between z-30">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => {
                      setIsSidebarOpen(!isSidebarOpen);
                      playPageTurnSound();
                    }} 
                    className="p-2 hover:bg-white/10 rounded-lg"
                  >
                     <Menu size={24} />
                  </button>
                  <div className="flex items-center gap-2">
                     <WineIcon size={24} className="text-[#F7E1A1]" />
                     <span className="font-bold tracking-widest text-xl hidden sm:inline font-serif">Vintellect</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button onClick={clearHistory} className="p-2 hover:bg-white/10 rounded-lg text-white/70" title="Clear Chat">
                    <Trash2 size={20} />
                  </button>
                  {/* --- CHANGE 3: UPDATED HEADER BUTTON TO TRIGGER VOICE --- */}
                  <button 
                    onClick={() => setLiveMode('voice')}
                    className="flex items-center gap-2 bg-[#F7E1A1] text-[#800020] hover:bg-white px-5 py-2 rounded-full transition-all text-sm font-bold shadow-lg"
                  >
                    <Mic size={16} />
                    <span className="hidden sm:inline">Live Advice</span>
                  </button>
                </div>
              </header>

              <main className="flex-1 overflow-hidden relative flex flex-col">
                <ChatInterface 
                  messages={messages} 
                  isTyping={isTyping}
                  handleSendMessage={handleSendMessage}
                  addToCellar={addToCellar}
                  onHaptic={triggerHaptic}
                  statusMessage={statusMessage}
                />
                {isTyping && latencyNotice && (
                  <div className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm border border-[#800020]/20 px-4 py-2 rounded-full shadow-lg text-[10px] font-bold text-[#800020] uppercase tracking-widest animate-pulse z-50">
                    {latencyNotice}
                  </div>
                )}
              </main>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default App;