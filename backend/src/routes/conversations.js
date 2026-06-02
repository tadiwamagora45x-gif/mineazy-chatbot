import express from 'express';
import { prepare } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', (req, res) => {
  const conversations = prepare(`
    SELECT conv.*,
      c.name as customer_name,
      c.company as customer_company,
      c.phone as customer_phone,
      (SELECT COUNT(*) FROM messages WHERE conversation_id = conv.id) as message_count,
      (SELECT content FROM messages WHERE conversation_id = conv.id ORDER BY created_at DESC LIMIT 1) as last_message
    FROM conversations conv
    LEFT JOIN customers c ON conv.customer_id = c.id
    ORDER BY conv.updated_at DESC
  `).all();

  res.json(conversations);
});

router.get('/:id', (req, res) => {
  const conversation = prepare(`
    SELECT conv.*, c.name as customer_name, c.company as customer_company, c.phone as customer_phone
    FROM conversations conv
    LEFT JOIN customers c ON conv.customer_id = c.id
    WHERE conv.id = ?
  `).get(req.params.id);

  if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

  const messages = prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(req.params.id);

  res.json({ ...conversation, messages });
});

router.put('/:id', (req, res) => {
  const { status } = req.body;
  prepare("UPDATE conversations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(status, req.params.id);
  res.json({ message: 'Conversation updated' });
});

export default router;
