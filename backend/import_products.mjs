import http from 'http';
import fs from 'fs';

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

function guessCat(name) {
  const n = name.toUpperCase();
  if (n.includes('BATTERY') || n.includes('DUCELL') || n.includes('EXIDE') || n.includes('RAYLITE')) return 'Batteries';
  if (n.includes('BEARING') || n.includes('PLUMMER') || n.includes('P/BLOCK') || n.includes('UCP') || n.includes('UCF') || n.includes('UCFL') || n.includes('ADAPTER SLEEVE')) return 'Bearings';
  if (n.includes('BELT') || n.includes('V BELT') || n.includes('V-BELT')) return 'Belts';
  if (n.includes('ENGINE') || n.includes('PISTON RING') || n.includes('PISTON ') || n.includes('CRANK') || n.includes('CYLINDER') || n.includes('CONROD') || n.includes('SLEEVE') || n.includes('GASKET') || n.includes('VALVE') || n.includes('CARBURETOR') || n.includes('CARBURATOR') || n.includes('INJECTOR') || n.includes('TAPPET') || n.includes('OIL SEAL') || n.includes('PUSH ROD') || n.includes('CAM') || n.includes('MANIFOLD') || n.includes('TURBO') || n.includes('SHELL BEARING') || n.includes('CONNECT ROD') || n.includes('OIL PUMP') || n.includes('WATER PUMP') || n.includes('FUEL') || n.includes('EXHAUST') || n.includes('SUMP') || n.includes('ROCKER') || n.includes('FLY WHEEL')) return 'Engine Parts';
  if (n.includes('GENERATOR') || n.includes('ALTERNATOR') || n.includes('AVR ') || n.includes('STATOR') || n.includes('ROTOR') || n.includes('EXCITOR') || n.includes('RECTIFIER') || n.includes('CARBON BRUSH') || n.includes('END SHIELD') || n.includes('DIESEL ENGINE') || n.includes('RADIATOR')) return 'Generators';
  if (n.includes('COMPRESSOR') || n.includes('AIRLEG') || n.includes('JACKHAMMER') || n.includes('DRILL STEEL') || n.includes('CHUCK') || n.includes('PUMPUM') || n.includes('PUM PUM') || n.includes('RIFFLE') || n.includes('Y18') || n.includes('Y24') || n.includes('S215') || n.includes('PICKAXE') || n.includes('DRILL BIT')) return 'Mining';
  if (n.includes('SEWAGE') || n.includes('SLURRY') || n.includes('SUBMERSIBLE') || n.includes('IMPELLER') || n.includes('MECHANICAL SEAL') || n.includes('BOOSTER') || n.includes('WATER PUMP') || n.includes('SUBPUMP') || n.includes('SUB PUMP') || n.includes('EAZY TOOLS SUBPUMP') || n.includes('SEWAGE PUMP')) return 'Pumps';
  if (n.includes('WELDING') || n.includes('ELECTRODE') || n.includes('WELD') || n.includes('BRAZING') || n.includes('SOLDER') || n.includes('PLASMA CUTTER') || n.includes('WELDING MACHINE')) return 'Welding';
  if (n.includes('ELECTRIC MOTOR') || n.includes('E/MOTOR') || n.includes('E-MOTOR') || n.includes('MOTOR SIDE')) return 'Motors';
  if (n.includes('WIRE') || n.includes('BARBED') || n.includes('FENCE') || n.includes('FIELD') || n.includes('POST') || n.includes('PANE')) return 'Fencing';
  if (n.includes('CABLE') || n.includes('BREAKER') || n.includes('CONTACTOR') || n.includes('SWITCH') || n.includes('SOCKET') || n.includes('ANDELI') || n.includes('BOX') || n.includes('METER') || n.includes('TIMER') || n.includes('PLUG') || n.includes('LUGS') || n.includes('TIES') || n.includes('GLAND') || n.includes('TERMINAL') || n.includes('DIN RAIL') || n.includes('INDICATION LAMP') || n.includes('PUSH BUTTON') || n.includes('STARTER') || n.includes('RELAY') || n.includes('AXIAL FAN') || n.includes('VARIABLE SPEED')) return 'Electrical';
  if (n.includes('BOLT') || n.includes('NUT') || n.includes('WASHER') || n.includes('STUDDING') || n.includes('NYLOC')) return 'Fasteners';
  if (n.includes('HOSE') || n.includes('CLAMP') || n.includes('COUPLING') || n.includes('CAM') || n.includes('FITTING') || n.includes('ELBOW') || n.includes('TEE') || n.includes('NIPPLE') || n.includes('VALVE') || n.includes('PIPE') || n.includes('PVC') || n.includes('HDPE') || n.includes('GALV') || n.includes('POLY PIPE') || n.includes('SOCKET') || n.includes('UNION') || n.includes('FOOT VALVE') || n.includes('CHECK VALVE') || n.includes('BALL VALVE') || n.includes('GATE VALVE')) return 'Pipes';
  if (n.includes('GLOVE') || n.includes('BOOT') || n.includes('GUMBOOT') || n.includes('HELMET') || n.includes('GOGGLE') || n.includes('MASK') || n.includes('WORKSUIT') || n.includes('OVERALL') || n.includes('DUST COAT') || n.includes('SAFETY') || n.includes('EAR PLUG') || n.includes('EAR CUP') || n.includes('REFLECTOR') || n.includes('KIDNEY BELT')) return 'PPE';
  if (n.includes('GREASE') || n.includes('OIL') || n.includes('LUBRICANT') || n.includes('DEGREASER') || n.includes('HYSPIN') || n.includes('BRAKE FLUID') || n.includes('THREADLOCKER') || n.includes('GLUE') || n.includes('EPOX') || n.includes('M-SEAL') || n.includes('ROYALE') || n.includes('XTREME') || n.includes('FG-')) return 'Lubricants';
  if (n.includes('HAMMER') || n.includes('PLIER') || n.includes('SPANNER') || n.includes('WRENCH') || n.includes('SOCKET') || n.includes('GRINDER') || n.includes('SAW') || n.includes('SCREWDRIVER') || n.includes('TAPE') || n.includes('LEVEL') || n.includes('EAZY TOOLS') || n.includes('POWER ACTION') || n.includes('JACK') || n.includes('CHISEL') || n.includes('AXE') || n.includes('PICK') || n.includes('SHOVEL') || n.includes('CUTTER') || n.includes('BLADE') || n.includes('DISC') || n.includes('WHEEL') || n.includes('SPRAYER')) return 'Tools';
  if (n.includes('WINCH') || n.includes('HOIST') || n.includes('CHAIN BLOCK') || n.includes('PALLET') || n.includes('CRANE') || n.includes('LIFTING') || n.includes('HEAD GEAR') || n.includes('HEAD WHEEL')) return 'Lifting';
  if (n.includes('CRUSHER') || n.includes('MILL') || n.includes('SCREEN') || n.includes('CONVEYOR') || n.includes('JAW') || n.includes('ROUNDMILL') || n.includes('BALL MILL') || n.includes('HAMMERMILL') || n.includes('STAMPMILL') || n.includes('LINER') || n.includes('ROLLER') || n.includes('VIBRATING') || n.includes('SEPARATOR') || n.includes('WET-PAN') || n.includes('PAN-MILL')) return 'Processing';
  if (n.includes('CYANIDE') || n.includes('BORAX') || n.includes('ACID') || n.includes('NITRIC') || n.includes('LIME') || n.includes('CAUSTIC') || n.includes('CARBON') || n.includes('LEAD') || n.includes('ZINC') || n.includes('SILVER') || n.includes('AMMONIUM') || n.includes('HYDRO') || n.includes('SULPHURIC') || n.includes('SODA') || n.includes('CHLORIDE') || n.includes('NITRATE') || n.includes('PHENOLPHTHALEIN') || n.includes('IODIDE') || n.includes('TIN GRANULES') || n.includes('AQUARAGIA')) return 'Chemicals';
  if (n.includes('TRACTOR') || n.includes('PLOUGH') || n.includes('FORKLIFT') || n.includes('WALKING') || n.includes('DISC PLOUGH')) return 'Agricultural';
  if (n.includes('SHOE') || n.includes('BOVA')) return 'Footwear';
  if (n.includes('POLY PIPE') || n.includes('PIPE') || n.includes('BLUELINE')) return 'Pipes';
  if (n.includes('BARREL') || n.includes('DRUM') || n.includes('AMALGUM') || n.includes('TANK') || n.includes('STAND') || n.includes('BIN') || n.includes('LAUNDER') || n.includes('WHEELBARROW') || n.includes('TRAILER') || n.includes('BASE PLATE') || n.includes('ANGLE IRON') || n.includes('DEFORMED BAR') || n.includes('PLATE') || n.includes('STEEL') || n.includes('GREEN MAT') || n.includes('REDMAT')) return 'Fabrication';
  if (n.includes('CLOTH') || n.includes('MUTTON') || n.includes('SHEET') || n.includes('BLACK') || n.includes('ROPE') || n.includes('POLYS') || n.includes('SHADE') || n.includes('PVC GL')) return 'Consumables';
  return 'General';
}

function parseLine(line) {
  line = line.trim();
  if (!line || line.length < 10) return null;
  
  // Get item number
  const itemMatch = line.match(/^(\S+)\s{2,}/);
  if (!itemMatch) return null;
  const itemNo = itemMatch[1];
  let rest = line.slice(itemMatch[0].length).trim();
  
  // Remove unit label "IT" if present
  rest = rest.replace(/\bIT\b\s*/, '');
  
  // Find last number (incl VAT)
  const lastNumMatch = rest.match(/([\d,.]+)\s*$/);
  if (!lastNumMatch) return null;
  const inclVat = parseFloat(lastNumMatch[1].replace(/,/g, ''));
  rest = rest.slice(0, -lastNumMatch[0].length).trim();
  
  // Find second last number (excl VAT)
  const exclMatch = rest.match(/([\d,.]+)\s*$/);
  let exclVat = 0;
  if (exclMatch) {
    exclVat = parseFloat(exclMatch[1].replace(/,/g, ''));
    rest = rest.slice(0, -exclMatch[0].length).trim();
  }
  
  const name = rest.trim();
  if (name.length < 3) return null;
  
  const price = inclVat > 0 ? inclVat : exclVat;
  if (price <= 0) return null;
  
  return { item_no: itemNo, name, price, stock: 10, category: guessCat(name) };
}

async function main() {
  const { token } = await apiCall('POST', '/api/auth/login', null, {
    email: 'admin@mineazy.com', password: 'admin123',
  });
  
  const data = fs.readFileSync('./import_data.txt', 'utf8');
  const lines = data.split('\n').filter(Boolean);
  
  const products = [];
  for (const line of lines) {
    const p = parseLine(line);
    if (p && p.price > 0 && p.name.length > 3) {
      products.push(p);
    }
  }
  
  console.log(`Parsed ${products.length} products from import_data.txt`);
  
  let inserted = 0;
  let failed = 0;
  
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    try {
      await apiCall('POST', '/api/products', token, {
        name: `${p.item_no} - ${p.name}`,
        category: p.category,
        description: `Item: ${p.item_no}`,
        price: p.price,
        stock: p.stock,
      });
      inserted++;
      if (inserted % 50 === 0) console.log(`  ${inserted}/${products.length} inserted...`);
    } catch (e) {
      failed++;
    }
  }
  
  console.log(`\nDone! Inserted: ${inserted}, Failed: ${failed}`);
}

main().catch(e => console.error(e.message));
