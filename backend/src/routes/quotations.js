import express from 'express';
import { prepare } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', (req, res) => {
  const { status } = req.query;
  let query = `
    SELECT q.*, c.name as customer_name, c.company as customer_company, c.phone as customer_phone
    FROM quotation_requests q
    LEFT JOIN customers c ON q.customer_id = c.id
  `;
  const params = [];

  if (status) {
    query += ' WHERE q.status = ?';
    params.push(status);
  }
  query += ' ORDER BY q.created_at DESC';

  res.json(prepare(query).all(params));
});

router.get('/:id', (req, res) => {
  const quote = prepare(`
    SELECT q.*, c.name as customer_name, c.company as customer_company, c.phone as customer_phone, c.email as customer_email
    FROM quotation_requests q
    LEFT JOIN customers c ON q.customer_id = c.id
    WHERE q.id = ?
  `).get(req.params.id);

  if (!quote) return res.status(404).json({ error: 'Quotation not found' });
  res.json(quote);
});

router.put('/:id', async (req, res) => {
  const { status, notes } = req.body;
  const quote = prepare('SELECT * FROM quotation_requests WHERE id = ?').get(req.params.id);
  if (!quote) return res.status(404).json({ error: 'Quotation not found' });

  prepare(
    'UPDATE quotation_requests SET status = COALESCE(?, status), notes = COALESCE(?, notes), updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(status || null, notes || null, req.params.id);

  // If marked as completed, send receipt to customer
  if (status === 'completed') {
    try {
      const { notifyCustomerQuoteComplete } = await import('../whatsapp.js');
      await notifyCustomerQuoteComplete(req.params.id);
    } catch (e) {
      console.error('Failed to notify customer:', e.message);
    }
  }

  res.json({ message: 'Quotation updated' });
});

router.delete('/:id', (req, res) => {
  prepare('DELETE FROM quotation_requests WHERE id = ?').run(req.params.id);
  res.json({ message: 'Quotation deleted' });
});

export default router;
