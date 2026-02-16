
import { PriceTier, Wine } from './types';

export const COLOURS = {
  BURGUNDY: '#800020',
  CREAMY: '#F7E1A1',
  SLATE: '#475569',
};

export const SUPERMARKETS = [
  "Tesco", "Sainsbury's", "Waitrose", "Majestic", "ASDA", "Morrisons", "Aldi", "Lidl", "M&S", "Co-op"
];

export const WINE_TYPES = ["Red", "White", "Rosé", "Sparkling", "Dessert", "Fortified"];

export const PRICE_TIERS: PriceTier[] = [
  { label: '< £6', limit: 6, description: 'Budget Brilliance' },
  { label: '< £10', limit: 10, description: 'Weekend Winners' },
  { label: '< £15', limit: 15, description: 'Elevated Evenings' },
  { label: '< £25', limit: 25, description: 'Fine Dining' },
  { label: '£25+', limit: 99999, description: 'Prestige Collection' },
];

export const WINE_DATABASE: Wine[] = [
  { name: "Jam Shed Shiraz", vintage: "NV", price: 5.5, retailer: "Tesco", type: "Red", rating: 3.8, tags: "Sweet, fruity, easy-drinking, pizza, bbq, budget" },
  { name: "19 Crimes Red Wine", vintage: "NV", price: 8, retailer: "Tesco", type: "Red", rating: 4.1, tags: "Bold, dark fruit, barbecue, steak, rich" },
  { name: "Hardys VR Cabernet Sauvignon", vintage: "2024", price: 6.5, retailer: "Tesco", type: "Red", rating: 3.9, tags: "Blackcurrant, easy, everyday, burgers" },
  { name: "Wolf Blass Yellow Label Shiraz", vintage: "2023", price: 8.5, retailer: "Tesco", type: "Red", rating: 4, tags: "Pepper, dark fruit, BBQ, bold" },
  { name: "Trivento Malbec Reserve", vintage: "2023", price: 9, retailer: "Tesco", type: "Red", rating: 4.2, tags: "Plum, vanilla, steak, Argentine" },
  { name: "Tesco Finest Barolo", vintage: "2020", price: 20, retailer: "Tesco", type: "Red", rating: 4.5, tags: "Nebbiolo, tannic, truffle, special" },
  { name: "Tesco Finest Margaux", vintage: "2019", price: 25, retailer: "Tesco", type: "Red", rating: 4.6, tags: "Cabernet, elegant, special occasion" },
  { name: "Mud House Sauvignon Blanc", vintage: "2024", price: 7, retailer: "Tesco", type: "White", rating: 4, tags: "Citrus, gooseberry, seafood, vegetarian, crisp" },
  { name: "Tesco Finest Chablis", vintage: "2023", price: 14, retailer: "Tesco", type: "White", rating: 4.3, tags: "Oyster shell, citrus, oysters, premium" },
  { name: "La Vieille Ferme Rose", vintage: "NV", price: 7.25, retailer: "Tesco", type: "Rosé", rating: 3.9, tags: "Dry, strawberry, summer salad, light, versatile" },
  { name: "Tesco Champagne Brut", vintage: "NV", price: 18, retailer: "Tesco", type: "Sparkling", rating: 4.2, tags: "Brioche, apple, celebration, French" },
  { name: "Oyster Bay Sauvignon Blanc", vintage: "2024", price: 9, retailer: "Sainsbury's", type: "White", rating: 4, tags: "Zesty, citrus, gooseberry, seafood, goats cheese, acidity" },
  { name: "Sainsbury's TTD Rioja Reserva", vintage: "2019", price: 10, retailer: "Sainsbury's", type: "Red", rating: 4.1, tags: "Oak, vanilla, aged, quality" },
  { name: "Catena Malbec", vintage: "2022", price: 13.5, retailer: "Waitrose", type: "Red", rating: 4.2, tags: "Bold, plum, oak, steak, roast beef, sunday roast" },
  { name: "The Ned Sauvignon Blanc", vintage: "2024", price: 8, retailer: "Waitrose", type: "White", rating: 4, tags: "Tropical, grassy, seafood, everyday" },
  { name: "Whispering Angel Rosé", vintage: "2023", price: 16, retailer: "ASDA", type: "Rosé", rating: 4.2, tags: "Provence, pale, elegant, summer parties" },
  { name: "ASDA Extra Special Mendoza Malbec", vintage: "2021", price: 11, retailer: "ASDA", type: "Red", rating: 4.1, tags: "Plum, chocolate, beef, Argentine" },
  { name: "Morrisons The Best Douro Reserva", vintage: "2021", price: 11, retailer: "Morrisons", type: "Red", rating: 4.2, tags: "Blackcurrant, vanilla, venison, rich" },
  { name: "Penfolds Max's Shiraz", vintage: "2021", price: 18, retailer: "Morrisons", type: "Red", rating: 4.5, tags: "Dark fruit, spice, premium, steak" },
  { name: "Codorniu Cuvee 150th Brut", vintage: "NV", price: 9.99, retailer: "Lidl", type: "Sparkling", rating: 4.2, tags: "Nougat, apple, honey, celebration" },
  { name: "Lidl Châteauneuf-du-Pape", vintage: "2021", price: 16, retailer: "Lidl", type: "Red", rating: 4.2, tags: "Grenache, spice, game, premium Rhône" },
  { name: "Specially Selected Barossa Chardonnay", vintage: "2023", price: 6.49, retailer: "Aldi", type: "White", rating: 4, tags: "Buttery, peanut, roast chicken, rich" },
  { name: "Buenas Vides Organic Malbec", vintage: "2023", price: 7.99, retailer: "Aldi", type: "Red", rating: 4.2, tags: "Violet, blueberry, chocolate, organic" },
  { name: "M&S Found Encruzado", vintage: "2024", price: 8.5, retailer: "M&S", type: "White", rating: 4.2, tags: "Pear, herbs, lemon, pulled pork, textured" },
  { name: "M&S Found Kratosija", vintage: "2024", price: 8.5, retailer: "M&S", type: "Red", rating: 4.1, tags: "Berry, unoaked, vibrant, Macedonia" },
  { name: "Irresistible Salice Salentino Riserva", vintage: "2021", price: 8.15, retailer: "Co-op", type: "Red", rating: 4.2, tags: "Mocha, grilled meat, chocolate, rich" },
  { name: "Collin Bourisset Fleurie", vintage: "2023", price: 14, retailer: "Co-op", type: "Red", rating: 4.5, tags: "Floral, elegant, Beaujolais, chicken" },
  { name: "Bread & Butter Chardonnay", vintage: "2023", price: 15, retailer: "Majestic Wine", type: "White", rating: 4, tags: "Creamy, vanilla, chicken, California" },
  { name: "Bouvet Ladubay Saumur Brut", vintage: "NV", price: 10.5, retailer: "Majestic Wine", type: "Sparkling", rating: 4.2, tags: "Crisp, apple, celebration, Loire" }
];
