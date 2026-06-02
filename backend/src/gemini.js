import { GoogleGenerativeAI } from '@google/generative-ai';
import { prepare } from './db.js';

const SYSTEM_PROMPT = `You are the Mineazy Chatbot, a WhatsApp Business Assistant for a hardware and industrial supplies company. You help customers find products, check prices, and request quotations.

When listing products, use this EXACT format with proper spacing:

*PRODUCT NAME*
PRICE: $XX.XX
STOCK: XX units

*PRODUCT NAME*
PRICE: $XX.XX
STOCK: XX units

Each product separated by a blank line. Product names in *bold* markers. End with: "Would you like a quotation on any of these?"

RULES:
1. Be professional, concise, and helpful.
2. When a customer asks about a product, give accurate prices in USD ($) and stock from the product list.
3. If products match, list up to 3-4 relevant items in the format above.
4. If a customer requests a quotation, include QUOTE_REQUEST in your response and ask for: name, company, phone number, product, and quantity.
5. If you cannot answer or nothing matches, offer to connect to a human. Include HUMAN_NEEDED.
6. If the customer types "human", "agent", "salesperson", or "support", respond warmly and include HUMAN_NEEDED.
7. Never make up prices or stock levels.
8. Delivery is available across Zambia within 2-5 business days.`;

let genAI = null;
let model = null;

export function initGemini(apiKey) {
  if (!apiKey || apiKey === 'your-gemini-api-key') {
    console.warn('Gemini API key not configured. AI responses will use fallback mode.');
    return false;
  }
  genAI = new GoogleGenerativeAI(apiKey);
  model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  return true;
}

export function searchProducts(query) {
  if (!query || query.trim().length < 2) return { results: [], suggestion: null };

  const keywords = query.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1);

  if (keywords.length === 0) return { results: [], suggestion: null };

  // First: exact keyword search
  const exactPlaceholders = keywords.map(() => 'name LIKE ?').join(' OR ');
  const exactParams = keywords.map(k => `%${k}%`);
  const exactSql = `SELECT name, category, price, stock FROM products WHERE active = 1 AND (${exactPlaceholders}) ORDER BY price LIMIT 30`;

  try {
    let results = prepare(exactSql).all(exactParams);

    // Score results
    let scored = scoreResults(results, keywords);

    // If no results, try fuzzy matching each keyword
    if (scored.length === 0) {
      for (const kw of keywords) {
        if (kw.length < 3) continue;
        const first = kw[0];
        const last = kw[kw.length - 1];

        // Build a pattern: words that start with same letter and end with same letter
        const fuzzySql = `SELECT DISTINCT name, category, price, stock FROM products WHERE active = 1 AND (name LIKE ? OR name LIKE ? OR name LIKE ?) ORDER BY price LIMIT 30`;
        const fuzzyParams = [`% ${kw}%`, `%${first}%${last}%`, `%${kw.slice(0, 2)}%`];

        const fuzzyResults = prepare(fuzzySql).all(fuzzyParams);
        if (fuzzyResults.length > 0) {
          const fuzzyScored = scoreResults(fuzzyResults, keywords);
          // Find the closest matching word in product names for this keyword
          const closestMatch = findClosestWord(kw, fuzzyResults);

          return {
            results: fuzzyScored.slice(0, 20),
            suggestion: `Did you mean *${closestMatch}*?`,
            original: kw,
          };
        }
      }

      // Last resort: search by individual characters
      if (keywords.length === 1 && keywords[0].length >= 3) {
        const kw = keywords[0];
        const chars = kw.split('').join('%');
        const charSql = `SELECT name, category, price, stock FROM products WHERE active = 1 AND name LIKE ? ORDER BY price LIMIT 20`;
        const charResults = prepare(charSql).all([`%${chars}%`]);
        if (charResults.length > 0) {
          const charScored = scoreResults(charResults, [kw]);
          const closest = findClosestWord(kw, charResults);
          return {
            results: charScored.slice(0, 20),
            suggestion: `Did you mean *${closest}*?`,
            original: kw,
          };
        }
      }

      return { results: [], suggestion: null };
    }

    scored.sort((a, b) => b.score - a.score);
    return { results: scored.slice(0, 20), suggestion: null };
  } catch (e) {
    console.error('Product search error:', e.message);
    return { results: [], suggestion: null };
  }
}

function scoreResults(results, keywords) {
  return results.map(r => {
    const nameLower = r.name.toLowerCase();
    const nameWords = nameLower.split(/\s+/);
    let score = 0;
    for (const kw of keywords) {
      if (nameLower.includes(kw)) score += 1;
      if (nameWords.includes(kw)) score += 2;
      if (nameLower.startsWith(kw)) score += 3;
    }
    return { ...r, score };
  });
}

function findClosestWord(keyword, results) {
  // Find the closest matching word from product names
  const kw = keyword.toLowerCase();
  let best = null;
  let bestScore = 0;

  for (const r of results.slice(0, 30)) {
    const nameLower = r.name.toLowerCase();
    const words = nameLower.split(/\s+/);
    for (const w of words) {
      if (w.length < 2) continue;
      let score = 0;
      // Same first letter
      if (w[0] === kw[0]) score += 3;
      // Same last letter
      if (w[w.length - 1] === kw[kw.length - 1]) score += 2;
      // Same length (approximate)
      if (Math.abs(w.length - kw.length) <= 2) score += 1;
      // Contains at least 2 chars from keyword
      const commonChars = [...new Set(kw)].filter(c => w.includes(c)).length;
      score += commonChars;

      if (score > bestScore) {
        bestScore = score;
        best = w;
      }
    }
  }
  return best || keyword;
}

export async function getAIResponse(userMessage) {
  const msg = userMessage.trim();
  const msgLower = msg.toLowerCase();

  // Check for human escalation first
  const escalateWords = ['human', 'agent', 'salesperson', 'speak to someone', 'talk to', 'real person'];
  if (escalateWords.some(w => msgLower.includes(w))) {
    return "I'll connect you with a member of our sales team right away. A representative will be with you shortly. HUMAN_NEEDED";
  }

  // Search products
  const { results, suggestion } = searchProducts(msg);

  // Check for quotation intent
  const quoteWords = ['quote', 'quotation', 'price', 'how much', 'cost', 'buy', 'purchase', 'order'];
  const wantsQuote = quoteWords.some(w => msgLower.includes(w));

  // Check for greetings
  if (msgLower.match(/^(hi|hey|hello|good morning|good afternoon|good evening)\b/)) {
    return "Welcome to Mineazy Chatbot! I can help you find hardware and industrial supplies, check prices and availability, or prepare a quotation. What are you looking for today?";
  }

  // If we have matching products, use Gemini or fallback
  if (results.length > 0) {
    const intro = suggestion || `Here is what I found:`;

    if (model) {
      const productLines = results.slice(0, 6).map((p, i) => {
        const displayName = p.name.replace(/^[A-Z0-9]+ - /, '').replace(/^[A-Z0-9]+\s+-\s+/, '');
        return `${i + 1}. ${displayName} | Price: $${p.price.toFixed(2)} | Stock: ${p.stock}`;
      }).join('\n');

      const prompt = `${SYSTEM_PROMPT}\n\nAvailable matching products:\n${productLines}\n\n${results.length > 6 ? `(${results.length} total matches, showing top 6)` : ''}\n\nCustomer message: "${msg}"\n\nAssistant:`;

      try {
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (e) {
        console.error('Gemini error:', e.message);
      }
    }

    // Fallback: format product results cleanly with numbering
    const top = results.slice(0, 4);
    let response = `${intro}\n\n`;
    top.forEach((p, i) => {
      const name = p.name.replace(/^[A-Z0-9]+ - /, '').replace(/^[A-Z0-9]+\s+-\s+/, '');
      response += `${i + 1}. *${name}*\nPRICE: $${p.price.toFixed(2)}\nSTOCK: ${p.stock} units\n\n`;
    });
    if (results.length > 4) {
      response += `...and more matches. Can you be more specific?`;
    } else {
      response += `Would you like a quotation on any of these?`;
    }
    if (wantsQuote) response += '\n\nQUOTE_REQUEST';
    return response;
  }

  // No products found
  if (model) {
    const prompt = `${SYSTEM_PROMPT}\n\nCustomer message: "${msg}"\n\nNo products were found matching this query in the catalog. Respond helpfully and ask them to be more specific or try different keywords.`;
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (e) {
      console.error('Gemini error:', e.message);
    }
  }

  return "I couldn't find that in our catalog. Could you check the spelling or try different keywords? Type 'human' to speak with a sales representative.";
}

export function extractQuoteInfo(messages) {
  const fullText = messages.join(' ');
  const info = {};
  const nameMatch = fullText.match(/name\s*(?:is|:)?\s*([A-Za-z\s]{2,30}?)(?:\s*(?:company|from|phone|contact|at|number|working|my|\d|,|\.|$))/i);
  const companyMatch = fullText.match(/company\s*(?:name\s*)?(?:is|:)?\s*([A-Za-z\s]{2,40}?)(?:\s*(?:phone|contact|number|my|from|location|\d|,|\.|$))/i);
  const phoneMatch = fullText.match(/(?:phone|contact|number|call)(?:\s*(?:is|:|\s))?\s*(\+?[\d\s-]{7,15})/i);
  const productMatch = fullText.match(/(?:need|want|looking for|interested in|product|item)\s+([A-Za-z0-9\s-]{3,50}?)(?:\s*(?:quantity|qty|how many|\d|,|\.|$))/i);
  const qtyMatch = fullText.match(/(?:quantity|qty|how many|pieces|units|need)\s*(?:is|:)?\s*(\d+)/i);

  if (nameMatch) info.name = nameMatch[1].trim();
  if (companyMatch) info.company = companyMatch[1].trim();
  if (phoneMatch) info.phone = phoneMatch[1].trim();
  if (productMatch) info.product = productMatch[1].trim();
  if (qtyMatch) info.quantity = parseInt(qtyMatch[1]);

  return info;
}
