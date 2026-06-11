import {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { prepare } from './db.js';
import { getAIResponse, searchProducts } from './gemini.js';

// Conversation state tracker for purchase flow
const purchaseState = new Map(); // phone -> { step, product, price, quantity, quoteId }

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
        if (!msg.message || msg.key.fromMe) continue;
        const phone = msg.key.remoteJid;
        // Only respond to direct 1-on-1 chats, not groups, broadcasts, newsletters, or channels
        if (!phone.endsWith('@s.whatsapp.net') || phone.includes('@g.us') || phone.includes('@broadcast') || phone.includes('@newsletter') || phone === 'status@broadcast') continue;

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
  const cleanPhone = phone.replace('@s.whatsapp.net', '');
  let customer = prepare('SELECT * FROM customers WHERE phone = ?').get(cleanPhone);
  if (!customer) {
    const result = prepare('INSERT INTO customers (phone, name) VALUES (?, ?)').run(cleanPhone, name);
    customer = { id: result.lastInsertRowid, phone: cleanPhone, name };
  } else {
    prepare("UPDATE customers SET last_interaction = CURRENT_TIMESTAMP, name = COALESCE(NULLIF(?, ''), name) WHERE id = ?")
      .run(name, customer.id);
  }
  return customer;
}

function getOrCreateConversation(customerId, phone) {
  const cleanPhone = phone.replace('@s.whatsapp.net', '');
  let conv = prepare("SELECT * FROM conversations WHERE customer_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1")
    .get(customerId);
  if (!conv) {
    const r = prepare("INSERT INTO conversations (customer_id, phone, status) VALUES (?, ?, 'active')")
      .run(customerId, cleanPhone);
    conv = { id: r.lastInsertRowid };
  } else {
    prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(conv.id);
  }
  return conv;
}

function saveMessage(convId, direction, content) {
  prepare("INSERT INTO messages (conversation_id, direction, content) VALUES (?, ?, ?)")
    .run(convId, direction, content);
}

async function handleInteractiveResponse(phone, selectedId, title, senderName) {
  const customer = await getOrCreateCustomer(phone, senderName);
  const conv = getOrCreateConversation(customer.id, phone);

  saveMessage(conv.id, 'incoming', `[Selected: ${title || selectedId}]`);

  // Product selection from list
  if (selectedId && selectedId.startsWith('prod_')) {
    const parts = selectedId.replace('prod_', '').split('|');
    const productName = decodeURIComponent(parts[0]);
    const price = parseFloat(parts[1]) || 0;

    // Create quotation
    prepare("INSERT INTO quotation_requests (customer_id, product_name, quantity, notes, status) VALUES (?, ?, 1, ?, 'new')")
      .run(customer.id, productName, `Price: $${price.toFixed(2)}`);

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
    saveMessage(conv.id, 'outgoing', `Product selected: ${productName}. Delivery/Pickup buttons sent.`);
    return;
  }

  // Delivery option selected from list
  if (selectedId && selectedId.startsWith('delivery_')) {
    await sock.sendMessage(phone, {
      text: '📦 *Delivery*\n\nPlease provide your:\n\n1. Full Name\n2. Phone Number\n3. Delivery Address\n4. Town/City',
    });
    saveMessage(conv.id, 'outgoing', 'Delivery selected. Asking for details.');
    return;
  }

  if (selectedId && selectedId.startsWith('pickup_')) {
    await sock.sendMessage(phone, {
      text: '🏪 *Pick Up In Person*\n\nPlease provide your name and phone number so we can prepare your order.\n\nOur location will be shared with your quotation.',
    });
    saveMessage(conv.id, 'outgoing', 'Pickup selected. Asking for name/phone.');
    return;
  }
}

async function handleButtonResponse(phone, buttonId, buttonText, senderName) {
  const customer = await getOrCreateCustomer(phone, senderName);
  const conv = getOrCreateConversation(customer.id, phone);

  saveMessage(conv.id, 'incoming', `[Button: ${buttonText || buttonId}]`);

  if (buttonId && buttonId.startsWith('delivery_')) {
    const parts = buttonId.replace('delivery_', '').split('_');
    const custId = parseInt(parts[0]);
    const productName = decodeURIComponent(parts.slice(1).join('_'));

    const quote = prepare('SELECT id FROM quotation_requests WHERE customer_id = ? AND status = ? ORDER BY id DESC LIMIT 1')
      .get(custId, 'new');
    if (quote) {
      prepare("UPDATE quotation_requests SET notes = notes || ?, status = 'reviewed' WHERE id = ?")
        .run('\nDelivery selected.', quote.id);
    }

    await sock.sendMessage(phone, {
      text: '📦 *Delivery*\n\nPlease reply with:\n\nYour Full Name\nDelivery Address\nTown/City\nPhone Number\n\nExample:\nJohn Banda\nPlot 123, Independence Ave\nKitwe\n0971234567',
    });
    saveMessage(conv.id, 'outgoing', 'Delivery details requested.');
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
    }

    await sock.sendMessage(phone, {
      text: `🏪 *Thank you for choosing Mineazy!*\n\nYour order for *${productName}* has been received.\n\n*Order Status:* Pending\n\nYou can pick up your order at our location. Please bring your ID when collecting.\n\nWe'll notify you when your order is ready. For questions, reply with *human*.`,
    });
    saveMessage(conv.id, 'outgoing', `Pickup confirmed for ${productName}. Thank you message sent.`);
    return;
  }
}

