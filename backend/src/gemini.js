import { GoogleGenerativeAI } from '@google/generative-ai';
import { prepare } from './db.js';
import Fuse from 'fuse.js';

let productCache = null;
let fuse = null;

function loadProductCache() {
  if (productCache) return;

  const products = prepare('SELECT name, category, price, stock FROM products WHERE active = 1').all();

  const index = products.map(p => {
    // Strip item code, extract core words
    const cleanName = p.name.replace(/^[A-Z0-9]+ - /, '').replace(/^[A-Z0-9]+\s+-\s+/, '');
    // Create searchable tokens: name + category + individual words
    const words = cleanName.toLowerCase().split(/\s+/).filter(w => w.length > 1);
    const uniqueWords = [...new Set(words)];

    return {
      name: p.name,
      cleanName,
      category: p.category,
      price: p.price,
      stock: p.stock,
      keywords: uniqueWords.join(' '),
    };
  });

  fuse = new Fuse(index, {
    keys: [
      { name: 'cleanName', weight: 4 },
      { name: 'keywords', weight: 2 },
      { name: 'category', weight: 1 },
    ],
    threshold: 0.45,
    distance: 100,
    minMatchCharLength: 2,
    includeScore: true,
    shouldSort: true,
  });

  productCache = index;
}

function normalizeText(text) {
  // Remove common suffixes
  return text
    .replace(/s\b/g, '')       // plurals: bungas -> bunga
    .replace(/es\b/g, '')      // plurals: boxes -> box
    .replace(/ies\b/g, 'y')    // plurals: batteries -> battery
    .replace(/ing\b/g, '')     // gerunds
    .replace(/ed\b/g, '')      // past tense
    .replace(/er\b/g, '')      // comparative
    .trim();
}

function getCompanyInfo() {
  const settings = prepare('SELECT * FROM settings').all();
  const info = {};
  for (const s of settings) info[s.key] = s.value;
  return info;
}

