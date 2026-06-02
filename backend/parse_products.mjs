import fs from 'fs';

const raw = `ZSPI132   PVC MALE COUPLING 63MM       0.44    0.51
ZSPI133   PVC MALE COUPLING 75MM       0.66    0.76
ZSPI134   PVC MALE COUPLING 90MM       0.87    1.01`;

// Read from clipboard file
const data = fs.readFileSync('./import_data.txt', 'utf8');
const lines = data.split('\n').filter(l => l.trim().length > 5);

function parseLine(line) {
  // Remove trailing whitespace
  line = line.trim();
  
  // Item number is first word (alphanumeric, no spaces)
  const itemMatch = line.match(/^(\S+)\s+/);
  if (!itemMatch) return null;
  const itemNo = itemMatch[1];
  
  // Rest after item number
  let rest = line.slice(itemMatch[0].length).trim();
  
  // Try to find the price at the end - the incl VAT is the last number
  // Look for the last number(s) in the string
  const priceMatch = rest.match(/([\d,.]+)\s*$/);
  if (!priceMatch) return null;
  const inclVat = parseFloat(priceMatch[1].replace(/,/g, ''));
  
  // Remove the last number to get the name
  let name = rest.slice(0, -priceMatch[0].length).trim();
  
  // Try to find excl VAT
  const exclMatch = name.match(/([\d,.]+)\s*$/);
  let exclVat = 0;
  if (exclMatch) {
    exclVat = parseFloat(exclMatch[1].replace(/,/g, ''));
    name = name.slice(0, -exclMatch[0].length).trim();
  }
  
  // Remove any remaining trailing "IT" unit marker
  name = name.replace(/\s+IT\s*$/i, '').trim();
  
  // Use incl VAT as the price (what customer pays)
  return {
    item_no: itemNo,
    name,
    price: inclVat || exclVat || 0,
    category: guessCategory(name),
  };
}

function guessCategory(name) {
  const n = name.toUpperCase();
  if (n.includes('BATTERY') || n.includes('DUCELLIER') || n.includes('DUCELLER') || n.includes('EXIDE') || n.includes('RAYLITE')) return 'Batteries';
  if (n.includes('BEARING') || n.includes('PLUMMER') || n.includes('P/BLOCK') || n.includes('UCP') || n.includes('UCF')) return 'Bearings & Blocks';
  if (n.includes('BELT') || n.includes('V BELT') || n.includes('V-BELT')) return 'Belts';
  if (n.includes('ENGINE') || n.includes('DIESEL') || n.includes('PISTON') || n.includes('RING') || n.includes('CRANK') || n.includes('CYLINDER') || n.includes('CONROD') || n.includes('SLEEVE') || n.includes('GASKET') || n.includes('VALVE') || n.includes('CARBURETOR') || n.includes('INJECTOR') || n.includes('OIL PUMP') || n.includes('WATER PUMP') || n.includes('TAPPET')) return 'Engine Parts';
  if (n.includes('GENERATOR') || n.includes('ALTERNATOR') || n.includes('AVR') || n.includes('STATOR') || n.includes('ROTOR') || n.includes('EXCITOR')) return 'Generators & Alternators';
  if (n.includes('COMPRESSOR') || n.includes('AIRLEG') || n.includes('JACKHAMMER') || n.includes('DRILL') || n.includes('CHUCK') || n.includes('PUMPUM') || n.includes('PUM PUM') || n.includes('RIFFLE') || n.includes('Y18') || n.includes('Y24') || n.includes('Y20') || n.includes('S215')) return 'Mining Equipment';
  if (n.includes('PUMP') || n.includes('SEWAGE') || n.includes('SLURRY') || n.includes('SUBMERSIBLE') || n.includes('IMPELLER') || n.includes('MECHANICAL SEAL') || n.includes('BOOSTER')) return 'Pumps & Parts';
  if (n.includes('WELDING') || n.includes('ELECTRODE') || n.includes('WELD') || n.includes('BRAZING') || n.includes('SOLDER') || n.includes('PLASMA')) return 'Welding';
  if (n.includes('MOTOR') || n.includes('ELECTRIC')) return 'Motors';
  if (n.includes('WIRE') || n.includes('BARBED') || n.includes('FENCE') || n.includes('FIELD') || n.includes('POST') || n.includes('PANEL')) return 'Fencing';
  if (n.includes('CABLE') || n.includes('BREAKER') || n.includes('CONTACTOR') || n.includes('SWITCH') || n.includes('SOCKET') || n.includes('LAMP') || n.includes('ANDELI') || n.includes('BOX') || n.includes('METER') || n.includes('TIMER') || n.includes('PLUG') || n.includes('LUGS') || n.includes('TIES') || n.includes('GLAND') || n.includes('TERMINAL') || n.includes('DIN RAIL')) return 'Electrical';
  if (n.includes('BOLT') || n.includes('NUT') || n.includes('WASHER') || n.includes('STUDDING') || n.includes('NYLOC')) return 'Fasteners';
  if (n.includes('HOSE') || n.includes('CLAMP') || n.includes('COUPLING') || n.includes('CAM') || n.includes('FITTING') || n.includes('ELBOW') || n.includes('TEE') || n.includes('NIPPLE') || n.includes('VALVE') || n.includes('PIPE') || n.includes('PVC') || n.includes('HDPE') || n.includes('GALV') || n.includes('POLY PIPE') || n.includes('SOCKET') || n.includes('UNION')) return 'Pipes & Fittings';
  if (n.includes('GLOVE') || n.includes('BOOT') || n.includes('HELMET') || n.includes('GOGGLE') || n.includes('MASK') || n.includes('WORKSUIT') || n.includes('OVERALL') || n.includes('DUST COAT') || n.includes('SAFETY')) return 'Safety & PPE';
  if (n.includes('GREASE') || n.includes('OIL') || n.includes('LUBRICANT') || n.includes('DEGREASER') || n.includes('HYSPIN') || n.includes('BRAKE FLUID') || n.includes('THREADLOCKER') || n.includes('GLUE') || n.includes('EPOX') || n.includes('M-SEAL')) return 'Lubricants & Chemicals';
  if (n.includes('HAMMER') || n.includes('PLIER') || n.includes('SPANNER') || n.includes('WRENCH') || n.includes('SOCKET') || n.includes('GRINDER') || n.includes('SAW') || n.includes('DRILL') || n.includes('SCREW') || n.includes('TAPE') || n.includes('LEVEL') || n.includes('EAZY TOOLS') || n.includes('POWER ACTION') || n.includes('JACK') || n.includes('CHISEL') || n.includes('AXE') || n.includes('PICK') || n.includes('SHOVEL') || n.includes('CUTTER') || n.includes('BLADE') || n.includes('DISC') || n.includes('WHEEL') || n.includes('TOOL')) return 'Tools & Hardware';
  if (n.includes('WINCH') || n.includes('HOIST') || n.includes('CHAIN BLOCK') || n.includes('PALLET') || n.includes('JACK') || n.includes('CRANE') || n.includes('LIFTING')) return 'Lifting Equipment';
  if (n.includes('CRUSHER') || n.includes('MILL') || n.includes('SCREEN') || n.includes('CONVEYOR') || n.includes('JAW') || n.includes('ROUNDMILL') || n.includes('BALL MILL') || n.includes('HAMMERMILL') || n.includes('STAMPMILL') || n.includes('LINER') || n.includes('ROLLER') || n.includes('VIBRATING') || n.includes('SEPARATOR')) return 'Processing Equipment';
  if (n.includes('CYANIDE') || n.includes('BORAX') || n.includes('ACID') || n.includes('NITRIC') || n.includes('LIME') || n.includes('CAUSTIC') || n.includes('CARBON') || n.includes('LEAD') || n.includes('ZINC') || n.includes('SILVER') || n.includes('CHEMICAL') || n.includes('AMMONIUM')) return 'Chemicals & Reagents';
  if (n.includes('BAG') || n.includes('CLOTH') || n.includes('MUTTON') || n.includes('SHEET') || n.includes('BLACK') || n.includes('ROPE') || n.includes('POLYS')) return 'Consumables';
  if (n.includes('TRACTOR') || n.includes('PLOUGH') || n.includes('FORKLIFT') || n.includes('WALKING TRACTOR') || n.includes('DISC')) return 'Agricultural';
  if (n.includes('SHOE') || n.includes('BOVA')) return 'Footwear';
  return 'General';
}

// Parse all lines
const products = [];
for (const line of lines) {
  const p = parseLine(line);
  if (p && p.price > 0 && p.name.length > 3) {
    products.push(p);
  }
}

console.log(`Parsed ${products.length} products`);

// Write as JSON for import
const batchSize = 50;
const batches = [];
for (let i = 0; i < products.length; i += batchSize) {
  batches.push(products.slice(i, i + batchSize));
}

fs.writeFileSync('./import_products.json', JSON.stringify(products, null, 2));
fs.writeFileSync('./import_batches.json', JSON.stringify(batches.length));
console.log(`Written in ${batches.length} batches of ${batchSize}`);
console.log(`Run: node import_to_api.mjs to import`);