async function handleIncomingMessage(phone, text, senderName) {
  const customer = await getOrCreateCustomer(phone, senderName);
  const conv = getOrCreateConversation(customer.id, phone);

  saveMessage(conv.id, 'incoming', text);

  // Check if customer has an open ticket - pause bot
  const openTicket = prepare("SELECT * FROM support_tickets WHERE customer_id = ? AND status = 'open' OR status = 'in_progress'").get(customer.id);
  if (openTicket) return;

  const msgLower = text.toLowerCase().trim();
  const state = purchaseState.get(phone);

  // ---- /buy command ----
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

    purchaseState.set(phone, { step: 'awaiting_qty', product: name, price });
    await sock.sendMessage(phone, {
      text: `*${name}*\nPrice: $${price.toFixed(2)} | Stock: ${product.stock} units\n\nHow many would you like to buy? Reply with a number.`,
    });
    saveMessage(conv.id, 'outgoing', `/buy flow: asking quantity for ${name}`);
    return;
  }

  // ---- Quantity response ----
  if (state && state.step === 'awaiting_qty') {
    const qty = parseInt(msgLower);
    if (isNaN(qty) || qty < 1) {
      await sock.sendMessage(phone, { text: 'Please enter a valid number. How many do you want?' });
      return;
    }

    const total = (state.price * qty).toFixed(2);

    const result = prepare(
      "INSERT INTO quotation_requests (customer_id, product_name, quantity, notes, status) VALUES (?, ?, ?, ?, 'new')"
    ).run(customer.id, state.product, qty,
      `Price per unit: $${state.price.toFixed(2)}\nTotal: $${total}\nCustomer: ${customer.name || senderName}\nPhone: ${customer.phone}`);

    const quoteId = result.lastInsertRowid;
    purchaseState.set(phone, { step: 'done', product: state.product, price: state.price, quantity: qty, quoteId });

    const receipt = `╔══════════════════════╗
║   *MINEAZY QUOTATION*   ║
╚══════════════════════╝

*Quote #:* ${quoteId}
*Product:* ${state.product}
*Quantity:* ${qty}
*Unit Price:* $${state.price.toFixed(2)}
*Total:* $${total}

📅 *Date:* ${new Date().toLocaleDateString()}

_Visit your nearest Mineazy branch with this quotation number to complete your purchase._

💬 Type *human* to speak with a representative.`;

    await sock.sendMessage(phone, { text: receipt });
    saveMessage(conv.id, 'outgoing', `Quotation #${quoteId} created for ${state.product} x${qty}. Total: $${total}`);
    return;
  }

  // ---- Normal product search ----
  const { results, suggestion } = searchProducts(text);
  const isProductQuery = results.length > 0 && !msgLower.match(/^(hi|hey|hello|good morning|good afternoon|good evening)\b/);

  if (isProductQuery && results.length > 0) {
    const topItems = results.slice(0, 4);
    let productList = suggestion || 'Here is what I found:\n\n';
    topItems.forEach((p, i) => {
      const name = p.cleanName || p.name;
      productList += `${i + 1}. *${name}*\n   Price: $${p.price.toFixed(2)} | Stock: ${p.stock} units\n\n`;
    });
    productList += `💡 To purchase, type: */buy product name*\nExample: */buy bunga 1t*`;

    await sock.sendMessage(phone, { text: productList });
    saveMessage(conv.id, 'outgoing', `Product list with /buy instructions sent: ${results.length} items`);
    return;
  }

  // ---- Regular AI response ----
  const aiResponse = await getAIResponse(text);
  const cleanResponse = aiResponse.replace(/HUMAN_NEEDED|QUOTE_REQUEST/g, '').trim();
  if (cleanResponse) {
    await sock.sendMessage(phone, { text: cleanResponse });
    saveMessage(conv.id, 'outgoing', cleanResponse);
  }

  if (aiResponse.includes('HUMAN_NEEDED')) {
    const existingTicket = prepare("SELECT * FROM support_tickets WHERE customer_id = ? AND status = 'open'").get(customer.id);
    if (!existingTicket) {
      prepare("INSERT INTO support_tickets (customer_id, subject, description, status, priority) VALUES (?, ?, ?, 'open', 'medium')")
        .run(customer.id, 'Escalation Request', `Customer requested human assistance.\nName: ${customer.name}\nPhone: ${customer.phone}\nLast message: ${text}`);
    }
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
