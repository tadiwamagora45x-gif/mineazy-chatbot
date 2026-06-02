import express from 'express';
import { prepare } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', (req, res) => {
  const { search, category } = req.query;
  let query = 'SELECT * FROM products WHERE 1=1';
  const params = [];

  if (search) {
    query += ' AND (name LIKE ? OR description LIKE ? OR category LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }
  query += ' ORDER BY name';

  const products = prepare(query).all(params);
  res.json(products);
});

router.get('/categories', (req, res) => {
  const categories = prepare('SELECT DISTINCT category FROM products WHERE active = 1 ORDER BY category').all();
  res.json(categories.map(c => c.category));
});

router.get('/:id', (req, res) => {
  const product = prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

router.post('/', (req, res) => {
  const { name, category, description, price, stock } = req.body;
  if (!name) return res.status(400).json({ error: 'Product name required' });

  const result = prepare(
    'INSERT INTO products (name, category, description, price, stock) VALUES (?, ?, ?, ?, ?)'
  ).run(name, category || '', description || '', price || 0, stock || 0);

  res.status(201).json({ id: result.lastInsertRowid, message: 'Product created' });
});

router.put('/:id', (req, res) => {
  const { name, category, description, price, stock, active } = req.body;
  const product = prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  prepare(
    `UPDATE products SET name = ?, category = ?, description = ?, price = ?, stock = ?, active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).run(
    name || product.name,
    category !== undefined ? category : product.category,
    description !== undefined ? description : product.description,
    price !== undefined ? price : product.price,
    stock !== undefined ? stock : product.stock,
    active !== undefined ? active : product.active,
    req.params.id
  );

  res.json({ message: 'Product updated' });
});

router.delete('/:id', (req, res) => {
  const result = prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Product not found' });
  res.json({ message: 'Product deleted' });
});

export default router;
