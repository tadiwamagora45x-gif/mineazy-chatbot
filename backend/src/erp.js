import { prepare } from './db.js';

const ERP_URL = process.env.ERP_URL || 'http://localhost:3005/api/chatbot';
const ERP_API_KEY = 'mineazy-chatbot-sync-key-2026';

async function postToERP(payload) {
  try {
    const response = await fetch(ERP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ERP_API_KEY,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      console.warn(`ERP responded with ${response.status} for ${payload.type}`);
    }
  } catch (err) {
    console.warn(`ERP unreachable: ${err.message}`);
  }
}

export async function sendCustomerToERP(customer) {
  const latest = prepare('SELECT * FROM customers WHERE phone = ?').get(customer.phone);
  await postToERP({
    source: 'whatsapp',
    type: 'customer',
    timestamp: new Date().toISOString(),
    data: latest || customer,
  });
}

export async function sendQuotationToERP(quoteId) {
  const quote = prepare(`
    SELECT q.*, c.name as customer_name, c.phone as customer_phone
    FROM quotation_requests q
    LEFT JOIN customers c ON q.customer_id = c.id
    WHERE q.id = ?
  `).get(quoteId);
  if (!quote) return;
  await postToERP({
    source: 'whatsapp',
    type: 'quotation',
    timestamp: new Date().toISOString(),
    data: quote,
  });
}

export async function sendTicketToERP(ticketId) {
  const ticket = prepare(`
    SELECT t.*, c.name as customer_name, c.phone as customer_phone
    FROM support_tickets t
    LEFT JOIN customers c ON t.customer_id = c.id
    WHERE t.id = ?
  `).get(ticketId);
  if (!ticket) return;
  await postToERP({
    source: 'whatsapp',
    type: 'ticket',
    timestamp: new Date().toISOString(),
    data: ticket,
  });
}

export async function sendMessageToERP(convId, direction, content, phone, customerName) {
  await postToERP({
    source: 'whatsapp',
    type: 'message',
    timestamp: new Date().toISOString(),
    data: {
      conversation_id: convId,
      direction,
      content,
      phone,
      customer_name: customerName,
    },
  });
}
