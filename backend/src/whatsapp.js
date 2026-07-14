import {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { prepare } from './db.js';
import { getAIResponse, searchProducts } from './gemini.js';
import { sendCustomerToERP, sendQuotationToERP, sendTicketToERP, sendMessageToERP } from './erp.js';

// Conversation state tracker for purchase flow
const purchaseState = new Map(); // phone -> { step, product, price, quantity, quoteId, items }
const branchContext = new Map();  // phone -> { branch, awaitingBranch, productQuery }

let branchesCache = null;

function getBranches() {
  if (!branchesCache) {
    const row = prepare("SELECT value FROM settings WHERE key = 'branches'").get();
    branchesCache = row ? JSON.parse(row.value) : [];
  }
  return branchesCache;
}

function findNearestBranch(location) {
  const branches = getBranches();
  const loc = location.toLowerCase().trim();
  // Exact match first
  for (const b of branches) {
    if (loc.includes(b.city.toLowerCase()) || loc.includes(b.area.toLowerCase())) {
      return b;
    }
  }
  // Partial match
  for (const b of branches) {
    if (b.city.toLowerCase().includes(loc) || b.area.toLowerCase().includes(loc) || loc.includes(b.city.toLowerCase().substring(0, 3))) {
      return b;
    }
  }
  return branches[0]; // Default to first branch (HQ)
}

function getCompanySetting(key) {
  const row = prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : '';
}

function generateInvoice(invoiceNumber, items, customer, branch) {
  const tin = getCompanySetting('company_tin');
  const vat = getCompanySetting('company_vat');
  const companyName = getCompanySetting('company_name');
  const companyPhone = getCompanySetting('company_phone');
  const companyEmail = getCompanySetting('company_email');

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const taxRate = 0.155;
  const taxAmount = subtotal * taxRate;
  const grandTotal = subtotal + taxAmount;

  let itemLines = '';
  items.forEach((item, idx) => {
    itemLines += `\`${String(idx + 1).padEnd(3)}\` ${item.product.padEnd(20).substring(0, 20)} ${String(item.quantity).padStart(3)}  $${item.price.toFixed(2).padStart(8)}  $${item.total.toFixed(2).padStart(8)}\n`;
  });
  itemLines += `                               ──────────\n`;
  itemLines += `                               SUBTOTAL: $${subtotal.toFixed(2)}\n`;
  itemLines += `                               TAX (15.5%): $${taxAmount.toFixed(2)}\n`;
  itemLines += `                               TOTAL: $${grandTotal.toFixed(2)}`;

  return `╔══════════════════════════════════╗
║   *${companyName.toUpperCase()}*
║   Fiscal Tax Invoice
║   Invoice #: ${invoiceNumber}
║   TIN: ${tin}
║   VAT: ${vat}
╚══════════════════════════════════╝

*CUSTOMER:*
Name: ${customer.name || 'Customer'}
Phone: ${customer.phone || ''}
Location: ${branch.city}

──────────────────────────────────
Item Description         Qty  Price    Total
${itemLines}
──────────────────────────────────

Currency: USD
Status: Pending Payment

📍 *Collect at:*
${branch.name}
${branch.address}
📞 ${branch.phone}

_Verification: https://fdms.zimra.co.zw_
_Device: mineazy006_`;
}

let sock = null;
let connectionState = 'disconnected';
let qrCallback = null;

export function getConnectionState() {
  return connectionState;
}

export function setQRCallback(cb) {
  qrCallback = cb;
}

export async function startWhatsApp() {
  try {
    const { default: pino } = await import('pino');
    const logger = pino({ level: 'warn' });
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

    sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      logger,
      printQRInTerminal: true,
      browser: ['MineAzy', 'Chrome', '1.0.0'],
    });

    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
      console.log(`[WhatsApp] Connection update: ${connection}`);
      if (qr) {
        connectionState = 'qr';
        if (qrCallback) qrCallback({ type: 'qr', qr });
      }
      if (connection === 'open') {
        connectionState = 'connected';
        console.log('WhatsApp connected successfully!');
        if (qrCallback) qrCallback({ type: 'connected' });
      }
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const reason = lastDisconnect?.error?.message || 'unknown';
        console.log('WhatsApp disconnected. Reason:', reason, 'Status:', statusCode);
        const shouldReconnect = lastDisconnect?.error instanceof Boom
          && statusCode !== DisconnectReason.loggedOut;
        connectionState = 'disconnected';
        if (shouldReconnect) {
          setTimeout(() => startWhatsApp(), 5000);
        } else {
          console.log('Logged out. Please restart and scan QR again.');
          if (qrCallback) qrCallback({ type: 'logout' });
        }
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const msg of messages) {
        const phone = msg.key.remoteJid;
        console.log(`[WhatsApp] Message from ${phone}: hasMsg=${!!msg.message}, fromMe=${msg.key.fromMe}`);
        if (!msg.message || msg.key.fromMe) continue;
        // Only respond to direct 1-on-1 chats, not groups, broadcasts, newsletters, or channels
        const isDirect = phone.endsWith('@s.whatsapp.net') || phone.endsWith('@lid');
        if (!isDirect || phone.includes('@g.us') || phone.includes('@broadcast') || phone.includes('@newsletter') || phone === 'status@broadcast') continue;

        // Check for interactive list response
        if (msg.message.listResponseMessage) {
          const selected = msg.message.listResponseMessage.singleSelectReply?.selectedRowId;
          const title = msg.message.listResponseMessage.title || '';
          await handleInteractiveResponse(phone, selected, title, msg.pushName || 'Customer');
          continue;
        }

        // Check for button response
        if (msg.message.buttonsResponseMessage) {
          const buttonId = msg.message.buttonsResponseMessage.selectedButtonId;
          const buttonText = msg.message.buttonsResponseMessage.selectedDisplayText;
          await handleButtonResponse(phone, buttonId, buttonText, msg.pushName || 'Customer');
          continue;
        }

        // Regular text message
        const textMessage = msg.message.conversation
          || msg.message.extendedTextMessage?.text
          || msg.message.imageMessage?.caption;

        if (!textMessage) continue;
        await handleIncomingMessage(phone, textMessage, msg.pushName || 'Customer');
      }
    });
  } catch (err) {
    console.error('WhatsApp not available:', err.message);
  }
}