function buildSystemPrompt() {
  const c = getCompanyInfo();

  return `You are the Mineazy Chatbot, a WhatsApp Business Assistant for ${c.company_name || 'a hardware and industrial supplies company'}.

Company Info:
Name: ${c.company_name || 'N/A'}
Phone: ${c.company_phone || 'N/A'}
Email: ${c.company_email || 'N/A'}
Address: ${c.company_address || 'N/A'}
Hours: ${c.business_hours || 'Mon-Fri 8am-5pm, Sat 8am-12pm'}
${c.company_description ? `About: ${c.company_description}` : ''}
${c.company_tagline ? `Tagline: ${c.company_tagline}` : ''}

When asked about the company, location, hours, or contact info, respond using ONLY the company info above.
When asked about delivery, say delivery is available across Zambia within 2-5 business days.

When listing products, use this EXACT format with proper spacing:

*PRODUCT NAME*
PRICE: $XX.XX
STOCK: XX units

Number each product (1. 2. 3.)

RULES:
1. Be professional, concise, and helpful.
2. When a customer asks about a product, give accurate prices in USD ($) and stock from the product list.
3. If products match, list up to 3-4 relevant items in the format above.
4. If a customer requests a quotation, include QUOTE_REQUEST in your response and ask for: name, company, phone number, product, and quantity.
5. If you cannot answer or nothing matches, offer to connect to a human. Include HUMAN_NEEDED.
6. If the customer types "human", "agent", "salesperson", or "support", respond warmly and include HUMAN_NEEDED.
7. Never make up prices or stock levels.`;
}

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
  if (!query || query.trim().length < 2) return { results: [], suggestion: null, confidence: 0 };

  loadProductCache();

  const originalQuery = query.trim();
  const normalizedQuery = normalizeText(originalQuery.toLowerCase());

  // Step 1: Try exact match with Fuse.js
  let results = fuse.search(originalQuery, { limit: 20 });

  // Step 2: If no good results, try with normalized (de-pluralized) query
  if (results.length === 0 || results[0].score > 0.3) {
    const normResults = fuse.search(normalizedQuery, { limit: 20 });
    if (normResults.length > 0 && (results.length === 0 || normResults[0].score < results[0].score)) {
      results = normResults;
    }
  }

  // Step 3: If still poor, split into words and search each
  if (results.length === 0 || results[0].score > 0.35) {
    const words = originalQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (words.length > 1) {
      for (const word of words) {
        const wordResults = fuse.search(normalizeText(word), { limit: 10 });
        for (const r of wordResults) {
          if (r.score < 0.35 && !results.find(e => e.item.name === r.item.name)) {
            results.push(r);
          }
        }
      }
      // Re-sort by score
      results.sort((a, b) => a.score - b.score);
      results = results.slice(0, 20);
    }
  }

  // Extract best score for confidence
  const bestScore = results.length > 0 ? results[0].score : 1;
  const confidence = Math.round((1 - bestScore) * 100);

  // Map back to product format
  let products = results.map(r => ({
    name: r.item.name,
    cleanName: r.item.cleanName,
    category: r.item.category,
    price: r.item.price,
    stock: r.item.stock,
    score: r.score,
  }));

  // Step 4: If confidence below 60%, try to find the closest matching product name
  if (confidence < 60 && products.length > 0) {
    const fuzzyResults = fuse.search(originalQuery, { limit: 5 });
    if (fuzzyResults.length > 0) {
      const bestMatch = fuzzyResults[0].item.cleanName;
      const queryClean = originalQuery
        .replace(/^i'?m looking for\s*/i, '')
        .replace(/^do you (have|sell|stock)\s*/i, '')
        .trim();

      return {
        results: products.slice(0, 15),
        suggestion: `Did you mean *${bestMatch}*?`,
        confidence,
      };
    }
  }

  // Step 5: If low confidence and few results, find better suggestion
  if (confidence < 40 && products.length <= 3) {
    const broaderResults = fuse.search(originalQuery, { limit: 3, threshold: 0.6 });
    if (broaderResults.length > 0 && broaderResults[0].item.cleanName !== products[0]?.cleanName) {
      return {
        results: products.slice(0, 10),
        suggestion: `Did you mean *${broaderResults[0].item.cleanName}*?`,
        confidence,
      };
    }
  }

  return {
    results: products,
    suggestion: confidence < 70 && products.length > 0 ? `Showing closest matches:` : null,
    confidence,
  };
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

  // Check for greetings or company info requests
  const infoWords = ['who are you', 'about', 'location', 'address', 'hours', 'contact', 'phone number', 'email', 'where are you', 'company info', 'business hours', 'open'];
  if (msgLower.match(/^(hi|hey|hello|good morning|good afternoon|good evening)\b/) || infoWords.some(w => msgLower.includes(w))) {
    const c = getCompanyInfo();
    if (msgLower.match(/^(hi|hey|hello|good morning|good afternoon|good evening)\b/) && !infoWords.some(w => msgLower.includes(w))) {
      return `Welcome to ${c.company_name || 'Mineazy Chatbot'}! I can help you find hardware and industrial supplies, check prices and availability, or prepare a quotation. What are you looking for today?`;
    }
    // Company info response
    const infoParts = [];
    if (c.company_name) infoParts.push(`*${c.company_name}*`);
    if (c.company_tagline) infoParts.push(`_${c.company_tagline}_`);
    if (c.company_description) infoParts.push(c.company_description);
    if (c.company_phone) infoParts.push(`Phone: ${c.company_phone}`);
    if (c.company_email) infoParts.push(`Email: ${c.company_email}`);
    if (c.company_address) infoParts.push(`Address: ${c.company_address}`);
    if (c.business_hours) infoParts.push(`Hours: ${c.business_hours}`);
    return infoParts.join('\n');
  }

  // If we have matching products, use Gemini or fallback
  if (results.length > 0) {
    const intro = suggestion || `Here is what I found:`;

    if (model) {
      const productLines = results.slice(0, 6).map((p, i) => {
        const displayName = p.cleanName || p.name.replace(/^[A-Z0-9]+ - /, '').replace(/^[A-Z0-9]+\s+-\s+/, '');
        return `${i + 1}. ${displayName} | Price: $${p.price.toFixed(2)} | Stock: ${p.stock}`;
      }).join('\n');

      const prompt = `${buildSystemPrompt()}\n\nAvailable matching products:\n${productLines}\n\n${results.length > 6 ? `(${results.length} total matches, showing top 6)` : ''}\n\nCustomer message: "${msg}"\n\nAssistant:`;

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
      const name = p.cleanName || p.name.replace(/^[A-Z0-9]+ - /, '').replace(/^[A-Z0-9]+\s+-\s+/, '');
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
    const prompt = `${buildSystemPrompt()}\n\nCustomer message: "${msg}"\n\nNo products were found matching this query in the catalog. Respond helpfully and ask them to be more specific or try different keywords.`;
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
