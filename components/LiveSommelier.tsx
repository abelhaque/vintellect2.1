import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { X, Mic, Volume2, ShieldCheck, Loader2, MessageSquare, Send, PlayCircle, AlertCircle } from 'lucide-react';
import { Message } from '../types';

interface LiveSommelierProps {
  preAuthorizedStream: MediaStream | null; // CATCH THE HANDOFF
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
  
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Helper: PCM Decoder for Gemini's Int16 audio data
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
      // Step A: Use the stream from the Splash Screen
      const stream = props.preAuthorizedStream;
      if (!stream) throw new Error("No authorized microphone found.");

      // Step B: Initialize Audio (Standardized for 2026 browsers)
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioCtx({ sampleRate: 16000 });
      const outputCtx = new AudioCtx({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;
      if (outputCtx.state === 'suspended') await outputCtx.resume();

      // Step C: Connect to Gemini
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
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
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
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
              for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
              
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
            console.error("Gemini Error:", err);
            setConnectionState('error');
          },
          onclose: () => {
            if (!props.isChatMode) props.onClose();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } } },
          systemInstruction: `You are Vintellect. Supermarkets: ${props.activeSupermarkets.join(', ')}. British Sommelier tone.`
        }
      });
      sessionRef.current = await sessionPromise;

    } catch (err: any) {
      setConnectionState('error');
      setErrorMsg(err.message || "Connection failed.");
    }
  };

  useEffect(() => {
    return () => {
      sessionRef.current?.close();
      audioContextRef.current?.close();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[200] bg-[#800020] flex flex-col items-center justify-center p-8 text-[#F7E1A1] backdrop-blur-xl">
      <div className="absolute top-8 right-8 flex gap-4">
        <button onClick={props.onSwitchMode} className="p-3 hover:bg-white/10 rounded-full">
          {props.isChatMode ? <Mic size={24} /> : <MessageSquare size={24} />}
        </button>
        <button onClick={props.onClose} className="p-3 hover:bg-white/10 rounded-full"><X size={24} /></button>
      </div>

      <div className="flex flex-col items-center gap-12 w-full max-w-md text-center">
        {!props.isChatMode ? (
          <div className="flex flex-col items-center gap-12">
            {connectionState === 'idle' ? (
              <button onClick={initializeLiveSession} className="group flex flex-col items-center gap-6">
                <div className="w-48 h-48 rounded-full border-4 border-[#D4AF37]/40 flex items-center justify-center bg-[#F7E1A1]/5 group-active:scale-95 transition-transform">
                  <PlayCircle size={80} className="text-[#F7E1A1]" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-serif font-bold italic tracking-tight">Begin Consultation</h2>
                  <p className="text-[10px] uppercase tracking-[0.3em] opacity-50">Authorized Mic Ready</p>
                </div>
              </button>
            ) : (
              <>
                <div className={`w-48 h-48 rounded-full border-4 border-[#D4AF37]/40 flex items-center justify-center ${connectionState === 'listening' ? 'animate-pulse' : ''}`}>
                  <div className={`w-36 h-36 rounded-full bg-[#F7E1A1] flex items-center justify-center shadow-2xl transition-transform ${connectionState === 'speaking' ? 'scale-110' : 'scale-100'}`}>
                    {connectionState === 'connecting' ? <Loader2 className="text-[#800020] animate-spin" size={48} /> : 
                     connectionState === 'speaking' ? <Volume2 className="text-[#800020]" size={48} /> : 
                     <Mic className="text-[#800020]" size={48} />}
                  </div>
                </div>
                <h2 className="text-4xl font-serif font-bold italic">
                    {connectionState === 'connecting' ? "Connecting..." : connectionState === 'listening' ? "I'm Listening" : "Advising..."}
                </h2>
              </>
            )}
            {errorMsg && <p className="text-red-400 text-xs font-bold uppercase">{errorMsg}</p>}
          </div>
        ) : (
          /* CHAT VIEW (Syncs with history) */
          <div className="w-full bg-black/20 rounded-3xl border border-white/10 h-[450px] flex flex-col">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {props.messages.map(m => (
                      <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] p-3 rounded-xl text-xs ${m.role === 'user' ? 'bg-[#F7E1A1] text-[#800020]' : 'bg-white/10 text-[#F7E1A1]'}`}>
                              {m.content.replace(/\[\/?B\]/g, '')}
                          </div>
                      </div>
                  ))}
              </div>
              <div className="p-4 bg-black/40 flex gap-2">
                  <input 
                    value={textInput} onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && props.handleSendMessage(textInput).then(() => setTextInput(''))}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg p-2 text-sm outline-none" placeholder="Ask Vintellect..." 
                  />
                  <button onClick={() => props.handleSendMessage(textInput).then(() => setTextInput(''))} className="p-2 bg-[#F7E1A1] text-[#800020] rounded-lg"><Send size={18}/></button>
              </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveSommelier;