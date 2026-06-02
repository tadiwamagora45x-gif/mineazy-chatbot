import { initDb, prepare, saveDb } from './db.js';
import bcrypt from 'bcryptjs';

const seed = async () => {
  await initDb();

  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync('admin123', salt);

  const insertUser = prepare('INSERT OR IGNORE INTO users (name, email, password, role) VALUES (?, ?, ?, ?)');
  insertUser.run('Admin', 'admin@mineazy.com', hash, 'admin');

  const products = [
    ['CAT Hydraulic Filter HF-3512', 'Filters', 'Heavy-duty hydraulic filter for CAT 320-349 excavators. OEM equivalent quality.', 2450, 45],
    ['Komatsu Air Filter AF-2589', 'Filters', 'Primary air filter for Komatsu D65-D85 dozers. High dust-holding capacity.', 1890, 32],
    ['Hydraulic Pump HP-1200', 'Pumps', 'Replacement hydraulic pump for CAT D6-D9 dozers. 1200 PSI rated.', 28500, 8],
    ['Track Roller Assembly TR-450', 'Undercarriage', 'Single flange track roller for CAT D8T. Heat-treated steel.', 4200, 60],
    ['Swing Bearing SB-6200', 'Bearings', 'Slewing ring bearing for Hitachi ZX200-350 excavators.', 18500, 5],
    ['Fuel Filter FF-980K', 'Filters', 'High-efficiency fuel/water separator for Komatsu equipment.', 950, 75],
    ['Grease Pump GP-50', 'Lubrication', 'Automatic grease pump kit for excavator maintenance. 24V DC.', 6800, 15],
    ['Bucket Teeth BT-200', 'Ground Engaging', 'Replaceable bucket teeth for CAT 330 excavator. Hardened steel.', 350, 200],
    ['Cutting Edge CE-3000', 'Ground Engaging', 'Bolt-on cutting edge for wheel loaders. 3000mm length.', 5800, 12],
    ['Seal Kit SK-200', 'Seals', 'Complete hydraulic cylinder seal kit for excavator boom cylinder.', 2800, 30],
    ['Radiator Core RC-1500', 'Cooling', 'Heavy-duty radiator core for CAT D10T. Copper-brass construction.', 32000, 4],
    ['Drive Sprocket DS-800', 'Undercarriage', 'Segmented drive sprocket for Komatsu D375A. Replaceable segments.', 15000, 10],
    ['Idler Wheel IW-600', 'Undercarriage', 'Front idler assembly for CAT D6R. Complete with bearings.', 12000, 8],
    ['Bearing Set BS-310', 'Bearings', 'Tapered roller bearing set for final drive. Pre-lubricated.', 4500, 25],
    ['Hydraulic Hose HH-1000', 'Hydraulics', 'High-pressure hydraulic hose assembly. 1000 PSI, 2m length.', 850, 120],
    ['Excavator Bucket EB-1500', 'Attachments', 'General purpose bucket for 20-ton excavator. 1500mm width.', 45000, 3],
    ['Dozer Blade DB-4000', 'Attachments', 'Semi-U blade for D9 dozer. 4000mm width with wear plates.', 280000, 2],
    ['Oil Filter OF-1580', 'Filters', 'Spin-on oil filter for CAT engines. 15-micron filtration.', 420, 150],
    ['Water Pump WP-200', 'Pumps', 'Engine water pump for Komatsu SAA6D125E engine. OEM spec.', 8500, 10],
    ['Alternator ALT-24', 'Electrical', '24V 100A alternator for CAT equipment. Heavy-duty rated.', 5500, 14],
  ];

  const insertProduct = prepare('INSERT OR IGNORE INTO products (name, category, description, price, stock) VALUES (?, ?, ?, ?, ?)');
  const insertInventory = prepare('INSERT OR IGNORE INTO inventory (product_id, warehouse, quantity) VALUES (?, ?, ?)');

  for (const [name, category, description, price, stock] of products) {
    const result = insertProduct.run(name, category, description, price, stock);
    const productId = result.lastInsertRowid;
    if (productId) {
      insertInventory.run(productId, 'Main Warehouse', stock);
    }
  }

  const insertSetting = prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  insertSetting.run('company_name', 'MineAzy Mining Solutions');
  insertSetting.run('company_phone', '+260 97 1234567');
  insertSetting.run('company_email', 'info@mineazy.com');
  insertSetting.run('company_address', 'Plot 1234, Kitwe, Zambia');
  insertSetting.run('business_hours', 'Mon-Fri 8am-5pm, Sat 8am-12pm');

  saveDb();
  console.log('Database seeded successfully!');
};

seed().catch(err => { console.error('Seed error:', err); process.exit(1); });
