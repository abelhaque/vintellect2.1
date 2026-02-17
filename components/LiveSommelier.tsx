import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { X, Mic, Volume2, ShieldCheck, Loader2 } from 'lucide-react';

interface LiveSommelierProps {
  // Keeping these for compatibility, but we rely on the direct API connection now
  activeSupermarkets?: string[];
  activeWineTypes?: string[];
  activePriceTier?: string | null;
}

const LiveSommelier: React.FC<LiveSommelierProps> = () => {
  const [connectionState, setConnectionState] = useState<'connecting' | 'listening' | 'speaking' | 'error'>('connecting');
  const [errorMsg, setErrorMsg] = useState('');
  
  const sessionPromiseRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // 1. Audio Helpers
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

  // 2. The Gemini 2.5 Live Connection
  useEffect(() => {
    const startSession = async () => {
      try {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) throw new Error("API Key missing");

        const ai = new GoogleGenAI({ apiKey });
        
        // Setup Audio Contexts
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const inputCtx = new AudioContextClass({ sampleRate: 16000 });
        const outputCtx = new AudioContextClass({ sampleRate: 24000 });
        audioContextRef.current = outputCtx;

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // --- THE MAGIC: Connecting to Gemini 2.5 Live ---
        const sessionPromise = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-12-2025',
          callbacks: {
            onopen: () => {
              setConnectionState('listening');
              
              // Setup Mic Stream
              const source = inputCtx.createMediaStreamSource(stream);
              const processor = inputCtx.createScriptProcessor(4096, 1, 1);
              
              processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const int16 = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
                
                // Send Audio to Gemini
                sessionPromise.then(s => s.sendRealtimeInput({
                  media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' }
                }));
              };
              
              source.connect(processor);
              processor.connect(inputCtx.destination);
            },
            onmessage: async (msg: LiveServerMessage) => {
              // Receive Audio from Gemini
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

              // Handle Interruptions (User spoke while AI was speaking)
              if (msg.serverContent?.interrupted) {
                sourcesRef.current.forEach(s => s.stop());
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
                setConnectionState('listening');
              }
            },
            onerror: (e) => {
              console.error("Live API Error:", e);
              setConnectionState('error');
              setErrorMsg('Connection disrupted.');
            },
            onclose: () => {
               setConnectionState('connecting'); 
            }
          },
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } } },
            systemInstruction: "You are Vintellect, a British Sommelier. You are in a live voice conversation. Be concise, witty, and extremely knowledgeable about UK supermarket wine. Speak in a refined British accent."
          }
        });
        
        sessionPromiseRef.current = await sessionPromise;

      } catch (err: any) {
        console.error("Live Init Error:", err);
        setConnectionState('error');
        setErrorMsg('Microphone access denied or API Error.');
      }
    };

    startSession();

    return () => {
      // Cleanup on close
      sessionPromiseRef.current?.then((s: any) => s.close());
      audioContextRef.current?.close();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[200] bg-[#800020]/95 flex flex-col items-center justify-center p-8 text-[#F7E1A1] backdrop-blur-xl">
      
      {/* Visual Circle */}
      <div className="flex flex-col items-center gap-12 max-w-md text-center">
        <div className="relative">
          <div className={`w-48 h-48 rounded-full border-4 border-[#D4AF37]/40 flex items-center justify-center ${connectionState === 'listening' ? 'animate-pulse' : ''}`}>
            <div className={`w-36 h-36 rounded-full bg-[#F7E1A1] flex items-center justify-center shadow-2xl transition-all duration-500 ${connectionState === 'speaking' ? 'scale-110' : 'scale-100'}`}>
              {connectionState === 'connecting' ? <Loader2 size={48} className="text-[#800020] animate-spin" /> : 
               connectionState === 'speaking' ? <Volume2 size={48} className="text-[#800020]" /> : 
               <Mic size={48} className="text-[#800020]" />}
            </div>
          </div>
          <div className="absolute inset-0 rounded-full border border-[#F7E1A1]/10 scale-150 animate-ping opacity-20"></div>
        </div>

        <div className="space-y-4">
          <h2 className="text-4xl font-bold tracking-tight font-serif text-[#F7E1A1]">
            {connectionState === 'connecting' && "Summoning Sommelier..."}
            {connectionState === 'listening' && "Listening..."}
            {connectionState === 'speaking' && "Advising..."}
            {connectionState === 'error' && "Connection Error"}
          </h2>
          <p className="text-sm font-medium uppercase tracking-[0.2em] opacity-60 text-[#F7E1A1]">
            {errorMsg || "Gemini 2.5 Native Audio Active"}
          </p>
        </div>

        <div className="bg-black/20 rounded-2xl p-6 border border-white/5 w-full flex items-center gap-4">
           <ShieldCheck className="text-[#D4AF37]" />
           <p className="text-[10px] uppercase font-bold tracking-widest text-left text-[#F7E1A1]">Elite Cellar Knowledge Integrated</p>
        </div>
      </div>
    </div>
  );
};

export default LiveSommelier;