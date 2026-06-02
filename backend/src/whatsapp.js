import {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { prepare } from './db.js';
import { getAIResponse, extractQuoteInfo } from './gemini.js';

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
        console.log('WhatsApp disconnected. Reconnecting...');
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

        const textMessage = msg.message.conversation
          || msg.message.extendedTextMessage?.text
          || msg.message.imageMessage?.caption;

        if (!textMessage) continue;

        const phone = msg.key.remoteJid;
        if (phone.includes('@g.us') || phone === 'status@broadcast') continue;

        await handleIncomingMessage(phone, textMessage, msg.pushName || 'Customer');
      }
    });
  } catch (err) {
    console.error('WhatsApp not available - Baileys requires git to install:', err.message);
    console.log('WhatsApp integration will be disabled. Run: npm install @whiskeysockets/baileys pino');
  }
}

async function handleIncomingMessage(phone, text, senderName) {
  const cleanPhone = phone.replace('@s.whatsapp.net', '');

  let customer = prepare('SELECT * FROM customers WHERE phone = ?').get(cleanPhone);
  if (!customer) {
    const result = prepare('INSERT INTO customers (phone, name) VALUES (?, ?)').run(cleanPhone, senderName);
    customer = { id: result.lastInsertRowid, phone: cleanPhone, name: senderName };
  } else {
    prepare('UPDATE customers SET last_interaction = CURRENT_TIMESTAMP, name = COALESCE(NULLIF(?, ""), name) WHERE id = ?')
      .run(senderName, customer.id);
  }

  let conversation = prepare("SELECT * FROM conversations WHERE customer_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1")
    .get(customer.id);
  if (!conversation) {
    const convResult = prepare("INSERT INTO conversations (customer_id, phone, status) VALUES (?, ?, 'active')")
      .run(customer.id, cleanPhone);
    conversation = { id: convResult.lastInsertRowid };
  } else {
    prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(conversation.id);
  }

  prepare("INSERT INTO messages (conversation_id, direction, content) VALUES (?, 'incoming', ?)")
    .run(conversation.id, text);

  const recentMessages = prepare("SELECT direction, content FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 10")
    .all(conversation.id).reverse();

  const aiResponse = await getAIResponse(text);

  const cleanResponse = aiResponse.replace(/HUMAN_NEEDED|QUOTE_REQUEST/g, '').trim();
  if (cleanResponse) {
    await sock.sendMessage(phone, { text: cleanResponse });
    prepare("INSERT INTO messages (conversation_id, direction, content) VALUES (?, 'outgoing', ?)")
      .run(conversation.id, cleanResponse);
  }

  if (aiResponse.includes('HUMAN_NEEDED')) {
    const existingTicket = prepare("SELECT * FROM support_tickets WHERE customer_id = ? AND status = 'open'").get(customer.id);
    if (!existingTicket) {
      prepare("INSERT INTO support_tickets (customer_id, subject, description, status, priority) VALUES (?, ?, ?, 'open', 'medium')")
        .run(customer.id, 'Escalation Request', `Customer requested human assistance.\nName: ${customer.name}\nPhone: ${cleanPhone}\nLast message: ${text}`);
    }
  }

  if (aiResponse.includes('QUOTE_REQUEST')) {
    const quoteMsgs = recentMessages.filter(m => m.direction === 'incoming').map(m => m.content);
    const info = extractQuoteInfo(quoteMsgs);
    const productName = info.product || text.slice(0, 80);
    const quantity = info.quantity || 1;

    await sock.sendMessage(phone, {
      text: "Thank you for your interest! I've created a quotation request. A member of our sales team will prepare your quote and get back to you within 24 hours. For urgent queries, call +260 97 1234567."
    });
    prepare("INSERT INTO messages (conversation_id, direction, content) VALUES (?, 'outgoing', ?)")
      .run(conversation.id, "Quotation request created. Sales team will follow up.");

    prepare("INSERT INTO quotation_requests (customer_id, product_name, quantity, notes) VALUES (?, ?, ?, ?)")
      .run(customer.id, productName, quantity, info.product ? `Auto-detected: ${JSON.stringify(info)}` : 'Pending details');
  }
}

export async function sendWhatsAppMessage(phone, text) {
  if (!sock) throw new Error('WhatsApp not connected');
  const jid = phone.includes('@s.whatsapp.net') ? phone : `${phone}@s.whatsapp.net`;
  await sock.sendMessage(jid, { text });
  return true;
}
