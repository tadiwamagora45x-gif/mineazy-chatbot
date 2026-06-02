import express from 'express';
import { prepare } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', (req, res) => {
  const totalConversations = prepare('SELECT COUNT(*) as count FROM conversations').get().count;
  const activeConversations = prepare("SELECT COUNT(*) as count FROM conversations WHERE status = 'active'").get().count;
  const newQuotations = prepare("SELECT COUNT(*) as count FROM quotation_requests WHERE status = 'new'").get().count;
  const openTickets = prepare("SELECT COUNT(*) as count FROM support_tickets WHERE status = 'open'").get().count;
  const totalCustomers = prepare('SELECT COUNT(*) as count FROM customers').get().count;
  const totalProducts = prepare('SELECT COUNT(*) as count FROM products WHERE active = 1').get().count;

  const recentConversations = prepare(`
    SELECT conv.*, c.name as customer_name, c.phone as customer_phone
    FROM conversations conv
    LEFT JOIN customers c ON conv.customer_id = c.id
    ORDER BY conv.updated_at DESC LIMIT 5
  `).all();

  const recentQuotations = prepare(`
    SELECT q.*, c.name as customer_name, c.phone as customer_phone
    FROM quotation_requests q
    LEFT JOIN customers c ON q.customer_id = c.id
    ORDER BY q.created_at DESC LIMIT 5
  `).all();

  const recentTickets = prepare(`
    SELECT t.*, c.name as customer_name
    FROM support_tickets t
    LEFT JOIN customers c ON t.customer_id = c.id
    WHERE t.status = 'open'
    ORDER BY t.created_at DESC LIMIT 5
  `).all();

  res.json({
    stats: {
      totalConversations,
      activeConversations,
      newQuotations,
      openTickets,
      totalCustomers,
      totalProducts,
    },
    whatsappStatus: 'connected',
    recentConversations,
    recentQuotations,
    recentTickets,
  });
});

export default router;
