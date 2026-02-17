import { GoogleGenerativeAI } from "@google/generative-ai";
import { Message, Source } from "../types";
import { WINE_DATABASE } from "../constants";

// 1. SAFELY GET KEY
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

const getAI = () => {
  if (!API_KEY) {
    console.error("CRITICAL: VITE_GEMINI_API_KEY is missing!");
    throw new Error("API Key is missing. Check Vercel settings.");
  }
  return new GoogleGenerativeAI(API_KEY);
};

// Robust CSV Line Splitter
const splitCSV = (text: string) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else current += char;
  }
  result.push(current.trim());
  return result;
};

// Optimized Local Lookup
const getContextualWineData = (
  customKb: string | null, 
  activeRetailers: string[], 
  activeWineTypes: string[],
  activePriceTier: string | null,
  userQuery: string
) => {
  let sourceData: any[] = [];
  if (customKb) {
    const rawLines = customKb.split(/\r?\n/).map(l => l.trim()).filter(l => l !== "");
    if (rawLines.length > 1) {
      let headerRowIndex = 0;
      const firstLineValues = splitCSV(rawLines[0]);
      if (firstLineValues.every(v => v === "") || (!rawLines[0].toLowerCase().includes("wine") && !rawLines[0].toLowerCase().includes("retailer"))) {
        headerRowIndex = 1;
      }
      const headers = splitCSV(rawLines[headerRowIndex]);
      sourceData = rawLines.slice(headerRowIndex + 1).map(line => {
        const values = splitCSV(line);
        const obj: any = {};
        headers.forEach((h, i) => { if (h) obj[h] = values[i]; });
        return {
          name: values[1] || 'Unknown Wine',
          price: parseFloat(values[3]) || 0,
          retailer: values[4] || 'Unknown',
          type: values[5] || 'Unknown',
          rating: values[6] || "4.0",
          tags: values[7] || ''
        };
      });
    }
  } else {
    sourceData = WINE_DATABASE;
  }

  let filtered = sourceData;
  if (activeRetailers.length > 0) {
    filtered = filtered.filter(w => activeRetailers.includes(w.retailer));
  }
  if (activeWineTypes.length > 0) {
    const typesLower = activeWineTypes.map(t => t.toLowerCase());
    filtered = filtered.filter(w => typesLower.some(t => w.type.toLowerCase().includes(t)));
  }
  if (activePriceTier) {
    if (activePriceTier === '£25+') {
      filtered = filtered.filter(w => w.price >= 25);
    } else {
      const limit = parseFloat(activePriceTier.replace(/[^0-9.]/g, ''));
      filtered = filtered.filter(w => w.price <= limit);
    }
  }

  return filtered.slice(0, 5).map(w => 
    `${w.name}|£${w.price}|${w.retailer}|${w.rating}|${w.tags}`
  ).join('\n');
};

const getSystemInstruction = (
  activeRetailers: string[], 
  activeWineTypes: string[], 
  activePriceTier: string | null,
  userQuery: string
) => {
  const customKb = localStorage.getItem('vintellect_custom_kb');
  const dbContext = getContextualWineData(customKb, activeRetailers, activeWineTypes, activePriceTier, userQuery);

  const retailerConstraint = activeRetailers.length > 0 
    ? `IMPORTANT: ONLY recommend wines from: ${activeRetailers.join(', ')}.`
    : `The user can shop at any UK retailer.`;

  return `
You are Vintellect, an elite UK Sommelier. Tone: Expert, Authoritative, British English.
CONTEXT:
${dbContext}
CONSTRAINT: ${retailerConstraint}
`;
};

export const generateWineResponseStream = async (
  history: Message[], 
  activeSupermarkets: string[],
  activeWineTypes: string[],
  activePriceTier: string | null,
  onChunk: (text: string) => void
): Promise<{ sources: Source[] }> => {
  const genAI = getAI();
  
  // VERIFIED WORKING MODEL: Gemini 2.0 Flash
  // This model definitely exists (API verified) and is paid-tier enabled.
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash", 
    systemInstruction: getSystemInstruction(activeSupermarkets, activeWineTypes, activePriceTier, ""),
  });

  const lastUserMessage = [...history].reverse().find(m => m.role === 'user')?.content || "Hello";

  // FILTER: Keep the chat clean
  const validHistory = history.slice(0, -1)
    .filter((msg, index) => {
      if (index === 0 && msg.role === 'assistant') return false;
      return true;
    })
    .map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content || "" }]
    }));

  const chat = model.startChat({
    history: validHistory,
    generationConfig: {
      temperature: 0.1,
    }
  });

  try {
    const result = await chat.sendMessageStream(lastUserMessage);

    let fullText = "";
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullText += chunkText;
      onChunk(fullText);
    }
    return { sources: [] };
  } catch (error) {
    console.error("Gemini Stream Error:", error);
    throw error;
  }
};

export const analyzeImage = async (prompt: string, base64Data: string, mimeType: string): Promise<string> => {
  const genAI = getAI();
  // Using 2.0 Flash for Vision as well
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const result = await model.generateContent([
    prompt,
    { inlineData: { data: base64Data, mimeType } }
  ]);
  return result.response.text();
};

export const generateImage = async (prompt: string): Promise<string | null> => {
  return null; 
};