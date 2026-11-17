const bcrypt = require('bcryptjs');
const db = require('./db');

const hash = (p) => bcrypt.hashSync(p, 10);

// ผู้ดูแลระบบ (สร้างก่อนเพื่อให้มี admin_id อ้างอิงใน supplier และ customer ตาม ER)
if (!db.prepare('SELECT 1 FROM admin WHERE email=?').get('admin@shop.com')) {
  db.prepare('INSERT INTO admin (name,email,phone,password_hash) VALUES (?,?,?,?)')
    .run('ผู้ดูแลระบบ', 'admin@shop.com', '080-000-0000', hash('admin1234'));
}
const defaultAdminId = db.prepare('SELECT admin_id FROM admin ORDER BY admin_id LIMIT 1').get()?.admin_id || 1;

// พนักงาน / ซัพพลายเออร์ (สร้างหากยังไม่มี)
if (db.prepare('SELECT COUNT(*) c FROM employee').get().c === 0) {
  const emp = db.prepare('INSERT INTO employee (first_name,last_name,email,phone,position,address) VALUES (?,?,?,?,?,?)');
  emp.run('สมศรี', 'ใจดี', 'somsri@shop.com', '081-111-1111', 'ผู้จัดการฝ่ายจัดซื้อ', '123 ถนนสุขุมวิท เขตวัฒนา กรุงเทพมหานคร');
  emp.run('ธนากร', 'มั่นคง', 'thanakorn@shop.com', '082-222-2222', 'เจ้าหน้าที่คลังสินค้า', '45/8 ถนนพระราม 9 เขตห้วยขวาง กรุงเทพมหานคร');
} else {
  db.prepare("UPDATE employee SET address='123 ถนนสุขุมวิท เขตวัฒนา กรุงเทพมหานคร' WHERE employee_id=1 AND (address IS NULL OR address='')").run();
  db.prepare("UPDATE employee SET address='45/8 ถนนพระราม 9 เขตห้วยขวาง กรุงเทพมหานคร' WHERE employee_id=2 AND (address IS NULL OR address='')").run();
}

if (db.prepare('SELECT COUNT(*) c FROM supplier').get().c === 0) {
  const sup = db.prepare('INSERT INTO supplier (name,contact_name,phone,email,address,employee_id,admin_id) VALUES (?,?,?,?,?,?,?)');
  sup.run('Siam Textile Co.', 'คุณวิชัย', '02-111-2222', 'sales@siamtextile.example', 'กรุงเทพมหานคร', 1, defaultAdminId);
  sup.run('Lanna Garment', 'คุณมาลี', '053-333-444', 'hello@lannagarment.example', 'เชียงใหม่', 2, defaultAdminId);
  sup.run('Denim House', 'คุณก้อง', '038-555-666', 'order@denimhouse.example', 'ชลบุรี', 1, defaultAdminId);
} else {
  db.prepare('UPDATE supplier SET admin_id=? WHERE admin_id IS NULL').run(defaultAdminId);
}

// ลูกค้าตัวอย่าง (สร้างหากยังไม่มี)
if (!db.prepare('SELECT 1 FROM customer WHERE email=?').get('demo@shop.com')) {
  const defaultAddrText = '99/1 หมู่บ้านสุขใจ ถนนบางนา-ตราด บางพลีใหญ่ บางพลี สมุทรปราการ 10540';
  const c = db.prepare('INSERT INTO customer (first_name,last_name,phone,email,address,admin_id,password_hash) VALUES (?,?,?,?,?,?,?)')
    .run('สมชาย', 'ทดสอบ', '089-999-9999', 'demo@shop.com', defaultAddrText, defaultAdminId, hash('demo1234'));
  db.prepare(`INSERT INTO address (customer_id,recipient,phone,house_no,village,road,subdistrict,district,province,postal_code,is_default)
    VALUES (?,?,?,?,?,?,?,?,?,?,1)`)
    .run(c.lastInsertRowid, 'สมชาย ทดสอบ', '089-999-9999', '99/1', 'หมู่บ้านสุขใจ', 'ถนนบางนา-ตราด', 'บางพลีใหญ่', 'บางพลี', 'สมุทรปราการ', '10540');
}

// คูปอง
if (!db.prepare('SELECT 1 FROM coupon WHERE code=?').get('WELCOME10')) {
  db.prepare('INSERT INTO coupon (code,type,value,min_total) VALUES (?,?,?,?)').run('WELCOME10', 'percent', 10, 0);
}
if (!db.prepare('SELECT 1 FROM coupon WHERE code=?').get('SAVE100')) {
  db.prepare('INSERT INTO coupon (code,type,value,min_total) VALUES (?,?,?,?)').run('SAVE100', 'fixed', 100, 1000);
}

// ตรวจสอบพารามิเตอร์ --samples เพื่อใส่สินค้าตัวอย่างเฉพาะ 4 หมวดหมู่ (เสื้อยืด, เสื้อโปโล, เสื้อแขนยาว, กางเกง)
const withSamples = process.argv.includes('--samples');

if (withSamples) {
  const COLORS = {
    'ขาว': '#FAFAF7', 'ดำ': '#1A1A1A', 'ครีม': '#EADFC8', 'เบจ': '#C8B79C', 'น้ำเงินเข้ม': '#2B3447', 'เทา': '#8A8A86',
  };
  const products = [
    ['เสื้อยืด Essential Tee', 'เสื้อยืด', 'เสื้อยืดคอตตอน 100% ผ้าหนานุ่ม ทรงเรกูลาร์ ใส่สบายทุกวัน', 1, 1, 1, 'tee', 390, ['S', 'M', 'L', 'XL'], ['ขาว', 'ดำ', 'ครีม']],
    ['เสื้อโปโล Pique Classic', 'เสื้อโปโล', 'เสื้อโปโลผ้าปิเก้ คอปกทอแน่น ทรงสมาร์ทแคชชวล', 2, 2, 1, 'polo', 590, ['S', 'M', 'L', 'XL'], ['ครีม', 'ขาว', 'ดำ']],
    ['เสื้อแขนยาว Heavy Cotton', 'เสื้อแขนยาว', 'เสื้อแขนยาวคอกลมผ้าหนา ทรงโอเวอร์ไซส์ จั๊มปลายแขน', 1, 1, 1, 'longsleeve', 690, ['M', 'L', 'XL'], ['ดำ', 'ครีม', 'เทา']],
    ['กางเกงขายาว Minimal Chino', 'กางเกง', 'ชิโนผ้าทวิล ทรงกระบอกตรง ใส่สบาย แมตช์ได้กับเสื้อทุกแบบ', 3, 2, 1, 'pants', 1090, ['28', '30', '32', '34'], ['เบจ', 'ดำ', 'ครีม']],
  ];

  const insP = db.prepare('INSERT INTO product (name,category,description,supplier_id,employee_id,is_featured,image_url,stock,quantity,price) VALUES (?,?,?,?,?,?,?,0,0,?)');
  const insV = db.prepare('INSERT INTO product_variant (product_id,size,color,color_hex,price,stock,stock_quantity,sku) VALUES (?,?,?,?,?,?,?,?)');
  for (const [name, cat, desc, supplier, employee, featured, shape, price, sizes, colors] of products) {
    const pid = insP.run(name, cat, desc, supplier, employee, featured, 'shape:' + shape, price).lastInsertRowid;
    let total = 0;
    for (const color of colors) for (const size of sizes) {
      const stock = 5;
      total += stock;
      insV.run(pid, size, color, COLORS[color] || '#EADFC8', price, stock, stock, `SKU-${pid}-${size}-${color}`.replace(/\s/g, ''));
    }
    db.prepare('UPDATE product SET stock=?, quantity=? WHERE product_id=?').run(total, total, pid);
  }
  console.log('ใส่สินค้าตัวอย่าง 4 หมวดหมู่เรียบร้อยแล้ว');
} else {
  console.log('สต็อกเริ่มต้นว่าง พร้อมให้คุณเพิ่มสินค้าเองผ่านหน้าจัดการร้าน');
}

console.log('ระบบพร้อมใช้งาน:');
console.log('หมวดหมู่ที่จำหน่าย: เสื้อยืด, เสื้อโปโล, เสื้อแขนยาว, กางเกง');
console.log('แอดมิน:  admin@shop.com / admin1234');
console.log('ลูกค้า:   demo@shop.com / demo1234');
