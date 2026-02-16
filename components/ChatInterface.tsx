import React, { useState, useRef, useEffect } from 'react';
import { Message, Wine } from '../types';
import MessageBubble from './MessageBubble';
import { Send, Upload, Loader2, Wine as WineIcon, Mic, Camera, UtensilsCrossed, Fish, Pizza, Beef, Leaf, Gift, Heart, Briefcase, PartyPopper, MessageSquareText } from 'lucide-react';

interface ChatInterfaceProps {
  messages: Message[];
  isTyping: boolean;
  handleSendMessage: (content: string, imageUrl?: string, displayContent?: string) => Promise<void>;
  addToCellar: (wine: Wine) => void;
  onHaptic?: (pattern: number | number[]) => void;
  statusMessage?: string | null;
}

const PAIRING_HELPERS = [
  { label: 'Seafood', prompt: 'I am eating seafood. Suggest a wine pairing from my retailers.', icon: <Fish size={14} /> },
  { label: 'Red Meat', prompt: 'I am cooking a steak. Suggest a bold red pairing.', icon: <Beef size={14} /> },
  { label: 'Italian', prompt: 'What is the best wine for pasta or pizza night?', icon: <Pizza size={14} /> },
  { label: 'Spicy', prompt: 'Suggest a wine that pairs with spicy Asian cuisine.', icon: <UtensilsCrossed size={14} /> },
  { label: 'Plant-Based', prompt: 'What wine pairs best with earthy vegetarian dishes?', icon: <Leaf size={14} /> },
  { label: 'Custom Pairing', prompt: "I have a specific dish in mind but I need you to help me narrow down the wine. Please ask me 3 quick questions about my meal (e.g., protein, sauce, spice level) so you can give me the perfect match from the cellar.", icon: <MessageSquareText size={14} />, isAdvanced: true },
];

