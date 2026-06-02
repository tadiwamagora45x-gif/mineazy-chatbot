import http from 'http';

const login = JSON.stringify({ email: 'admin@mineazy.com', password: 'admin123' });

const loginReq = http.request({
  hostname: 'localhost', port: 3000, path: '/api/auth/login', method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const token = JSON.parse(d).token;
    const data = JSON.stringify({ company_name: 'MineAzy TEST', company_phone: '+260 555 999' });
    const saveReq = http.request({
      hostname: 'localhost', port: 3000, path: '/api/settings', method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
    }, r => {
      let d2 = '';
      r.on('data', c => d2 += c);
      r.on('end', () => {
        console.log('Save result:', d2);
        // verify
        const verifyReq = http.request({
          hostname: 'localhost', port: 3000, path: '/api/settings', method: 'GET',
          headers: { 'Authorization': 'Bearer ' + token }
        }, r2 => {
          let d3 = '';
          r2.on('data', c => d3 += c);
          r2.on('end', () => {
            console.log('Verify:', d3);
          });
        });
        verifyReq.end();
      });
    });
    saveReq.write(data);
    saveReq.end();
  });
});
loginReq.write(login);
loginReq.end();
