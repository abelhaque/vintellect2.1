import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { 
  X, Mic, Volume2, ShieldCheck, Loader2, MessageSquare, Send, PlayCircle, AlertCircle, Sparkles, Info, ShieldAlert 
} from 'lucide-react';
import { Message } from '../types';

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

export const LiveSommelier: React.FC<LiveSommelierProps> = (props) => {
  const [connectionState, setConnectionState] = useState<'idle' | 'connecting' | 'listening' | 'speaking' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [textInput, setTextInput] = useState('');
  const [audioLevel, setAudioLevel] = useState(0); 
  
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const animationFrameRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number): Promise<AudioBuffer> => {
    const dataInt16 = new Int16Array(data.buffer);
    const buffer = ctx.createBuffer(1, dataInt16.length, sampleRate);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < dataInt16.length; i++) {
      channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
  };

  const initializeLiveSession = async () => {
    setConnectionState('connecting');
    setErrorMsg('');

    try {
      const stream = props.preAuthorizedStream;
      if (!stream) throw new Error("Hardware link missing. Please re-enter cellar.");

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioCtx({ sampleRate: 16000 });
      const outputCtx = new AudioCtx({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;
      if (outputCtx.state === 'suspended') await outputCtx.resume();

      const analyser = inputCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      const sourceNode = inputCtx.createMediaStreamSource(stream);
      sourceNode.connect(analyser);

      const updateWaveform = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        setAudioLevel(sum / dataArray.length);
        animationFrameRef.current = requestAnimationFrame(updateWaveform);
      };
      updateWaveform();

      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const ai = new GoogleGenAI({ apiKey });
      
      const sessionPromise = ai.live.connect({
        // PAID TIER REQUIREMENT: Use the full models/ path
        model: 'models/gemini-3-flash', 
        callbacks: {
          onopen: () => {
            console.log("Gemini 3 Neural Link: ESTABLISHED");
            setConnectionState('listening');
          },
          onmessage: async (msg: LiveServerMessage) => {
            const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              setConnectionState('speaking');
              const bin = atob(base64Audio);
              const bytes = new Uint8Array(bin.length);
              for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
              const audioBuffer = await decodeAudioData(bytes, outputCtx, 24000);
              const source = outputCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputCtx.destination);
              const now = outputCtx.currentTime;
              if (nextStartTimeRef.current < now) nextStartTimeRef.current = now + 0.05;
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
              source.onended = () => {
                sourcesRef.current.delete(source);
                if (sourcesRef.current.size === 0) setConnectionState('listening');
              };
            }
          },
          onerror: (err) => {
            console.error("Neural Link Error:", err);
            setConnectionState('error');
          },
          onclose: (event) => {
            if (event.code !== 1000) {
                setConnectionState('error');
                if (event.code === 1008) {
                    setErrorMsg("Policy Rejection (1008): Verify API key is set to 'Pay-as-you-go' in AI Studio.");
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
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } } },
          systemInstruction: `You are Vintellect 3.0. Elite UK Sommelier. 
            Retailers: ${props.activeSupermarkets.join(', ') || 'Waitrose, M&S, Tesco, Sainsbury\'s'}. 
            Budget: ${props.activePriceTier || 'Flexible'}.`
        }
      });
      sessionRef.current = await sessionPromise;
    } catch (err: any) {
      setConnectionState('error');
      setErrorMsg(err.message || "Gemini 3 Neural Failure.");
    }
  };

  useEffect(() => {
    return () => {
      if (sessionRef.current) sessionRef.current.close();
      if (audioContextRef.current) audioContextRef.current.close();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  const handleSendText = () => {
    if (!textInput.trim()) return;
    props.handleSendMessage(textInput);
    setTextInput('');
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#800020] flex flex-col items-center justify-center p-8 text-[#F7E1A1] backdrop-blur-3xl animate-in fade-in duration-500">
      <div className="absolute top-8 right-8 flex gap-4">
        <button onClick={props.onSwitchMode} className="flex items-center gap-2 px-5 py-2 bg-white/10 hover:bg-white/20 rounded-full text-xs font-bold uppercase tracking-widest transition-all shadow-lg">
          {props.isChatMode ? <Mic size={16} /> : <MessageSquare size={16} />}
          {props.isChatMode ? "Voice Mode" : "Neural History"}
        </button>
        <button onClick={props.onClose} className="p-3 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
      </div>

      <div className="flex flex-col items-center gap-12 w-full max-w-md text-center">
        {!props.isChatMode ? (
          <div className="flex flex-col items-center gap-12">
            {connectionState === 'idle' ? (
              <button onClick={initializeLiveSession} className="group flex flex-col items-center gap-6">
                <div className="w-60 h-60 rounded-full border-4 border-[#D4AF37]/30 flex items-center justify-center bg-[#F7E1A1]/5 group-hover:bg-[#F7E1A1]/10 transition-all active:scale-95 shadow-2xl">
                   <Sparkles className="absolute -top-4 -right-4 text-[#D4AF37] animate-pulse" size={32} />
                   <PlayCircle size={100} className="text-[#F7E1A1]" />
                </div>
                <h2 className="text-3xl font-serif font-bold italic tracking-tight">Sync Gemini 3</h2>
              </button>
            ) : (
              <>
                <div className="relative w-64 h-64 flex items-center justify-center rounded-full" 
                     style={{ boxShadow: connectionState === 'listening' ? `0 0 ${20 + (audioLevel / 2)}px ${audioLevel / 4}px rgba(212, 175, 55, 0.4)` : 'none', transition: 'box-shadow 0.08s ease-out' }}>
                  <div className="absolute inset-0 rounded-full border-2 border-[#D4AF37]/20" 
                       style={{ transform: `scale(${1 + (audioLevel / 350)})`, opacity: audioLevel > 5 ? 0.8 : 0.2, transition: 'transform 0.08s ease-out' }} />
                  <div className={`w-44 h-44 rounded-full bg-[#F7E1A1] flex items-center justify-center shadow-2xl transition-all duration-700 ${connectionState === 'speaking' ? 'scale-110 shadow-[#D4AF37]/50' : 'scale-100'}`}>
                    {connectionState === 'connecting' ? <Loader2 className="text-[#800020] animate-spin" size={60} /> : 
                     connectionState === 'speaking' ? <Volume2 className="text-[#800020]" size={60} /> : 
                     connectionState === 'error' ? <ShieldAlert className="text-red-600" size={60} /> :
                     <Mic className="text-[#800020]" size={60} />}
                  </div>
                </div>
                <h2 className="text-5xl font-serif font-bold italic">
                  {connectionState === 'listening' ? "I'm Listening" : 
                   connectionState === 'speaking' ? "Advising..." : 
                   connectionState === 'error' ? "Link Severed" : "Syncing..."}
                </h2>
              </>
            )}
            
            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-2xl max-w-xs backdrop-blur-md">
                <p className="text-red-400 text-[10px] font-bold uppercase tracking-widest leading-relaxed mb-4">{errorMsg}</p>
                <button onClick={() => window.location.reload()} className="w-full py-2 bg-red-500/20 text-white text-[10px] font-bold uppercase rounded-lg border border-red-500/50 hover:bg-red-500/40 transition-colors">Hard Reset App</button>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full bg-black/40 rounded-[2.5rem] border border-white/10 h-[500px] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                  {props.messages.map((m, idx) => (
                      <div key={m.id || idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] p-4 rounded-2xl text-xs leading-relaxed shadow-lg ${m.role === 'user' ? 'bg-[#F7E1A1] text-[#800020] font-bold' : 'bg-white/5 text-[#F7E1A1] border border-white/10'}`}>
                              {m.content.replace(/\[\/?B\]/g, '')}
                          </div>
                      </div>
                  ))}
              </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveSommelier;