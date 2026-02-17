import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { X, Mic, Volume2, ShieldCheck, Loader2, MessageSquare, Send, PlayCircle, AlertCircle } from 'lucide-react';
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

const LiveSommelier: React.FC<LiveSommelierProps> = (props) => {
  const [connectionState, setConnectionState] = useState<'idle' | 'connecting' | 'listening' | 'speaking' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [textInput, setTextInput] = useState('');
  const [audioLevel, setAudioLevel] = useState(0); // For the visual waveform
  
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const animationFrameRef = useRef<number | null>(null);

  // PCM Decoder: Transforms Int16 Gemini data into Float32 WebAudio buffers
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
      if (!stream) {
        throw new Error("No authorized microphone found. Please refresh and Enter Cellar again.");
      }

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioCtx({ sampleRate: 16000 });
      const outputCtx = new AudioCtx({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;
      
      if (outputCtx.state === 'suspended') {
        await outputCtx.resume();
      }

      // --- WAVEFORM ANALYSER SETUP ---
      const analyser = inputCtx.createAnalyser();
      analyser.fftSize = 256;
      const sourceNode = inputCtx.createMediaStreamSource(stream);
      sourceNode.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateWaveform = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        setAudioLevel(average); // 0 to 255
        animationFrameRef.current = requestAnimationFrame(updateWaveform);
      };
      updateWaveform();

      // --- GEMINI CONNECTION ---
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("Vintellect API Key is missing.");
      
      const ai = new GoogleGenAI({ apiKey });
      
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
              for (let i = 0; i < inputData.length; i++) {
                int16[i] = inputData[i] * 32768;
              }
              sessionRef.current?.sendRealtimeInput({
                media: { 
                  data: btoa(String.fromCharCode(...new Uint8Array(int16.buffer))), 
                  mimeType: 'audio/pcm;rate=16000' 
                }
              });
            };
            
            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            const base64Audio = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
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
          onerror: (err) => {
            console.error("Gemini Protocol Error:", err);
            setConnectionState('error');
            setErrorMsg("Cellar connection interrupted.");
          },
          onclose: () => {
            if (!props.isChatMode) props.onClose();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { 
            voiceConfig: { 
              prebuiltVoiceConfig: { voiceName: 'Fenrir' } 
            } 
          },
          systemInstruction: `You are Vintellect, an elite British Sommelier. 
            Markets: ${props.activeSupermarkets.join(', ')}. 
            Price Tier: ${props.activePriceTier || 'All'}.
            Your persona is sophisticated, knowledgeable, and helpful.`
        }
      });
      
      sessionRef.current = await sessionPromise;

    } catch (err: any) {
      console.error("Session Initialization Failed:", err);
      setConnectionState('error');
      setErrorMsg(err.message || "Connection failed.");
    }
  };

  useEffect(() => {
    return () => {
      sessionRef.current?.close();
      if (audioContextRef.current) audioContextRef.current.close();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[200] bg-[#800020] flex flex-col items-center justify-center p-8 text-[#F7E1A1] backdrop-blur-3xl animate-in fade-in duration-500">
      <div className="absolute top-8 right-8 flex gap-4">
        <button 
          onClick={props.onSwitchMode} 
          className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors flex items-center gap-2"
        >
          {props.isChatMode ? <Mic size={24} /> : <MessageSquare size={24} />}
          {!props.isChatMode && <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">History</span>}
        </button>
        <button onClick={props.onClose} className="p-3 hover:bg-white/10 rounded-full transition-colors">
          <X size={24} />
        </button>
      </div>

      <div className="flex flex-col items-center gap-12 w-full max-w-md text-center">
        {!props.isChatMode ? (
          <div className="flex flex-col items-center gap-12">
            {connectionState === 'idle' ? (
              <button onClick={initializeLiveSession} className="group flex flex-col items-center gap-6">
                <div className="w-56 h-56 rounded-full border-4 border-[#D4AF37]/30 flex items-center justify-center bg-[#F7E1A1]/5 group-hover:bg-[#F7E1A1]/10 transition-all active:scale-95">
                  <PlayCircle size={100} className="text-[#F7E1A1] shadow-2xl" />
                </div>
                <h2 className="text-3xl font-serif font-bold italic tracking-tight">Begin Consultation</h2>
              </button>
            ) : (
              <>
                {/* THE WAVEFORM ORB */}
                <div 
                  className="relative w-64 h-64 flex items-center justify-center rounded-full"
                  style={{ 
                    boxShadow: connectionState === 'listening' 
                      ? `0 0 ${20 + (audioLevel / 2)}px ${audioLevel / 4}px rgba(212, 175, 55, 0.4)` 
                      : 'none',
                    transition: 'box-shadow 0.05s ease-out'
                  }}
                >
                  {/* Outer Dancing Ring */}
                  <div 
                    className="absolute inset-0 rounded-full border-2 border-[#D4AF37]/20"
                    style={{ 
                      transform: `scale(${1 + (audioLevel / 500)})`,
                      opacity: audioLevel > 5 ? 0.8 : 0.2
                    }}
                  />
                  
                  {/* The Main Orb */}
                  <div className={`w-44 h-44 rounded-full bg-[#F7E1A1] flex items-center justify-center shadow-2xl transition-all duration-700 ${connectionState === 'speaking' ? 'scale-110 shadow-[#D4AF37]/50' : 'scale-100'}`}>
                    {connectionState === 'connecting' ? <Loader2 className="text-[#800020] animate-spin" size={60} /> : 
                     connectionState === 'speaking' ? <Volume2 className="text-[#800020]" size={60} /> : 
                     <Mic className="text-[#800020]" size={60} />}
                  </div>
                </div>

                <div className="space-y-4">
                  <h2 className="text-5xl font-serif font-bold italic">
                      {connectionState === 'listening' ? "I'm Listening" : 
                       connectionState === 'speaking' ? "Advising..." : 
                       connectionState === 'error' ? "Hiccup!" : "Connecting..."}
                  </h2>
                </div>
              </>
            )}
            {errorMsg && (
              <div className="flex items-center gap-2 bg-red-500/20 border border-red-500/50 px-4 py-2 rounded-lg">
                <AlertCircle size={16} className="text-red-400" />
                <p className="text-red-400 text-xs font-bold uppercase tracking-widest">{errorMsg}</p>
              </div>
            )}
          </div>
        ) : (
          /* CHAT VIEW (REMAINS THE SAME) */
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
              <div className="p-6 bg-[#800020]/50 border-t border-white/5 flex gap-3">
                  <input 
                    value={textInput} 
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && props.handleSendMessage(textInput).then(() => setTextInput(''))}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none placeholder:text-white/20 focus:border-[#F7E1A1]/50 transition-all" 
                    placeholder="Message the Sommelier..." 
                  />
                  <button onClick={() => props.handleSendMessage(textInput).then(() => setTextInput(''))} className="p-4 bg-[#F7E1A1] text-[#800020] rounded-xl hover:bg-white transition-all active:scale-90">
                    <Send size={20}/>
                  </button>
              </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveSommelier;