import { prepare } from './db.js';

const ERP_URL = `${process.env.ERP_URL || 'http://localhost:3005'}/api/chatbot?action=erp-products`;
const ERP_API_KEY = 'mineazy-chatbot-sync-key-2026';

export async function syncProductsFromERP() {
  try {
    console.log('Syncing products from ERP...');
    const response = await fetch(ERP_URL, {
      headers: { 'x-api-key': ERP_API_KEY },
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      console.warn(`ERP products fetch failed: ${response.status}`);
      return false;
    }

    const erpProducts = await response.json();
    if (!Array.isArray(erpProducts) || erpProducts.length === 0) {
      console.warn('ERP returned no products, skipping sync.');
      return false;
    }

    const count = erpProducts.length;
    console.log(`Got ${count} products from ERP, syncing...`);

    // Batch delete and insert
    prepare('DELETE FROM products').run();

    const insert = prepare('INSERT INTO products (name, category, description, price, stock, active, updated_at) VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)');

    let synced = 0;
    for (const p of erpProducts) {
      insert.run(
        p.name || 'Unknown',
        p.categoryId || '',
        p.description || '',
        Number(p.sellingPrice) || 0,
        Math.round(Number(p.stock)) || 0
      );
      synced++;
    }

    console.log(`Synced ${synced} products from ERP`);
    return true;
  } catch (err) {
    console.warn(`ERP products sync failed: ${err.message}`);
    return false;
  }
}
