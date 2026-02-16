import { GoogleGenAI } from "@google/genai";
import { Message, Source } from "../types";
import { WINE_DATABASE } from "../constants";

// 1. CRITICAL FIX: Use Vite environment variable
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey: API_KEY });

// Robust CSV Line Splitter to handle quoted commas
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

/**
 * Optimized Local Lookup (RAG-lite):
 * Reduced to Top 5 matches to prevent iPhone hanging and payload bloat.
 * Stricter keyword matching ensures higher relevance.
 */
const getContextualWineData = (
  customKb: string | null, 
  activeRetailers: string[], 
  activeWineTypes: string[],
  activePriceTier: string | null,
  userQuery: string
) => {
  let sourceData: any[] = [];

  // 1. Load Data efficiently
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

  // 2. High-Performance Filtering Logic
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

  // 3. Stricter Relevancy Ranking
  const query = userQuery.toLowerCase();
  const keywords = query.split(/[\s,]+/).filter(k => k.length > 3 && !['wine', 'best', 'find', 'with', 'what'].includes(k));
  
  if (keywords.length > 0) {
    filtered = filtered.filter(w => {
      const text = `${w.name} ${w.type} ${w.tags}`.toLowerCase();
      return keywords.some(k => text.includes(k));
    });

    filtered.sort((a, b) => {
      const aText = `${a.name} ${a.type} ${a.tags}`.toLowerCase();
      const bText = `${b.name} ${b.type} ${b.tags}`.toLowerCase();
      let aScore = keywords.reduce((s, k) => s + (aText.includes(k) ? 1 : 0), 0);
      let bScore = keywords.reduce((s, k) => s + (bText.includes(k) ? 1 : 0), 0);
      if (bScore !== aScore) return bScore - aScore;
      return (parseFloat(b.rating) || 0) - (parseFloat(a.rating) || 0);
    });
  } else {
    return "";
  }

  // 4. Data Capping: Only send top 5 matches
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
    : `The user can shop at any UK retailer (Waitrose, Tesco, Majestic, etc) or specialist fine wine merchants.`;

  return `
You are Vintellect, an elite UK Sommelier. Tone: Expert, Authoritative, British English.

STRICT SEARCH & PERFORMANCE RULES:
1. ANALYZE IMPLIED QUALITY: Determine if the user is asking for "Everyday" or "Fine Wine".
   - IF <£15 or "Everyday": Use Google Search to check Waitrose, Majestic, and Tesco.
   - IF >£15, "Fine", or "Special Occasion": You MUST search specialist UK merchants (Berry Bros & Rudd, The Wine Society, Lay & Wheeler) and cross-reference reviews from Decanter or Jancis Robinson.
   - FORBIDDEN: Do NOT recommend generic "supermarket own-brand" wines for Fine Wine/Premium requests (e.g., if asking for a Pauillac alternative, do not suggest a basic Tesco red).

2. HONESTY & OUTPUT FORMAT:
   - Use the Top 5 local matches below ONLY if they are highly relevant.
   - If recommending a web-grounded (non-CSV) wine, you MUST use this format: "My cellar is out of [Region/Grape], but Decanter highly rates the [Wine Name] (£Price) available at [Merchant]."
   - For all recommendations, use: [B]Wine Name[/B] (£Price, Retailer).

TOP 5 LOCAL CELLAR MATCHES:
${dbContext || "No strong local matches."}

CONSTRAINTS:
- ${retailerConstraint}
- BOLDING: Use [B]text[/B] tags. NO asterisks (**).
- If user provides [CURRENT MARKET DATA], prioritize value comparisons.
`;
};

export const generateWineResponseStream = async (
  history: Message[], 
  activeSupermarkets: string[],
  activeWineTypes: string[],
  activePriceTier: string | null,
  onChunk: (text: string) => void
): Promise<{ sources: Source[] }> => {
  // 2. CRITICAL FIX: Stable Model Name
  const modelName = 'gemini-1.5-flash';

  const lastUserMessage = [...history].reverse().find(m => m.role === 'user')?.content || "Hello";

  // 3. CRITICAL FIX: Correct Message Format for Gemini 1.5
  const contents = history.map(msg => {
    const parts: any[] = [{ text: msg.content || "" }];
    if (msg.imageUrl) {
      // Handle Base64 images correctly
      const matches = msg.imageUrl.match(/^data:(.+);base64,(.+)$/);
      if (matches) {
        parts.push({ 
          inlineData: { 
            mimeType: matches[1], 
            data: matches[2] 
          } 
        });
      }
    }
    return { role: msg.role === 'assistant' ? 'model' : 'user', parts };
  });

  try {
    const responseStream = await ai.models.generateContentStream({
      model: modelName,
      contents: contents,
      config: {
        systemInstruction: getSystemInstruction(activeSupermarkets, activeWineTypes, activePriceTier, lastUserMessage),
        temperature: 0.1,
        tools: [{ googleSearch: {} }]
      }
    });

    let fullText = "";
    const sources: Source[] = [];

    for await (const chunk of responseStream) {
      if (chunk.text) {
        fullText += chunk.text;
        onChunk(fullText);
      }
      
      const groundingMetadata = (chunk as any).candidates?.[0]?.groundingMetadata;
      if (groundingMetadata?.groundingChunks) {
        groundingMetadata.groundingChunks.forEach((c: any) => {
          if (c.web?.uri && !sources.some(s => s.uri === c.web.uri)) {
            sources.push({ title: c.web.title || 'Source', uri: c.web.uri });
          }
        });
      }
    }

    return { sources };
  } catch (error) {
    console.error("Gemini Stream Error:", error);
    throw error;
  }
};

export const analyzeImage = async (prompt: string, base64Data: string, mimeType: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash', // Flash 1.5 is excellent for vision
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType } },
          { text: prompt }
        ]
      }
    });
    return response.text || "Analysis failed.";
  } catch (error) {
    console.error("Vision Error:", error);
    return "I couldn't analyze that label. Please try again.";
  }
};

export const generateImage = async (prompt: string): Promise<string | null> => {
  // Note: Image generation endpoints vary by access. 
  // If this fails, the UI will just handle null.
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp', // Or 'imagen-3' if available in your project
      contents: { parts: [{ text: prompt }] },
      config: { 
        // @ts-ignore - Image config types might be experimental
        imageConfig: { aspectRatio: "1:1" } 
      }
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.warn("Image Gen Error:", error);
    return null;
  }
};