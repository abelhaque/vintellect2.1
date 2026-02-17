import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { X, Mic, Volume2, ShieldCheck, Loader2, MessageSquare, Send } from 'lucide-react';
import { Message } from '../types';

interface LiveSommelierProps {
  isChatMode: boolean;
  onClose: () => void;
  onSwitchMode: () => void;
  activeSupermarkets: string[];
  activeWineTypes: string[];
  activePriceTier: string | null;
  // NEW: Bridging to App.tsx logic
  messages: Message[];
  handleSendMessage: (content: string) => Promise<void>;
  isTyping: boolean;
}

const LiveSommelier: React.FC<LiveSommelierProps> = ({ 
  isChatMode, 
  onClose, 
  onSwitchMode,
  activeSupermarkets,
  activeWineTypes,
  activePriceTier,
  messages,
  handleSendMessage,
  isTyping
}) => {
  const [connectionState, setConnectionState] = useState<'connecting' | 'listening' | 'speaking' | 'error'>('connecting');
  const [errorMsg, setErrorMsg] = useState('');
  const [textInput, setTextInput] = useState('');
  
  const sessionPromiseRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the live text view
  useEffect(() => {
    if (isChatMode && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isChatMode]);

  // Audio Helpers
  const encode = (bytes: Uint8Array) => {
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes;
  };

  async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const buffer = ctx.createBuffer(1, dataInt16.length, sampleRate);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < dataInt16.length; i++) {
      channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
  }

  // Live Voice Session Logic
  useEffect(() => {
    if (isChatMode) {
      setConnectionState('listening');
      return;
    }

    const startSession = async () => {
      try {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        const ai = new GoogleGenAI({ apiKey });
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const inputCtx = new AudioContextClass({ sampleRate: 16000 });
        const outputCtx = new AudioContextClass({ sampleRate: 24000 });
        audioContextRef.current = outputCtx;

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        const sessionPromise = ai.live.connect({
          model: 'gemini-3-flash-preview',
          callbacks: {
            onopen: () => {
              setConnectionState('listening');
              const source = inputCtx.createMediaStreamSource(stream);
              const processor = inputCtx.createScriptProcessor(4096, 1, 1);
              processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const int16 = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
                sessionPromise.then(s => s.sendRealtimeInput({
                  media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' }
                }));
              };
              source.connect(processor);
              processor.connect(inputCtx.destination);
            },
            onmessage: async (msg: LiveServerMessage) => {
              const base64Audio = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
              if (base64Audio) {
                setConnectionState('speaking');
                const audioBuffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000);
                const source = outputCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputCtx.destination);
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                sourcesRef.current.add(source);
                source.onended = () => {
                  sourcesRef.current.delete(source);
                  if (sourcesRef.current.size === 0) setConnectionState('listening');
                };
              }
            },
            onerror: () => setConnectionState('error'),
            onclose: () => onClose()
          },
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } } },
            systemInstruction: `You are Vintellect. Supermarkets: ${activeSupermarkets.join(', ')}. Budget: ${activePriceTier}. Be concise.`
          }
        });
        sessionPromiseRef.current = await sessionPromise;
      } catch (err) {
        setConnectionState('error');
        setErrorMsg('Mic access denied.');
      }
    };

    startSession();

    return () => {
      sessionPromiseRef.current?.then((s: any) => s.close());
      audioContextRef.current?.close();
    };
  }, [isChatMode, activeSupermarkets, activePriceTier]);

  const onSendText = async () => {
    if (!textInput.trim() || isTyping) return;
    const content = textInput;
    setTextInput('');
    await handleSendMessage(content);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#800020]/95 flex flex-col items-center justify-center p-8 text-[#F7E1A1] backdrop-blur-xl">
      
      {/* Top Controls */}
      <div className="absolute top-8 right-8 flex gap-4">
        <button onClick={onSwitchMode} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-xs font-bold uppercase tracking-widest">
          {isChatMode ? <Mic size={16} /> : <MessageSquare size={16} />}
          {isChatMode ? "Voice Mode" : "Text Mode"}
        </button>
        <button onClick={onClose} className="p-3 hover:bg-white/10 rounded-full">
          <X size={24} />
        </button>
      </div>

      <div className="flex flex-col items-center gap-8 w-full max-w-lg text-center">
        {!isChatMode ? (
          /* VOICE ORB VIEW */
          <div className="flex flex-col items-center gap-12 py-12">
            <div className="relative">
              <div className={`w-48 h-48 rounded-full border-4 border-[#D4AF37]/40 flex items-center justify-center ${connectionState === 'listening' ? 'animate-pulse' : ''}`}>
                <div className={`w-36 h-36 rounded-full bg-[#F7E1A1] flex items-center justify-center shadow-2xl transition-all duration-500 ${connectionState === 'speaking' ? 'scale-110' : 'scale-100'}`}>
                  {connectionState === 'connecting' ? <Loader2 size={48} className="text-[#800020] animate-spin" /> : 
                   connectionState === 'speaking' ? <Volume2 size={48} className="text-[#800020]" /> : 
                   <Mic size={48} className="text-[#800020]" />}
                </div>
              </div>
            </div>
            <h2 className="text-4xl font-bold font-serif">{connectionState === 'listening' ? "Listening..." : connectionState === 'speaking' ? "Advising..." : "Summoning..."}</h2>
          </div>
        ) : (
          /* LIVE TEXT VIEW - Now connected to real history */
          <div className="w-full bg-black/20 rounded-3xl border border-white/10 flex flex-col h-[500px] overflow-hidden animate-in slide-in-from-bottom-4">
            <div className="p-4 border-b border-white/5 flex justify-between items-center bg-black/20">
              <span className="text-[10px] uppercase font-bold tracking-[0.2em] opacity-60">Elite Chat Synchronized</span>
              {isTyping && <Loader2 size={14} className="animate-spin text-[#D4AF37]" />}
            </div>
            
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 text-left scroll-smooth">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl p-4 text-sm ${msg.role === 'user' ? 'bg-[#F7E1A1] text-[#800020]' : 'bg-white/5 border border-white/10 text-[#F7E1A1]'}`}>
                    {msg.content.replace(/\[\/?B\]/g, '').replace(/\[\/?H\]/g, '')}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-black/40 flex gap-2">
              <input 
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSendText()}
                type="text" 
                placeholder="Ask Vintellect..." 
                className="flex-1 bg-white/5 border border-white/10 rounded-xl p-4 outline-none focus:ring-1 focus:ring-[#D4AF37] text-sm"
              />
              <button onClick={onSendText} className="p-4 bg-[#F7E1A1] text-[#800020] rounded-xl hover:bg-white transition-colors">
                <Send size={18} />
              </button>
            </div>
          </div>
        )}

        <div className="bg-black/20 rounded-2xl p-6 border border-white/5 w-full flex items-center gap-4">
           <ShieldCheck className="text-[#D4AF37]" />
           <p className="text-[10px] uppercase font-bold tracking-widest text-left">Elite Cellar Knowledge Integrated</p>
        </div>
      </div>
    </div>
  );
};

export default LiveSommelier;