async function getOrCreateCustomer(phone, name) {
  const cleanPhone = phone.replace('@s.whatsapp.net', '').replace('@lid', '');
  let customer = prepare('SELECT * FROM customers WHERE phone = ?').get(cleanPhone);
  if (!customer) {
    const result = prepare('INSERT INTO customers (phone, name) VALUES (?, ?)').run(cleanPhone, name);
    customer = { id: result.lastInsertRowid, phone: cleanPhone, name };
    sendCustomerToERP(customer);
  } else {
    prepare("UPDATE customers SET last_interaction = CURRENT_TIMESTAMP, name = COALESCE(NULLIF(?, ''), name) WHERE id = ?")
      .run(name, customer.id);
  }
  return customer;
}

function getOrCreateConversation(customerId, phone) {
  const cleanPhone = phone.replace('@s.whatsapp.net', '').replace('@lid', '');
  let conv = prepare("SELECT * FROM conversations WHERE customer_id = ? AND (status = 'active' OR status = 'human') ORDER BY id DESC LIMIT 1")
    .get(customerId);
  if (!conv) {
    const r = prepare("INSERT INTO conversations (customer_id, phone, status) VALUES (?, ?, 'active')")
      .run(customerId, cleanPhone);
    conv = { id: r.lastInsertRowid, status: 'active' };
  } else {
    prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(conv.id);
  }
  return conv;
}

function saveMessage(convId, direction, content, phone, customerName) {
  prepare("INSERT INTO messages (conversation_id, direction, content) VALUES (?, ?, ?)")
    .run(convId, direction, content);
  sendMessageToERP(convId, direction, content, phone, customerName);
}

async function handleInteractiveResponse(phone, selectedId, title, senderName) {
  const customer = await getOrCreateCustomer(phone, senderName);
  const conv = getOrCreateConversation(customer.id, phone);

  saveMessage(conv.id, 'incoming', `[Selected: ${title || selectedId}]`, phone, senderName);

  // Product selection from list
  if (selectedId && selectedId.startsWith('prod_')) {
    const parts = selectedId.replace('prod_', '').split('|');
    const productName = decodeURIComponent(parts[0]);
    const price = parseFloat(parts[1]) || 0;

    // Create quotation
    const quoteResult = prepare("INSERT INTO quotation_requests (customer_id, product_name, quantity, notes, status) VALUES (?, ?, 1, ?, 'new')")
      .run(customer.id, productName, `Price: $${price.toFixed(2)}`);
    sendQuotationToERP(quoteResult.lastInsertRowid);

    // Send delivery/pickup buttons
    await sock.sendMessage(phone, {
      text: `*${productName}* added to your quotation.\n\nPrice: $${price.toFixed(2)}\n\nWould you like this delivered or will you pick it up?`,
      footer: 'Select an option below',
      buttons: [
        { buttonId: `delivery_${customer.id}_${encodeURIComponent(productName)}`, buttonText: { displayText: 'Delivery' }, type: 1 },
        { buttonId: `pickup_${customer.id}_${encodeURIComponent(productName)}`, buttonText: { displayText: 'Pick Up In Person' }, type: 1 },
      ],
      headerType: 0,
    });
    saveMessage(conv.id, 'outgoing', `Product selected: ${productName}. Delivery/Pickup buttons sent.`, phone, senderName);
    return;
  }

  // Delivery option selected from list
  if (selectedId && selectedId.startsWith('delivery_')) {
    await sock.sendMessage(phone, {
      text: '📦 *Delivery*\n\nPlease provide your:\n\n1. Full Name\n2. Phone Number\n3. Delivery Address\n4. Town/City',
    });
    saveMessage(conv.id, 'outgoing', 'Delivery selected. Asking for details.', phone, senderName);
    return;
  }

  if (selectedId && selectedId.startsWith('pickup_')) {
    await sock.sendMessage(phone, {
      text: '🏪 *Pick Up In Person*\n\nPlease provide your name and phone number so we can prepare your order.\n\nOur location will be shared with your quotation.',
    });
    saveMessage(conv.id, 'outgoing', 'Pickup selected. Asking for name/phone.', phone, senderName);
    return;
  }
}

