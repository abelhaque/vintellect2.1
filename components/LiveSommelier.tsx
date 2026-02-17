import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, X, Wine, Volume2, VolumeX } from 'lucide-react';
import { generateWineResponseStream } from '../services/geminiService';
import { Message } from '../types';

interface LiveSommelierProps {
  activeSupermarkets: string[];
  activeWineTypes: string[];
  activePriceTier: string | null;
}

const LiveSommelier: React.FC<LiveSommelierProps> = ({
  activeSupermarkets = [],
  activeWineTypes = [],
  activePriceTier = null
}) => {
  // Simple State
  const [status, setStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [transcript, setTranscript] = useState("Tap the microphone to speak to Vintellect.");
  const [audioEnabled, setAudioEnabled] = useState(true);
  
  // History is kept in memory for context, but NOT rendered (prevents crash)
  const historyRef = useRef<Message[]>([
    { role: 'assistant', content: "Hello. I am listening.", id: 'init', timestamp: new Date() }
  ]);

  // Speech Recognition Setup (Web Standard)
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // @ts-ignore - Handle browser prefixes
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-GB'; // British English for the Sommelier vibe

      recognition.onstart = () => setStatus('listening');
      
      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        handleUserVoiceInput(text);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech Error:", event.error);
        setStatus('idle');
        setTranscript("I didn't quite catch that. Tap to try again.");
      };

      recognition.onend = () => {
        if (status === 'listening') setStatus('idle');
      };

      recognitionRef.current = recognition;
    } else {
      setTranscript("Voice not supported on this browser.");
    }
  }, []);

  const speak = (text: string) => {
    if (!audioEnabled || !window.speechSynthesis) return;
    
    // Stop any current speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-GB'; // British Voice
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    
    utterance.onstart = () => setStatus('speaking');
    utterance.onend = () => setStatus('idle');

    window.speechSynthesis.speak(utterance);
  };

  const handleUserVoiceInput = async (text: string) => {
    setTranscript(`"${text}"`);
    setStatus('thinking');

    // Add to history
    const userMsg: Message = { 
      id: Date.now().toString(), 
      role: 'user', 
      content: text, 
      timestamp: new Date() 
    };
    historyRef.current.push(userMsg);

    try {
      let fullResponse = "";
      
      // Call Gemini Brain (The Text-to-Text part)
      await generateWineResponseStream(
        historyRef.current,
        activeSupermarkets,
        activeWineTypes,
        activePriceTier,
        (chunk) => {
          // We just collect the text here, we don't render it live to avoid complexity
          fullResponse = chunk;
        }
      );

      // Add response to history
      historyRef.current.push({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: fullResponse,
        timestamp: new Date()
      });

      // Speak the result
      // Clean up bold tags for speech
      const cleanText = fullResponse.replace(/\[\/?B\]/g, ''); 
      setTranscript(cleanText); // Show subtitle
      speak(cleanText); // Speak audio

    } catch (error) {
      setTranscript("I lost connection to the cellar. Please try again.");
      setStatus('idle');
    }
  };

  const toggleListening = () => {
    if (status === 'listening') {
      recognitionRef.current?.stop();
    } else if (status === 'speaking') {
      window.speechSynthesis.cancel();
      setStatus('idle');
    } else {
      recognitionRef.current?.start();
    }
  };

  return (
    // FULL HEIGHT CONTAINER - No scrolling lists, no crashes.
    <div className="h-[600px] max-h-[80vh] bg-stone-900 rounded-xl overflow-hidden flex flex-col relative shadow-2xl border border-stone-700">
      
      {/* Header */}
      <div className="p-4 flex justify-between items-center text-amber-50/50">
        <div className="flex items-center gap-2">
          <Wine className="w-5 h-5 text-amber-500" />
          <span className="text-xs uppercase tracking-widest font-semibold text-amber-500">Live Voice</span>
        </div>
        <button onClick={() => setAudioEnabled(!audioEnabled)}>
          {audioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5 text-red-400" />}
        </button>
      </div>

      {/* Main Visualizer Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        
        {/* The "Orb" - Changes based on state */}
        <div 
          onClick={toggleListening}
          className={`
            w-32 h-32 rounded-full flex items-center justify-center cursor-pointer transition-all duration-500 mb-8
            ${status === 'listening' ? 'bg-red-500 scale-110 shadow-[0_0_50px_rgba(239,68,68,0.5)]' : ''}
            ${status === 'thinking' ? 'bg-amber-500 animate-pulse shadow-[0_0_50px_rgba(245,158,11,0.5)]' : ''}
            ${status === 'speaking' ? 'bg-amber-400 scale-105 shadow-[0_0_30px_rgba(251,191,36,0.5)]' : ''}
            ${status === 'idle' ? 'bg-stone-800 border-2 border-stone-600 hover:border-amber-500' : ''}
          `}
        >
          {status === 'listening' && <Mic className="w-12 h-12 text-white animate-bounce" />}
          {status === 'thinking' && <Wine className="w-12 h-12 text-white animate-spin" />}
          {status === 'speaking' && <Volume2 className="w-12 h-12 text-stone-900" />}
          {status === 'idle' && <Mic className="w-12 h-12 text-stone-400" />}
        </div>

        {/* Status Text */}
        <h3 className="text-2xl font-serif text-amber-50 mb-2">
          {status === 'listening' && "Listening..."}
          {status === 'thinking' && "Consulting the Cellar..."}
          {status === 'speaking' && "Vintellect Speaking"}
          {status === 'idle' && "Tap to Speak"}
        </h3>

        {/* Transcript / Subtitles */}
        <p className="text-stone-400 text-sm max-w-md leading-relaxed min-h-[60px]">
          {transcript}
        </p>
      </div>
    </div>
  );
};

export default LiveSommelier;