import express from 'express';
import { prepare } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', (req, res) => {
  const { status } = req.query;
  let query = `
    SELECT t.*, c.name as customer_name, c.company as customer_company, c.phone as customer_phone,
           u.name as assigned_name
    FROM support_tickets t
    LEFT JOIN customers c ON t.customer_id = c.id
    LEFT JOIN users u ON t.assigned_to = u.id
  `;
  const params = [];

  if (status) {
    query += ' WHERE t.status = ?';
    params.push(status);
  }
  query += ' ORDER BY t.created_at DESC';

  res.json(prepare(query).all(params));
});

router.get('/:id', (req, res) => {
  const ticket = prepare(`
    SELECT t.*, c.name as customer_name, c.company as customer_company, c.phone as customer_phone
    FROM support_tickets t
    LEFT JOIN customers c ON t.customer_id = c.id
    WHERE t.id = ?
  `).get(req.params.id);

  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  res.json(ticket);
});

router.put('/:id', (req, res) => {
  const { status, priority, assigned_to, description } = req.body;
  const ticket = prepare('SELECT * FROM support_tickets WHERE id = ?').get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  prepare(
    `UPDATE support_tickets SET
      status = COALESCE(?, status),
      priority = COALESCE(?, priority),
      assigned_to = COALESCE(?, assigned_to),
      description = COALESCE(?, description),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`
  ).run(status || null, priority || null, assigned_to || null, description || null, req.params.id);

  res.json({ message: 'Ticket updated' });
});

router.delete('/:id', (req, res) => {
  prepare('DELETE FROM support_tickets WHERE id = ?').run(req.params.id);
  res.json({ message: 'Ticket deleted' });
});

export default router;