async function handleButtonResponse(phone, buttonId, buttonText, senderName) {
  const customer = await getOrCreateCustomer(phone, senderName);
  const conv = getOrCreateConversation(customer.id, phone);

  saveMessage(conv.id, 'incoming', `[Button: ${buttonText || buttonId}]`, phone, senderName);

  if (buttonId && buttonId.startsWith('delivery_')) {
    const parts = buttonId.replace('delivery_', '').split('_');
    const custId = parseInt(parts[0]);
    const productName = decodeURIComponent(parts.slice(1).join('_'));

    const quote = prepare('SELECT id FROM quotation_requests WHERE customer_id = ? AND status = ? ORDER BY id DESC LIMIT 1')
      .get(custId, 'new');
    if (quote) {
      prepare("UPDATE quotation_requests SET notes = notes || ?, status = 'reviewed' WHERE id = ?")
        .run('\nDelivery selected.', quote.id);
      sendQuotationToERP(quote.id);
    }

    await sock.sendMessage(phone, {
      text: '📦 *Delivery*\n\nPlease reply with:\n\nYour Full Name\nDelivery Address\nTown/City\nPhone Number\n\nExample:\nJohn Banda\nPlot 123, Independence Ave\nKitwe\n0971234567',
    });
    saveMessage(conv.id, 'outgoing', 'Delivery details requested.', phone, senderName);
    return;
  }

  if (buttonId && buttonId.startsWith('pickup_')) {
    const parts = buttonId.replace('pickup_', '').split('_');
    const custId = parseInt(parts[0]);
    const productName = decodeURIComponent(parts.slice(1).join('_'));

    const quote = prepare('SELECT id FROM quotation_requests WHERE customer_id = ? AND status = ? ORDER BY id DESC LIMIT 1')
      .get(custId, 'new');
    if (quote) {
      prepare("UPDATE quotation_requests SET notes = notes || ?, status = 'reviewed' WHERE id = ?")
        .run('\nPickup in person.', quote.id);
      sendQuotationToERP(quote.id);
    }

    await sock.sendMessage(phone, {
      text: `🏪 *Thank you for choosing Mineazy!*\n\nYour order for *${productName}* has been received.\n\n*Order Status:* Pending\n\nYou can pick up your order at our location. Please bring your ID when collecting.\n\nWe'll notify you when your order is ready. For questions, reply with *human*.`,
    });
    saveMessage(conv.id, 'outgoing', `Pickup confirmed for ${productName}. Thank you message sent.`, phone, senderName);
    return;
  }
}

