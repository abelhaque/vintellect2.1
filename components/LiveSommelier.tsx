import React, { useState, useRef, useEffect } from 'react';
import { Send, Wine, Search, Sparkles, X, Camera, Mic } from 'lucide-react';
import { generateWineResponseStream, analyzeImage, generateImage } from '../services/geminiService';
import { Message, Source } from '../types';

interface LiveSommelierProps {
  activeSupermarkets: string[];
  activeWineTypes: string[];
  activePriceTier: string | null;
}

const LiveSommelier: React.FC<LiveSommelierProps> = ({
  activeSupermarkets,
  activeWineTypes,
  activePriceTier
}) => {
  // FIX: Timestamps must be Date objects, not numbers
  const [messages, setMessages] = useState<Message[]>([
    { 
      id: 'init-1',
      role: 'assistant', 
      content: "Hello! I am Vintellect. Tell me what you're eating or what you like, and I'll check the local cellars for you.",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() && !isLoading) return;

    // FIX: Use new Date()
    const userMsg: Message = { 
      id: Date.now().toString(),
      role: 'user', 
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setSources([]);

    // FIX: Use new Date()
    const assistantMsg: Message = { 
      id: (Date.now() + 1).toString(),
      role: 'assistant', 
      content: '',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, assistantMsg]);

    try {
      const { sources: newSources } = await generateWineResponseStream(
        [...messages, userMsg],
        activeSupermarkets,
        activeWineTypes,
        activePriceTier,
        (chunkText) => {
          setMessages(prev => {
            const newHistory = [...prev];
            const lastMsg = newHistory[newHistory.length - 1];
            
            if (lastMsg.role === 'assistant') {
              newHistory[newHistory.length - 1] = {
                ...lastMsg,
                content: chunkText,
                timestamp: lastMsg.timestamp || new Date()
              };
            }
            return newHistory;
          });
        }
      );
      setSources(newSources);
    } catch (error) {
      console.error("Chat Error:", error);
      setMessages(prev => {
        const newHistory = [...prev];
        const lastMsg = newHistory[newHistory.length - 1];
        newHistory[newHistory.length - 1] = {
          ...lastMsg,
          content: lastMsg.content + "\n\n[Connection hiccup. Please try asking that again.]"
        };
        return newHistory;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      
      const userMsg: Message = { 
        id: Date.now().toString(),
        role: 'user', 
        content: "Analyze this label", 
        imageUrl: base64String,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, userMsg]);
      setIsLoading(true);

      try {
        const analysis = await analyzeImage("Analyze this wine label. Identify the producer, vintage, and grape.", base64String.split(',')[1], file.type);
        
        setMessages(prev => [...prev, { 
          id: (Date.now() + 1).toString(),
          role: 'assistant', 
          content: analysis,
          timestamp: new Date()
        }]);
      } catch (error) {
        setMessages(prev => [...prev, { 
          id: (Date.now() + 1).toString(),
          role: 'assistant', 
          content: "I had trouble reading that image. Try a clearer photo.",
          timestamp: new Date()
        }]);
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col h-[600px] bg-white rounded-xl shadow-lg border border-stone-200 overflow-hidden">
      {/* Header */}
      <div className="bg-stone-900 text-amber-50 p-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Wine className="w-5 h-5 text-amber-400" />
          <h2 className="font-serif font-semibold">Live Sommelier</h2>
        </div>
        <div className="flex gap-2">
           {isLoading && <Sparkles className="w-4 h-4 animate-spin text-amber-400" />}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-50">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-lg p-3 ${
              msg.role === 'user' 
                ? 'bg-stone-800 text-white' 
                : 'bg-white border border-stone-200 text-stone-800 shadow-sm'
            }`}>
              {msg.imageUrl && (
                <img src={msg.imageUrl} alt="Uploaded" className="max-w-full h-auto rounded-lg mb-2 border border-stone-600" />
              )}
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {msg.content.split(/(\[B\].*?\[\/B\])/g).map((part, i) => 
                  part.startsWith('[B]') 
                    ? <strong key={i} className="text-amber-700 font-bold">{part.replace(/\[\/?B\]/g, '')}</strong>
                    : <span key={i}>{part}</span>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Sources / Grounding */}
      {sources.length > 0 && (
        <div className="px-4 py-2 bg-stone-100 text-xs border-t border-stone-200 flex gap-2 overflow-x-auto">
          <span className="font-semibold text-stone-500">Sources:</span>
          {sources.map((src, i) => (
            <a key={i} href={src.uri} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-[150px]">
              {src.title}
            </a>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-stone-200">
        <div className="flex gap-2">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-full transition-colors"
          >
            <Camera className="w-5 h-5" />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleFileUpload}
          />
          
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask about wines, pairings, or upload a label..."
            className="flex-1 bg-stone-100 border-none rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            disabled={isLoading}
          />
          
          <button 
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className={`p-2 rounded-full transition-all ${
              isLoading || !input.trim() 
                ? 'bg-stone-200 text-stone-400' 
                : 'bg-stone-900 text-amber-400 hover:bg-black'
            }`}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default LiveSommelier;