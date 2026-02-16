export interface Wine {
  name: string;
  price: number;
  retailer: string;
  vintage: string;
  type: string;
  rating: number | string;
  tags: string;
  imageUrl?: string;
  awards?: string[];
  criticScores?: { critic: string; score: string }[];
}

export interface Source {
  title: string;
  uri: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  displayContent?: string;
  timestamp: Date;
  imageUrl?: string;
  isError?: boolean;
  retryData?: { prompt: string; image?: string };
  sources?: Source[];
}

export interface PriceTier {
  label: string;
  limit: number;
  description: string;
}

/**
 * Added AppView enum to resolve the import error in components/Dashboard.tsx
 * This enum defines the different views available in the application.
 */
export enum AppView {
  DASHBOARD = 'DASHBOARD',
  CHATS = 'CHATS',
  VISION = 'VISION',
  CREATOR = 'CREATOR'
}