async function handleIncomingMessage(phone, text, senderName) {
  const customer = await getOrCreateCustomer(phone, senderName);
  const conv = getOrCreateConversation(customer.id, phone);

  saveMessage(conv.id, 'incoming', text, phone, senderName);

  // If conversation is in human mode, bot stays silent
  if (conv.status === 'human') return;

  const msgLower = text.toLowerCase().trim();
  const state = purchaseState.get(phone);

  // ---- Clear chat command ----
  if (msgLower === 'clear chat' || msgLower === '/clear' || msgLower === 'reset') {
    purchaseState.delete(phone);
    branchContext.delete(phone);
    prepare('DELETE FROM messages WHERE conversation_id = ?').run(conv.id);
    await sock.sendMessage(phone, { text: '✅ Chat cleared! Starting fresh. How can I help you?' });
    saveMessage(conv.id, 'outgoing', 'Chat cleared by customer', phone, senderName);
    return;
  }

  // ---- Legacy: /buy command still works ----
  if (msgLower.startsWith('/buy')) {
    const searchTerm = msgLower.replace('/buy', '').trim();
    if (!searchTerm) {
      await sock.sendMessage(phone, { text: 'Please specify a product. Example: */buy bunga 1t*' });
      return;
    }
    const { results } = searchProducts(searchTerm);
    if (results.length === 0) {
      await sock.sendMessage(phone, { text: `I couldn't find "*${searchTerm}*" in our catalog. Try a different name.` });
      return;
    }
    const product = results[0];
    const name = product.cleanName || product.name;
    const price = product.price;
    purchaseState.set(phone, { step: 'awaiting_qty', product: name, price, items: [] });
    await sock.sendMessage(phone, {
      text: `*${name}*\nPrice: $${price.toFixed(2)} | Stock: ${product.stock} units\n\nHow many would you like to buy? Reply with a number.`,
    });
    saveMessage(conv.id, 'outgoing', `/buy flow: asking quantity for ${name}`, phone, senderName);
    return;
  }

  // ---- Quantity response ----
  if (state && state.step === 'awaiting_qty') {
    const qty = parseInt(msgLower);
    if (isNaN(qty) || qty < 1) {
      await sock.sendMessage(phone, { text: 'Please enter a valid number. How many do you want?' });
      return;
    }
    const itemTotal = state.price * qty;
    // Add item to the cart
    if (!state.items) state.items = [];
    state.items.push({ product: state.product, price: state.price, quantity: qty, total: itemTotal });
    state.step = 'awaiting_more';
    purchaseState.set(phone, state);
    await sock.sendMessage(phone, {
      text: `Added *${qty}x ${state.product}* ($${itemTotal.toFixed(2)}) to your order.\n\nWould you like anything else? Type a product name to add more, or type *done* to finish your quotation.`,
    });
    saveMessage(conv.id, 'outgoing', `Added to cart: ${state.product} x${qty}. Asking for more items.`, phone, senderName);
    return;
  }

  // ---- "Anything else?" response ----
  if (state && state.step === 'awaiting_more') {
    const doneWords = ['done', 'no', 'that\'s it', 'thats it', 'that is it', 'nothing', 'nope', 'no thanks', 'finish', 'complete', 'checkout'];
    if (doneWords.some(w => msgLower === w || msgLower.startsWith(w))) {
      // Ask for location before creating quotation
      state.step = 'awaiting_location';
      purchaseState.set(phone, state);
      await sock.sendMessage(phone, {
        text: `Great! Just one more thing — which city/town are you in? This helps us find the nearest branch for collection.`,
      });
      saveMessage(conv.id, 'outgoing', 'Asking for location to find nearest branch', phone, senderName);
      return;
    }

    // Customer wants to add another product
    const { results } = searchProducts(text);
    if (results.length > 0) {
      const p = results[0];
      const name = p.cleanName || p.name;
      const price = p.price;
      state.product = name;
      state.price = price;
      state.step = 'awaiting_qty';
      purchaseState.set(phone, state);
      await sock.sendMessage(phone, {
        text: `*${name}*\nPrice: $${price.toFixed(2)} | Stock: ${p.stock} units\n\nHow many would you like?`,
      });
      saveMessage(conv.id, 'outgoing', `Adding to cart: ${name}`, phone, senderName);
      return;
    }

    // Unrecognized product name
    await sock.sendMessage(phone, {
      text: `I couldn't find that product. Try a different name, or type *done* to finish your quotation with the items you've already added.`,
    });
    return;
  }

  // ---- Location response → create invoice ----
  if (state && state.step === 'awaiting_location') {
    const branch = findNearestBranch(text);
    const items = state.items || [];
    const grandTotal = items.reduce((sum, i) => sum + i.total, 0);
    const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
    const itemLines = items.map(i => `• ${i.product} x${i.quantity} @ $${i.price.toFixed(2)} = $${i.total.toFixed(2)}`).join('\n');
    const fullNotes = `${itemLines}\nBranch: ${branch.name}\n${branch.address}\nCustomer: ${customer.name || senderName}\nPhone: ${customer.phone}`;

    const result = prepare(
      "INSERT INTO quotation_requests (customer_id, product_name, quantity, notes, status) VALUES (?, ?, ?, ?, 'new')"
    ).run(customer.id, items.map(i => i.product).join(', '), items.reduce((s, i) => s + i.quantity, 0), fullNotes);

    const quoteId = result.lastInsertRowid;
    purchaseState.delete(phone);

    const invoice = generateInvoice(invoiceNumber, items, { name: customer.name || senderName, phone: customer.phone }, branch);
    await sock.sendMessage(phone, { text: invoice });
    saveMessage(conv.id, 'outgoing', `Invoice ${invoiceNumber} sent. Collect at ${branch.name}`, phone, senderName);
    return;
  }

  // ---- Branch response (if customer was asked about branch) ----
  const br = branchContext.get(phone);
  if (br && br.awaitingBranch) {
    branchContext.set(phone, { branch: text.trim(), awaitingBranch: false });
    const { results } = searchProducts(br.productQuery);
    if (results.length > 0) {
      const p = results[0];
      await sock.sendMessage(phone, {
        text: `In *${text.trim()}* we have *${p.stock}* ${p.cleanName}(s) in stock right now.\n\nPrice: $${p.price.toFixed(2)} each.\n\nWould you like to order? Just tell me how many you want.`,
      });
      saveMessage(conv.id, 'outgoing', `Branch-specific stock for ${p.cleanName} at ${text.trim()}`, phone, senderName);
      return;
    }
  }

  // ---- AI response (handles everything else) ----
  const aiResponse = await getAIResponse(text);

  // action: 'buy' - purchase intent detected
  if (aiResponse.action === 'buy' && aiResponse.product) {
    purchaseState.set(phone, {
      step: 'awaiting_qty',
      product: aiResponse.product.name,
      price: aiResponse.product.price,
      items: [],
    });
    await sock.sendMessage(phone, { text: aiResponse.text });
    saveMessage(conv.id, 'outgoing', `Buy intent: asking quantity for ${aiResponse.product.name}`, phone, senderName);
    return;
  }

  // action: 'escalate' - human needed
  if (aiResponse.action === 'escalate') {
    await sock.sendMessage(phone, { text: aiResponse.text });
    saveMessage(conv.id, 'outgoing', aiResponse.text, phone, senderName);
    // Set conversation to human mode - bot stops responding
    prepare("UPDATE conversations SET status = 'human', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(conv.id);
    const existingTicket = prepare("SELECT * FROM support_tickets WHERE customer_id = ? AND status = 'open'").get(customer.id);
    if (!existingTicket) {
      const ticketResult = prepare("INSERT INTO support_tickets (customer_id, subject, description, status, priority) VALUES (?, ?, ?, 'open', 'medium')")
        .run(customer.id, 'Escalation Request', `Customer requested human assistance.\nName: ${customer.name}\nPhone: ${customer.phone}\nLast message: ${text}`);
      sendTicketToERP(ticketResult.lastInsertRowid);
    }
    return;
  }

  // Check for stock inquiry that might need branch context
  // If user asks "how many X do you have" → maybe ask which branch
  if (aiResponse.action === 'product_list') {
    const stockQuestion = /(?:how many|stock)\s+(.+)/i;
    if (stockQuestion.test(text) && aiResponse.text.includes('STOCK')) {
      const match = text.match(stockQuestion);
      if (match) {
        branchContext.set(phone, { awaitingBranch: true, productQuery: match[1] });
        await sock.sendMessage(phone, {
          text: aiResponse.text + '\n\n_Stock levels may vary by branch. Which branch are you near? (e.g. Maphisa, Kitwe, Lusaka)_',
        });
        saveMessage(conv.id, 'outgoing', 'Asked for branch preference for stock inquiry', phone, senderName);
        return;
      }
    }
  }

  // Default: send the AI response text
  if (aiResponse.text) {
    await sock.sendMessage(phone, { text: aiResponse.text });
    saveMessage(conv.id, 'outgoing', aiResponse.text, phone, senderName);
  }
}

// Called when a sales rep completes a quotation
export async function notifyCustomerQuoteComplete(quoteId) {
  const quote = prepare(`
    SELECT q.*, c.phone, c.name as customer_name
    FROM quotation_requests q
    LEFT JOIN customers c ON q.customer_id = c.id
    WHERE q.id = ?
  `).get(quoteId);

  if (!quote || !quote.phone) return;

  const message = `✅ *Your quotation #${quote.id} has been confirmed!*\n\n*Product:* ${quote.product_name}\n*Quantity:* ${quote.quantity}\n\nThank you for choosing *Mineazy Mining Solutions*!\n\nKindly visit your nearest branch and show them this receipt to pay and collect accordingly.`;

  try {
    const jid = `${quote.phone}@s.whatsapp.net`;
    await sock.sendMessage(jid, { text: message });
    console.log(`Receipt sent to ${quote.phone} for quote #${quote.id}`);
  } catch (e) {
    console.error('Failed to send receipt:', e.message);
  }
}

export async function sendWhatsAppMessage(phone, text) {
  if (!sock) throw new Error('WhatsApp not connected');
  const jid = phone.includes('@s.whatsapp.net') ? phone : `${phone}@s.whatsapp.net`;
  await sock.sendMessage(jid, { text });
  return true;
}
