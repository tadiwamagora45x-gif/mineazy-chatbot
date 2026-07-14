import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb, prepare } from './db.js';
import { authenticateToken } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import productRoutes from './routes/products.js';
import quotationRoutes from './routes/quotations.js';
import ticketRoutes from './routes/tickets.js';
import customerRoutes from './routes/customers.js';
import conversationRoutes from './routes/conversations.js';
import settingsRoutes from './routes/settings.js';
import usersRoutes from './routes/users.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/products', productRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/users', usersRoutes);

app.post('/api/admin/clear', authenticateToken, (req, res) => {
  const { table } = req.body;
  const tables = ['quotation_requests', 'support_tickets', 'messages', 'conversations'];
  if (!tables.includes(table)) {
    return res.status(400).json({ error: 'Invalid table. Allowed: ' + tables.join(', ') });
  }
  try {
    const count = prepare(`DELETE FROM ${table}`).run().changes;
    if (table === 'quotation_requests') prepare('DELETE FROM quotation_requests').run();
    if (table === 'support_tickets') prepare('DELETE FROM support_tickets').run();
    if (table === 'messages') prepare('DELETE FROM messages').run();
    if (table === 'conversations') { prepare('DELETE FROM messages').run(); prepare('DELETE FROM conversations').run(); }
    res.json({ message: `Cleared ${table}`, deleted: count });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/notifications', authenticateToken, (req, res) => {
  const openTickets = prepare("SELECT COUNT(*) as count FROM support_tickets WHERE status = 'open'").get().count;
  const newQuotes = prepare("SELECT COUNT(*) as count FROM quotation_requests WHERE status = 'new'").get().count;
  res.json({ openTickets, newQuotes });
});

app.post('/api/messages/send', authenticateToken, async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) return res.status(400).json({ error: 'Phone and message required' });
  try {
    const { sendWhatsAppMessage } = await import('./whatsapp.js');
    const cleanPhone = phone.replace(/\D/g, '');
    await sendWhatsAppMessage(cleanPhone, message);

    // Save outgoing message
    const customer = prepare('SELECT id FROM customers WHERE phone = ?').get(cleanPhone);
    if (customer) {
      const conv = prepare("SELECT id FROM conversations WHERE customer_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1").get(customer.id);
      if (conv) {
        prepare("INSERT INTO messages (conversation_id, direction, content) VALUES (?, 'outgoing', ?)")
          .run(conv.id, message);
        prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(conv.id);
      }
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const distPath = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(distPath, {
  setHeaders: (res) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
}));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(distPath, 'index.html'));
  }
});

async function start() {
  await initDb();
  const c = prepare('SELECT COUNT(*) as count FROM products').get().count;
  console.log(`Database initialized with ${c} products`);

  // Sync products from ERP
  const { syncProductsFromERP } = await import('./sync-erp-products.js');
  await syncProductsFromERP();

  try {
    const { startWhatsApp, setQRCallback } = await import('./whatsapp.js');
    const { initGemini } = await import('./gemini.js');

    initGemini(process.env.GEMINI_API_KEY);

    startWhatsApp().catch(err => {
      console.error('WhatsApp not available:', err.message);
      console.log('Install Baileys with: npm install @whiskeysockets/baileys pino @hapi/boom');
    });

    setQRCallback(async (data) => {
      if (data.type === 'qr') {
        const { writeFileSync } = await import('fs');
        writeFileSync('./qr-code.txt', data.qr);
        console.log('\n========================================');
        console.log('  QR CODE READY - Scan with WhatsApp');
        console.log('========================================');
        console.log('\nCopy the string below and paste at https://www.qr-code-generator.com to get a QR image:\n');
        console.log(data.qr);
        console.log('\n(QR string also saved to backend/qr-code.txt)\n');
        try {
          const qr = await import('qrcode-terminal');
          qr.default.generate(data.qr, { small: true });
        } catch (e) { /* terminal QR display failed, string fallback above */ }
      } else if (data.type === 'connected') {
        console.log('WhatsApp connected!');
      }
    });
  } catch (err) {
    console.log('WhatsApp module not loaded - install with npm if needed');
  }

  app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`  MineAzy WhatsApp AI Assistant`);
    console.log(`  Server: http://localhost:${PORT}`);
    console.log(`  API:    http://localhost:${PORT}/api`);
    console.log(`========================================\n`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
