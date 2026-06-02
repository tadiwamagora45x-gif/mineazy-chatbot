import http from 'http';

function apiCall(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 3000, path, method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    const req = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const { token } = await apiCall('POST', '/api/auth/login', null, {
    email: 'admin@mineazy.com', password: 'admin123',
  });

  const products = await apiCall('GET', '/api/products', token);

  for (const p of products) {
    const result = await apiCall('DELETE', '/api/products/' + p.id, token);
    console.log('Deleted:', p.name);
  }

  console.log('Done. Deleted', products.length, 'products.');
}

main().catch(e => console.error(e));
