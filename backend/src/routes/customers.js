import express from 'express';
import { prepare } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', (req, res) => {
  const { search } = req.query;
  let query = `
    SELECT c.*,
      (SELECT COUNT(*) FROM conversations WHERE customer_id = c.id) as conversation_count,
      (SELECT COUNT(*) FROM quotation_requests WHERE customer_id = c.id) as quotation_count,
      (SELECT COUNT(*) FROM support_tickets WHERE customer_id = c.id) as ticket_count
    FROM customers c
  `;
  const params = [];

  if (search) {
    query += ' WHERE c.name LIKE ? OR c.company LIKE ? OR c.phone LIKE ?';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  query += ' ORDER BY c.last_interaction DESC';

  res.json(prepare(query).all(params));
});

router.get('/:id', (req, res) => {
  const customer = prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const conversations = prepare('SELECT * FROM conversations WHERE customer_id = ? ORDER BY created_at DESC').all(req.params.id);
  const quotations = prepare('SELECT * FROM quotation_requests WHERE customer_id = ? ORDER BY created_at DESC').all(req.params.id);
  const tickets = prepare('SELECT * FROM support_tickets WHERE customer_id = ? ORDER BY created_at DESC').all(req.params.id);

  res.json({ customer, conversations, quotations, tickets });
});

router.put('/:id', (req, res) => {
  const { name, company, email, notes } = req.body;
  prepare(
    'UPDATE customers SET name = COALESCE(?, name), company = COALESCE(?, company), email = COALESCE(?, email), notes = COALESCE(?, notes) WHERE id = ?'
  ).run(name, company, email, notes, req.params.id);
  res.json({ message: 'Customer updated' });
});

export default router;
