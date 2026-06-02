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
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch(e) { resolve(d); }
      });
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
  if (Array.isArray(products)) {
    console.log('Products via API:', products.length);
    if (products.length > 0) {
      console.log('First:', products[0].name);
      console.log('Last:', products[products.length-1].name);
    }
  } else {
    console.log('Response:', JSON.stringify(products).slice(0, 200));
  }
}

main().catch(e => console.error(e));