const OCCASION_PRESETS = [
  { label: "Mother's Day Gift", prompt: "I need a beautiful wine to give as a Mother's Day gift. Suggest something elegant and highly rated.", icon: <Gift size={14} /> },
  { label: 'First Date', prompt: 'I am on a first date. Suggest a wine that is impressive but approachable from my retailers.', icon: <Heart size={14} /> },
  { label: 'Tuesday Pizza', prompt: 'It is a casual Tuesday night pizza. Find me a great value "Dupe Mode" red under £10.', icon: <Pizza size={14} /> },
  { label: 'The Boss is Coming', prompt: 'The boss is coming for dinner. Find a premium, top-tier bottle like a Chablis or Puligny-Montrachet.', icon: <Briefcase size={14} /> },
  { label: 'Big Celebration', prompt: 'We are celebrating! Search the cellar for the best Sparkling wine or Champagne available.', icon: <PartyPopper size={14} /> },
];

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  messages, isTyping, handleSendMessage, addToCellar, onHaptic, statusMessage
}) => {
  const [input, setInput] = useState('');
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, isProcessingImage]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.onresult = (e: any) => setInput(e.results[0][0].transcript);
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  }, []);

  const compressAndGetBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1024;
          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject('Canvas context failed');
          
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          resolve(compressedBase64);
        };
        img.onerror = () => reject('Image loading failed');
      };
      reader.onerror = () => reject('FileReader failed');
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingImage(true);

    try {
      const compressedData = await compressAndGetBase64(file);
      // STRICT TAG FORMAT: Identify the wine and price for the "Ghost Parser"
      const visionPrompt = `Identify the wine in the image. 
        You MUST output the wine name and the estimated UK price in this exact hidden tag format at the VERY START of your response: ::SCANNED_WINE::[Name of Wine]::[Estimated Price]::
        Example: ::SCANNED_WINE::Chateau Margaux 2015::£250::
        
        Then, output 'Analysis of uploaded image:' and identify the wine clearly.
        Provide your full analysis, UK retail context, and pairing notes.
        If you suggest alternatives, use the standard [B]Wine Name[/B] (£Price, Retailer) format.`;
        
      await handleSendMessage(visionPrompt, compressedData, "Reading label and checking cellar records...");
    } catch (err) {
      console.error("Image processing error:", err);
    } finally {
      setIsProcessingImage(false);
      e.target.value = '';
    }
  };

  const onSend = async (overridePrompt?: string) => {
    const finalInput = overridePrompt || input;
    if (!finalInput.trim()) return;
    setInput('');
    await handleSendMessage(finalInput);
  };

  const triggerCamera = () => cameraInputRef.current?.click();
  const triggerGallery = () => galleryInputRef.current?.click();

  const handleInputFocus = () => {
    setTimeout(() => {
      scrollToBottom();
    }, 300);
  };

  // Check if assistant has started streaming content
  const isAssistantStreaming = messages.length > 0 && 
    messages[messages.length - 1].role === 'assistant' && 
    messages[messages.length - 1].content !== '';

  return (
    <div className="flex flex-col h-full w-full max-w-4xl mx-auto overflow-hidden">
      {/* Message List: Takes up all available space */}
      <div 
        ref={scrollRef} 
        className="flex-1 overflow-y-auto space-y-8 momentum-scroll px-4 pt-4 pb-4"
      >
        {messages.map((msg) => (
          <MessageBubble 
            key={msg.id} 
            message={msg} 
            onBookmark={addToCellar} 
            onRetry={handleSendMessage}
            onHaptic={onHaptic}
          />
        ))}
        {(isTyping || isProcessingImage) && !isAssistantStreaming && !messages[messages.length-1]?.isError && (
          <div className="flex flex-col gap-3 ml-4 animate-fade-in-up">
            <div className="flex gap-4 items-center">
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[#D4AF37]"></div>
                <div className="w-10 h-10 border-2 border-[#800020]/20 rounded-full flex items-center justify-center bg-white shadow-sm overflow-hidden">
                   <div className="relative w-full h-full flex items-end">
                      <div className="wine-liquid w-full bg-[#800020]/40 h-full"></div>
                   </div>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-[#800020] uppercase tracking-widest flex items-center gap-2">
                  {isProcessingImage ? "Reading Label..." : (statusMessage || "Checking cellar records...")}
                  <span className="flex gap-1">
                    <span className="w-1 h-1 bg-[#800020] rounded-full animate-bounce delay-0"></span>
                    <span className="w-1 h-1 bg-[#800020] rounded-full animate-bounce delay-100"></span>
                    <span className="w-1 h-1 bg-[#800020] rounded-full animate-bounce delay-200"></span>
                  </span>
                </span>
                <span className="text-[10px] text-slate-500 font-medium">Vintellect Sommelier is crafting your advice</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Area: Fixed height elements anchored at the bottom */}
      <div className="flex-none w-full bg-[#F7E1A1]/95 backdrop-blur-md border-t border-[#800020]/5 z-[50]">
        
        {/* Quick Actions / Helpers: Higher z-index than messages */}
        {!isTyping && !isProcessingImage && messages.length < 15 && (
          <div className="p-2 space-y-2 flex-none z-10 relative">
            <div className="flex gap-2 overflow-x-auto pb-1 momentum-scroll touch-action-none">
              {PAIRING_HELPERS.map((helper) => (
                <button
                  key={helper.label}
                  onClick={() => onSend(helper.prompt)}
                  className={`golden-glow whitespace-nowrap flex items-center gap-2 px-4 py-2 rounded-full border text-[10px] font-bold tracking-wider transition-all shadow-sm active:scale-95 ${
                    (helper as any).isAdvanced 
                      ? 'bg-[#800020] text-white border-[#800020]' 
                      : 'bg-white text-[#800020] border-[#800020]/10'
                  }`}
                >
                  {helper.icon} {helper.label.toUpperCase()}
                </button>
              ))}
            </div>
            
            <div className="flex gap-2 overflow-x-auto pb-1 momentum-scroll touch-action-none">
              {OCCASION_PRESETS.map((occasion) => (
                <button
                  key={occasion.label}
                  onClick={() => onSend(occasion.prompt)}
                  className="golden-glow whitespace-nowrap flex items-center gap-2 px-4 py-2 bg-[#FDF5E6] text-[#800020] rounded-full border border-[#D4AF37]/30 text-[10px] font-bold tracking-wider transition-all shadow-sm active:scale-95 hover:scale-105"
                >
                  {occasion.icon} {occasion.label.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat Input Bar */}
        <div 
          className="p-4 pt-2 flex-none w-full" 
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
        >
          <form 
            onSubmit={(e) => { e.preventDefault(); onSend(); }}
            className="flex items-center gap-1 bg-white rounded-xl shadow-2xl border border-[#D4AF37]/20 p-2 pr-4 transition-all focus-within:ring-2 focus-within:ring-[#800020]/10 relative overflow-hidden w-full"
          >
            <button 
              type="button" 
              onClick={triggerCamera}
              className="p-3 text-slate-400 hover:text-[#800020] hover:bg-slate-50 rounded-lg transition-all flex-none shrink-0"
              title="Camera Scan"
              disabled={isTyping || isProcessingImage}
            >
              <Camera size={20} />
            </button>
            
            <button 
              type="button" 
              onClick={triggerGallery}
              className="p-3 text-slate-400 hover:text-[#800020] hover:bg-slate-50 rounded-lg transition-all flex-none shrink-0"
              title="Upload Label"
              disabled={isTyping || isProcessingImage}
            >
              <Upload size={20} />
            </button>

            <button 
              type="button"
              onClick={() => isListening ? recognitionRef.current?.stop() : (setIsListening(true), recognitionRef.current?.start())} 
              className={`p-3 rounded-lg transition-all flex-none shrink-0 ${isListening ? 'text-red-500 animate-pulse bg-red-50' : 'text-slate-400 hover:bg-slate-50'}`}
              title="Voice Control"
              disabled={isTyping || isProcessingImage}
            >
              <Mic size={20} />
            </button>

            <input 
              id="camera-input"
              type="file" 
              ref={cameraInputRef} 
              onChange={handleImageUpload} 
              accept="image/*" 
              capture="environment" 
              className="hidden" 
            />
            <input 
              id="gallery-input"
              type="file" 
              ref={galleryInputRef} 
              onChange={handleImageUpload} 
              accept="image/*" 
              className="hidden" 
            />

            <input 
              type="text" value={input} 
              onChange={(e) => setInput(e.target.value)}
              onFocus={handleInputFocus}
              placeholder={isListening ? "Listening..." : "Ask your sommelier..."}
              disabled={isTyping || isProcessingImage}
              className="flex-1 min-w-0 bg-transparent border-none focus:ring-0 text-slate-700 py-3 font-medium text-[16px] placeholder-slate-400"
            />

            <button 
              type="submit"
              disabled={isTyping || isProcessingImage || (!input.trim())}
              className="p-3 bg-[#800020] text-white rounded-lg shadow-lg hover:bg-[#a00028] disabled:opacity-50 transition-all active:scale-95 flex-none shrink-0"
            >
              <Send size={20} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;