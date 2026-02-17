import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { 
  X, 
  Mic, 
  Volume2, 
  ShieldCheck, 
  Loader2, 
  MessageSquare, 
  Send, 
  PlayCircle, 
  AlertCircle, 
  Sparkles,
  Info,
  ShieldAlert
} from 'lucide-react';
import { Message } from '../types';

/**
 * PROPS INTERFACE
 * Fully synchronized with App.tsx to handle the pre-authorized hardware stream
 */
interface LiveSommelierProps {
  preAuthorizedStream: MediaStream | null; 
  isChatMode: boolean;
  onClose: () => void;
  onSwitchMode: () => void;
  activeSupermarkets: string[];
  activeWineTypes: string[];
  activePriceTier: string | null;
  messages: Message[];
  handleSendMessage: (content: string, imageUrl?: string, displayContent?: string) => Promise<void>;
  isTyping: boolean;
}

const LiveSommelier: React.FC<LiveSommelierProps> = (props) => {
  // --- STATE MANAGEMENT ---
  const [connectionState, setConnectionState] = useState<'idle' | 'connecting' | 'listening' | 'speaking' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [textInput, setTextInput] = useState('');
  const [audioLevel, setAudioLevel] = useState(0); 
  const [isRetrying, setIsRetrying] = useState(false);
  
  // --- REFS FOR HARDWARE & NETWORK ---
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const animationFrameRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  /**
   * PCM DECODER ENGINE
   * Specifically tuned for Gemini 3 Flash's 24kHz Mono Output
   */
  const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number): Promise<AudioBuffer> => {
    const dataInt16 = new Int16Array(data.buffer);
    const buffer = ctx.createBuffer(1, dataInt16.length, sampleRate);
    const channelData = buffer.getChannelData(0);
    
    // Manual normalization for maximum neural voice clarity
    for (let i = 0; i < dataInt16.length; i++) {
      channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
  };

  /**
   * NEURAL LINK INITIALIZATION
   * Handles the Gemini 3 Flash Paid Tier Handshake
   */
  const initializeLiveSession = async () => {
    setConnectionState('connecting');
    setErrorMsg('');
    setIsRetrying(false);

    try {
      // 1. HARDWARE VERIFICATION
      const stream = props.preAuthorizedStream;
      if (!stream) {
        throw new Error("Neural hardware link severed. Please return to the cellar entrance.");
      }

      // 2. AUDIO PIPELINE CONFIGURATION
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioCtx({ sampleRate: 16000 });
      const outputCtx = new AudioCtx({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;
      
      // Critical unlock for iOS/Safari compliance
      if (outputCtx.state === 'suspended') {
        await outputCtx.resume();
      }

      // 3. REAL-TIME WAVEFORM ANALYSER
      const analyser = inputCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      const sourceNode = inputCtx.createMediaStreamSource(stream);
      sourceNode.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const updateWaveform = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        setAudioLevel(average); 
        animationFrameRef.current = requestAnimationFrame(updateWaveform);
      };
      updateWaveform();

      // 4. ESTABLISH SECURE WEBSOCKET
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("Vintellect Access Token (API_KEY) is undefined.");
      
      const ai = new GoogleGenAI({ apiKey });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-3-flash', 
        callbacks: {
          onopen: () => {
            console.log("%c Vintellect 3.0: Neural Link Established ", "background: #800020; color: #F7E1A1; font-weight: bold;");
            setConnectionState('listening');
          },
          onmessage: async (msg: LiveServerMessage) => {
            const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              setConnectionState('speaking');
              const bin = atob(base64Audio);
              const bytes = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) {
                bytes[i] = bin.charCodeAt(i);
              }
              
              const audioBuffer = await decodeAudioData(bytes, outputCtx, 24000);
              const source = outputCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputCtx.destination);
              
              // Frame-perfect playback scheduling
              const now = outputCtx.currentTime;
              if (nextStartTimeRef.current < now) {
                nextStartTimeRef.current = now + 0.05; 
              }
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              
              sourcesRef.current.add(source);
              source.onended = () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) {
                  setConnectionState('listening');
                }
              };
            }
          },
          onerror: (err: any) => {
            console.error("Neural Link Error Block:", err);
            setConnectionState('error');
          },
          onclose: (event: CloseEvent) => {
            console.warn(`Link Closure: Code ${event.code}, Reason: ${event.reason || 'None'}`);
            
            if (event.code !== 1000) {
                setConnectionState('error');
                if (event.code === 1008) {
                    setErrorMsg("Policy Rejection (1008): Gemini 3 requires Billing-Enabled API Keys.");
                } else if (event.code === 4004) {
                    setErrorMsg("Model Not Found (4004): Gemini 3 Flash is currently restricted.");
                } else {
                    setErrorMsg(`Neural Link Dropped: ${event.code}`);
                }
            } else if (!props.isChatMode) {
                props.onClose();
            }
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { 
            voiceConfig: { 
              prebuiltVoiceConfig: { voiceName: 'Fenrir' } 
            } 
          },
          systemInstruction: `You are Vintellect 3.0, the world's most sophisticated UK Wine Expert.
            Active Retailers: ${props.activeSupermarkets.join(', ') || 'Waitrose, M&S, Tesco, Sainsbury\'s, Majestic'}.
            Current Tier: ${props.activePriceTier || 'Mid-to-High Range'}.
            Tone: Academic yet accessible, witty, elite British sommelier. 
            Instructions: Provide immediate tasting notes and pairing logic via voice.`
        }
      });
      
      sessionRef.current = await sessionPromise;

    } catch (err: any) {
      console.error("Fatal Neural Link Error:", err);
      setConnectionState('error');
      setErrorMsg(err.message || "Gemini 3 Neural Handshake failed.");
    }
  };

  /**
   * CLEANUP PROTOCOL
   * Ensures all hardware is released on exit
   */
  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current.close();
        sessionRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      analyserRef.current = null;
    };
  }, []);

  const handleSendText = () => {
    if (!textInput.trim()) return;
    props.handleSendMessage(textInput);
    setTextInput('');
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#800020] flex flex-col items-center justify-center p-8 text-[#F7E1A1] backdrop-blur-3xl animate-in fade-in duration-700">
      
      {/* HEADER CONTROLS */}
      <div className="absolute top-8 right-8 flex gap-4">
        <button 
          onClick={props.onSwitchMode} 
          className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all shadow-xl"
        >
          {props.isChatMode ? <Mic size={16} /> : <MessageSquare size={16} />}
          {props.isChatMode ? "Voice Mode" : "Neural History"}
        </button>
        <button 
          onClick={props.onClose} 
          className="p-3 hover:bg-white/10 rounded-full transition-colors"
        >
          <X size={28} />
        </button>
      </div>

      <div className="flex flex-col items-center gap-12 w-full max-w-md text-center">
        {!props.isChatMode ? (
          <div className="flex flex-col items-center gap-12">
            {connectionState === 'idle' ? (
              <button 
                onClick={initializeLiveSession} 
                className="group flex flex-col items-center gap-8"
              >
                <div className="w-64 h-64 rounded-full border-4 border-[#D4AF37]/20 flex items-center justify-center bg-[#F7E1A1]/5 group-hover:bg-[#F7E1A1]/10 transition-all active:scale-95 shadow-2xl relative">
                   <Sparkles className="absolute -top-6 -right-6 text-[#D4AF37] animate-pulse" size={40} />
                   <div className="absolute inset-0 rounded-full border border-[#D4AF37]/10 animate-ping" />
                   <PlayCircle size={120} className="text-[#F7E1A1] drop-shadow-2xl" />
                </div>
                <div className="space-y-3">
                  <h2 className="text-4xl font-serif font-bold italic tracking-tight">Sync Gemini 3</h2>
                  <p className="text-[11px] uppercase tracking-[0.5em] opacity-40 font-bold">Paid Tier Neural Stream Ready</p>
                </div>
              </button>
            ) : (
              <>
                {/* DANCING NEURAL ORB */}
                <div 
                  className="relative w-72 h-72 flex items-center justify-center rounded-full" 
                  style={{ 
                    boxShadow: connectionState === 'listening' 
                      ? `0 0 ${30 + (audioLevel / 2)}px ${audioLevel / 3}px rgba(247, 225, 161, 0.3)` 
                      : 'none', 
                    transition: 'box-shadow 0.1s ease-out' 
                  }}
                >
                  <div 
                    className="absolute inset-0 rounded-full border-2 border-[#F7E1A1]/10" 
                    style={{ 
                      transform: `scale(${1 + (audioLevel / 300)})`, 
                      opacity: audioLevel > 5 ? 0.6 : 0.1, 
                      transition: 'transform 0.1s ease-out' 
                    }} 
                  />
                  <div className={`w-48 h-48 rounded-full bg-[#F7E1A1] flex items-center justify-center shadow-2xl transition-all duration-1000 ${connectionState === 'speaking' ? 'scale-110 shadow-[#D4AF37]/40' : 'scale-100'}`}>
                    {connectionState === 'connecting' ? <Loader2 className="text-[#800020] animate-spin" size={70} /> : 
                     connectionState === 'speaking' ? <Volume2 className="text-[#800020]" size={70} /> : 
                     connectionState === 'error' ? <ShieldAlert className="text-red-600" size={70} /> :
                     <Mic className="text-[#800020]" size={70} />}
                  </div>
                </div>
                <div className="space-y-4">
                  <h2 className="text-5xl font-serif font-bold italic">
                    {connectionState === 'listening' ? "I'm Listening" : 
                     connectionState === 'speaking' ? "Advising..." : 
                     connectionState === 'error' ? "Link Severed" : "Syncing..."}
                  </h2>
                </div>
              </>
            )}
            
            {/* DIAGNOSTIC CONSOLE */}
            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-3xl max-w-xs backdrop-blur-lg animate-in slide-in-from-top-4">
                <div className="flex items-center gap-3 mb-3">
                   <AlertCircle className="text-red-400" size={20} />
                   <span className="text-red-400 text-[11px] font-bold uppercase tracking-widest">Neural Diagnostic</span>
                </div>
                <p className="text-white/80 text-[12px] leading-relaxed mb-5">{errorMsg}</p>
                <button 
                  onClick={() => window.location.reload()} 
                  className="w-full py-3 bg-red-500/20 text-white text-[10px] font-bold uppercase rounded-xl border border-red-500/40 hover:bg-red-500/40 transition-all"
                >
                  Hard Reset Neural Core
                </button>
              </div>
            )}
          </div>
        ) : (
          /* NEURAL HISTORY VIEW */
          <div className="w-full bg-black/40 rounded-[3rem] border border-white/10 h-[520px] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500">
              <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                  {props.messages.map((m, idx) => (
                      <div key={m.id || idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] p-5 rounded-2xl text-xs leading-relaxed shadow-lg ${m.role === 'user' ? 'bg-[#F7E1A1] text-[#800020] font-bold' : 'bg-white/5 text-[#F7E1A1] border border-white/10'}`}>
                              {m.content.replace(/\[\/?B\]/g, '')}
                          </div>
                      </div>
                  ))}
              </div>
          </div>
        )}
        
        {/* STATUS FOOTER */}
        <div className="mt-12 flex items-center gap-8 opacity-40">
           <div className="flex flex-col items-center gap-2">
              <ShieldCheck size={24} />
              <span className="text-[8px] uppercase font-bold tracking-[0.4em]">Neural Sync</span>
           </div>
           <div className="w-px h-10 bg-[#F7E1A1]/20" />
           <div className="flex flex-col items-center gap-2">
              <Info size={24} />
              <span className="text-[8px] uppercase font-bold tracking-[0.4em]">Gemini 3.0</span>
           </div>
        </div>
      </div>
    </div>
  );
};

export default LiveSommelier;