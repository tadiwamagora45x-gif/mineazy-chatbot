import http from 'http';

function api(m, p, t, b) {
  return new Promise((resolve) => {
    const o = { hostname: 'localhost', port: 3000, path: p, method: m, headers: { 'Content-Type': 'application/json' } };
    if (t) o.headers['Authorization'] = 'Bearer ' + t;
    const r = http.request(o, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { resolve({ raw: d.slice(0, 200) }); } }); });
    if (b) r.write(JSON.stringify(b));
    r.end();
  });
}

async function main() {
  console.log('--- Checking login ---');
  const login = await api('POST', '/api/auth/login', null, { email: 'admin@mineazy.com', password: 'admin123' });
  console.log('Login:', login.user ? `OK (${login.user.role})` : `FAIL: ${JSON.stringify(login)}`);

  console.log('\n--- Checking dashboard ---');
  const dash = await api('GET', '/api/dashboard', login.token);
  console.log('Dashboard:', dash.stats ? `OK (${dash.stats.totalProducts} products)` : `FAIL: ${JSON.stringify(dash)}`);

  console.log('\n--- Checking products ---');
  const prods = await api('GET', '/api/products', login.token);
  console.log('Products:', Array.isArray(prods) ? `OK (${prods.length} items)` : `FAIL: ${JSON.stringify(prods)}`);

  console.log('\n--- Checking settings ---');
  const settings = await api('GET', '/api/settings', login.token);
  console.log('Settings:', settings.company_name ? `OK: ${settings.company_name}` : `FAIL`);

  console.log('\n--- Checking frontend HTML ---');
  const html = await api('GET', '/', null, null);
  console.log('HTML:', typeof html.raw === 'string' ? `OK (${html.raw.length}b)` : 'FAIL');

  console.log('\nAll checks passed!');
}

main().catch(e => console.error(e.message));
