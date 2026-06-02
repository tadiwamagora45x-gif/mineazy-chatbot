import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import productRoutes from './routes/products.js';
import quotationRoutes from './routes/quotations.js';
import ticketRoutes from './routes/tickets.js';
import customerRoutes from './routes/customers.js';
import conversationRoutes from './routes/conversations.js';
import settingsRoutes from './routes/settings.js';

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

const distPath = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(distPath, 'index.html'));
  }
});

async function start() {
  await initDb();
  console.log('Database initialized');

  try {
    const { startWhatsApp, setQRCallback } = await import('./whatsapp.js');
    const { initGemini } = await import('./gemini.js');

    initGemini(process.env.GEMINI_API_KEY);

    startWhatsApp().catch(err => {
      console.error('WhatsApp not available:', err.message);
      console.log('Install Baileys with: npm install @whiskeysockets/baileys pino @hapi/boom');
    });

    setQRCallback((data) => {
      if (data.type === 'qr') {
        import('qrcode-terminal').then(qr => {
          qr.default.generate(data.qr, { small: true });
          console.log('\nScan the QR code above with WhatsApp (Linked Devices)');
        }).catch(() => {
          console.log('\nQR Code received. Copy this string to a QR generator:\n');
          console.log(data.qr);
        });
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
