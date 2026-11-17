const bcrypt = require('bcryptjs');
const db = require('./db');

const hash = (p) => bcrypt.hashSync(p, 10);

// ผู้ดูแลระบบ 5 บัญชี (สร้างก่อนเพื่อให้มี admin_id อ้างอิงใน supplier และ customer ตาม ER)
const ADMINS = [
  { id: 1, name: 'ภูวมินทร์ วัฒนสาร', email: 'phuwamin@shop.com', phone: '081-000-0001' },
  { id: 2, name: 'ธนกร อิ่มเพ็ง', email: 'thanakorn@shop.com', phone: '081-000-0002' },
  { id: 3, name: 'ธนดล สมจิตต์', email: 'thanadon@shop.com', phone: '081-000-0003' },
  { id: 4, name: 'สหภาพ ศิริพร', email: 'sahapap@shop.com', phone: '081-000-0004' },
  { id: 5, name: 'ปวริศา โสมี', email: 'pawarisa@shop.com', phone: '081-000-0005' },
];

db.exec('PRAGMA foreign_keys = OFF;');
db.prepare("DELETE FROM admin WHERE email='admin@shop.com' OR name='ผู้ดูแลระบบ'").run();
for (const a of ADMINS) {
  const existing = db.prepare('SELECT admin_id FROM admin WHERE admin_id=? OR email=?').get(a.id, a.email);
  if (existing) {
    db.prepare('UPDATE admin SET name=?, email=?, phone=?, password_hash=? WHERE admin_id=?')
      .run(a.name, a.email, a.phone, hash('admin1234'), existing.admin_id);
  } else {
    db.prepare('INSERT INTO admin (admin_id,name,email,phone,password_hash) VALUES (?,?,?,?,?)')
      .run(a.id, a.name, a.email, a.phone, hash('admin1234'));
  }
}
db.exec('PRAGMA foreign_keys = ON;');
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
const FAKE_CUSTOMERS = [
  {
    first_name: 'ณัฐพร',
    last_name: 'กิจเจริญ',
    email: 'nattaporn.k@fake.com',
    phone: '081-234-5678',
    password: 'Customer01#',
    admin_id: 1,
    address: '12/3 หมู่ 4 ถนนสุขุมวิท ตำบลคลองเตย อำเภอคลองเตย กรุงเทพมหานคร 10110',
    addr_parts: { house_no: '12/3', village: 'หมู่ 4', road: 'ถนนสุขุมวิท', subdistrict: 'คลองเตย', district: 'คลองเตย', province: 'กรุงเทพมหานคร', postal_code: '10110' }
  },
  {
    first_name: 'กิตติศักดิ์',
    last_name: 'สุวรรณรัตน์',
    email: 'kittisak.s@fake.com',
    phone: '082-345-6789',
    password: 'Customer02#',
    admin_id: 2,
    address: '88/15 หมู่บ้านพฤกษา ถนนพหลโยธิน ตำบลคลองหนึ่ง อำเภอคลองหลวง ปทุมธานี 12120',
    addr_parts: { house_no: '88/15', village: 'หมู่บ้านพฤกษา', road: 'ถนนพหลโยธิน', subdistrict: 'คลองหนึ่ง', district: 'คลองหลวง', province: 'ปทุมธานี', postal_code: '12120' }
  },
  {
    first_name: 'ชลธิชา',
    last_name: 'วงศ์สว่าง',
    email: 'chonthicha.w@fake.com',
    phone: '083-456-7890',
    password: 'Customer03#',
    admin_id: 3,
    address: '45/9 หมู่ 2 ถนนงามวงศ์วาน ตำบลบางเขน อำเภอเมืองนนทบุรี นนทบุรี 11000',
    addr_parts: { house_no: '45/9', village: 'หมู่ 2', road: 'ถนนงามวงศ์วาน', subdistrict: 'บางเขน', district: 'เมืองนนทบุรี', province: 'นนทบุรี', postal_code: '11000' }
  },
  {
    first_name: 'วรเมธ',
    last_name: 'รัตนเดช',
    email: 'worameth.r@fake.com',
    phone: '084-567-8901',
    password: 'Customer04#',
    admin_id: 4,
    address: '102/4 หมู่บ้านศุภาลัย ถนนเพชรเกษม ตำบลบางหว้า อำเภอภาษีเจริญ กรุงเทพมหานคร 10160',
    addr_parts: { house_no: '102/4', village: 'หมู่บ้านศุภาลัย', road: 'ถนนเพชรเกษม', subdistrict: 'บางหว้า', district: 'ภาษีเจริญ', province: 'กรุงเทพมหานคร', postal_code: '10160' }
  },
  {
    first_name: 'พิชญา',
    last_name: 'บุญเลิศ',
    email: 'pitchaya.b@fake.com',
    phone: '085-678-9012',
    password: 'Customer05#',
    admin_id: 5,
    address: '77/2 หมู่ 6 ถนนนิมมานเหมินท์ ตำบลสุเทพ อำเภอเมืองเชียงใหม่ เชียงใหม่ 50200',
    addr_parts: { house_no: '77/2', village: 'หมู่ 6', road: 'ถนนนิมมานเหมินท์', subdistrict: 'สุเทพ', district: 'เมืองเชียงใหม่', province: 'เชียงใหม่', postal_code: '50200' }
  },
  {
    first_name: 'ธนาธิป',
    last_name: 'ประเสริฐยิ่ง',
    email: 'thanathip.p@fake.com',
    phone: '086-789-0123',
    password: 'Customer06#',
    admin_id: 1,
    address: '215/8 หมู่ 3 ถนนลงหาดบางแสน ตำบลแสนสุข อำเภอเมืองชลบุรี ชลบุรี 20130',
    addr_parts: { house_no: '215/8', village: 'หมู่ 3', road: 'ถนนลงหาดบางแสน', subdistrict: 'แสนสุข', district: 'เมืองชลบุรี', province: 'ชลบุรี', postal_code: '20130' }
  },
  {
    first_name: 'ศิริพร',
    last_name: 'มณีโชติ',
    email: 'siriporn.m@fake.com',
    phone: '087-890-1234',
    password: 'Customer07#',
    admin_id: 2,
    address: '64/1 หมู่บ้านลดาวัลย์ ถนนศรีนครินทร์ ตำบลบางแก้ว อำเภอบางพลี สมุทรปราการ 10540',
    addr_parts: { house_no: '64/1', village: 'หมู่บ้านลดาวัลย์', road: 'ถนนศรีนครินทร์', subdistrict: 'บางแก้ว', district: 'บางพลี', province: 'สมุทรปราการ', postal_code: '10540' }
  },
  {
    first_name: 'อนุชา',
    last_name: 'อักษรศรี',
    email: 'anucha.a@fake.com',
    phone: '088-901-2345',
    password: 'Customer08#',
    admin_id: 3,
    address: '159/3 หมู่ 1 ถนนมิตรภาพ ตำบลในเมือง อำเภอเมืองนครราชสีมา นครราชสีมา 30000',
    addr_parts: { house_no: '159/3', village: 'หมู่ 1', road: 'ถนนมิตรภาพ', subdistrict: 'ในเมือง', district: 'เมืองนครราชสีมา', province: 'นครราชสีมา', postal_code: '30000' }
  },
  {
    first_name: 'กัญญาณัฐ',
    last_name: 'สัจธรรม',
    email: 'kanyanat.s@fake.com',
    phone: '089-012-3456',
    password: 'Customer09#',
    admin_id: 4,
    address: '33/7 หมู่บ้านแสนสิริ ถนนพระราม 2 ตำบลท่าข้าม อำเภอบางขุนเทียน กรุงเทพมหานคร 10150',
    addr_parts: { house_no: '33/7', village: 'หมู่บ้านแสนสิริ', road: 'ถนนพระราม 2', subdistrict: 'ท่าข้าม', district: 'บางขุนเทียน', province: 'กรุงเทพมหานคร', postal_code: '10150' }
  },
  {
    first_name: 'ธีรภัทร',
    last_name: 'จินดารัตน์',
    email: 'theerapat.j@fake.com',
    phone: '090-123-4567',
    password: 'Customer10#',
    admin_id: 5,
    address: '512/9 หมู่ 5 ถนนมะลิวัลย์ ตำบลในเมือง อำเภอเมืองขอนแก่น ขอนแก่น 40000',
    addr_parts: { house_no: '512/9', village: 'หมู่ 5', road: 'ถนนมะลิวัลย์', subdistrict: 'ในเมือง', district: 'เมืองขอนแก่น', province: 'ขอนแก่น', postal_code: '40000' }
  },
  {
    first_name: 'ปริยากร',
    last_name: 'อินทร์แก้ว',
    email: 'pariyakorn.i@fake.com',
    phone: '091-234-5678',
    password: 'Customer11#',
    admin_id: 1,
    address: '28/4 หมู่ 2 ถนนเทพกระษัตรี ตำบลตลาดใหญ่ อำเภอเมืองภูเก็ต ภูเก็ต 83000',
    addr_parts: { house_no: '28/4', village: 'หมู่ 2', road: 'ถนนเทพกระษัตรี', subdistrict: 'ตลาดใหญ่', district: 'เมืองภูเก็ต', province: 'ภูเก็ต', postal_code: '83000' }
  },
  {
    first_name: 'ภาณุพงศ์',
    last_name: 'รุ่งเรือง',
    email: 'panupong.r@fake.com',
    phone: '092-345-6789',
    password: 'Customer12#',
    admin_id: 2,
    address: '90/11 หมู่บ้านคาซ่าวิลล์ ถนนราชพฤกษ์ ตำบลบางรักน้อย อำเภอเมืองนนทบุรี นนทบุรี 11000',
    addr_parts: { house_no: '90/11', village: 'หมู่บ้านคาซ่าวิลล์', road: 'ถนนราชพฤกษ์', subdistrict: 'บางรักน้อย', district: 'เมืองนนทบุรี', province: 'นนทบุรี', postal_code: '11000' }
  },
  {
    first_name: 'อภิญญา',
    last_name: 'พงษ์พาณิชย์',
    email: 'apinya.p@fake.com',
    phone: '093-456-7890',
    password: 'Customer13#',
    admin_id: 3,
    address: '14/2 หมู่ 8 ถนนสุรนารายณ์ ตำบลบ้านเกาะ อำเภอเมืองนครราชสีมา นครราชสีมา 30000',
    addr_parts: { house_no: '14/2', village: 'หมู่ 8', road: 'ถนนสุรนารายณ์', subdistrict: 'บ้านเกาะ', district: 'เมืองนครราชสีมา', province: 'นครราชสีมา', postal_code: '30000' }
  },
  {
    first_name: 'กรกช',
    last_name: 'ตันติวิวัฒน์',
    email: 'korakot.t@fake.com',
    phone: '094-567-8901',
    password: 'Customer14#',
    admin_id: 4,
    address: '119/5 หมู่บ้านชัยพฤกษ์ ถนนรามอินทรา ตำบลคันนายาว อำเภอคันนายาว กรุงเทพมหานคร 10230',
    addr_parts: { house_no: '119/5', village: 'หมู่บ้านชัยพฤกษ์', road: 'ถนนรามอินทรา', subdistrict: 'คันนายาว', district: 'คันนายาว', province: 'กรุงเทพมหานคร', postal_code: '10230' }
  },
  {
    first_name: 'มนัสวี',
    last_name: 'ศรีสุวรรณ',
    email: 'manatsawee.s@fake.com',
    phone: '095-678-9012',
    password: 'Customer15#',
    admin_id: 5,
    address: '67/12 หมู่ 7 ถนนซุปเปอร์ไฮเวย์ ตำบลช้างเผือก อำเภอเมืองเชียงใหม่ เชียงใหม่ 50300',
    addr_parts: { house_no: '67/12', village: 'หมู่ 7', road: 'ถนนซุปเปอร์ไฮเวย์', subdistrict: 'ช้างเผือก', district: 'เมืองเชียงใหม่', province: 'เชียงใหม่', postal_code: '50300' }
  },
  {
    first_name: 'พงศธร',
    last_name: 'ศักดิ์เจริญ',
    email: 'pongsatorn.s@fake.com',
    phone: '096-789-0123',
    password: 'Customer16#',
    admin_id: 1,
    address: '203/6 หมู่ 1 ถนนสุขุมวิทพัทยา ตำบลนาเกลือ อำเภอบางละมุง ชลบุรี 20150',
    addr_parts: { house_no: '203/6', village: 'หมู่ 1', road: 'ถนนสุขุมวิทพัทยา', subdistrict: 'นาเกลือ', district: 'บางละมุง', province: 'ชลบุรี', postal_code: '20150' }
  },
  {
    first_name: 'ลลิตา',
    last_name: 'วรเวช',
    email: 'lalita.w@fake.com',
    phone: '097-890-1234',
    password: 'Customer17#',
    admin_id: 2,
    address: '55/18 หมู่บ้านเพอร์เฟคเพลส ถนนแจ้งวัฒนะ ตำบลบางพูด อำเภอปากเกร็ด นนทบุรี 11120',
    addr_parts: { house_no: '55/18', village: 'หมู่บ้านเพอร์เฟคเพลส', road: 'ถนนแจ้งวัฒนะ', subdistrict: 'บางพูด', district: 'ปากเกร็ด', province: 'นนทบุรี', postal_code: '11120' }
  },
  {
    first_name: 'ศรัณย์',
    last_name: 'ธรรมทัศน์',
    email: 'saran.t@fake.com',
    phone: '098-901-2345',
    password: 'Customer18#',
    admin_id: 3,
    address: '84/3 หมู่ 3 ถนนเพชรเกษม ตำบลชะอำ อำเภอชะอำ เพชรบุรี 76120',
    addr_parts: { house_no: '84/3', village: 'หมู่ 3', road: 'ถนนเพชรเกษม', subdistrict: 'ชะอำ', district: 'ชะอำ', province: 'เพชรบุรี', postal_code: '76120' }
  },
  {
    first_name: 'นภัสสร',
    last_name: 'กิตติคุณ',
    email: 'napatsorn.k@fake.com',
    phone: '099-012-3456',
    password: 'Customer19#',
    admin_id: 4,
    address: '310/2 หมู่บ้านมัณฑนา ถนนกาญจนาภิเษก ตำบลบางแค อำเภอบางแค กรุงเทพมหานคร 10160',
    addr_parts: { house_no: '310/2', village: 'หมู่บ้านมัณฑนา', road: 'ถนนกาญจนาภิเษก', subdistrict: 'บางแค', district: 'บางแค', province: 'กรุงเทพมหานคร', postal_code: '10160' }
  },
  {
    first_name: 'ชานนท์',
    last_name: 'วิมลศิลป์',
    email: 'chanon.w@fake.com',
    phone: '080-123-4567',
    password: 'Customer20#',
    admin_id: 5,
    address: '42/15 หมู่ 5 ถนนรอบเมือง ตำบลหมากแข้ง อำเภอเมืองอุดรธานี อุดรธานี 41000',
    addr_parts: { house_no: '42/15', village: 'หมู่ 5', road: 'ถนนรอบเมือง', subdistrict: 'หมากแข้ง', district: 'เมืองอุดรธานี', province: 'อุดรธานี', postal_code: '41000' }
  }
];

if (!db.prepare('SELECT 1 FROM customer WHERE email=?').get('demo@shop.com')) {
  const defaultAddrText = '99/1 หมู่บ้านสุขใจ ถนนบางนา-ตราด บางพลีใหญ่ บางพลี สมุทรปราการ 10540';
  const c = db.prepare('INSERT INTO customer (first_name,last_name,phone,email,address,admin_id,password_hash) VALUES (?,?,?,?,?,?,?)')
    .run('สมชาย', 'ทดสอบ', '089-999-9999', 'demo@shop.com', defaultAddrText, defaultAdminId, hash('demo1234'));
  db.prepare(`INSERT INTO address (customer_id,recipient,phone,house_no,village,road,subdistrict,district,province,postal_code,is_default)
    VALUES (?,?,?,?,?,?,?,?,?,?,1)`)
    .run(c.lastInsertRowid, 'สมชาย ทดสอบ', '089-999-9999', '99/1', 'หมู่บ้านสุขใจ', 'ถนนบางนา-ตราด', 'บางพลีใหญ่', 'บางพลี', 'สมุทรปราการ', '10540');
}

for (const fc of FAKE_CUSTOMERS) {
  const existing = db.prepare('SELECT customer_id FROM customer WHERE email=?').get(fc.email);
  if (!existing) {
    const c = db.prepare('INSERT INTO customer (first_name,last_name,phone,email,address,admin_id,password_hash) VALUES (?,?,?,?,?,?,?)')
      .run(fc.first_name, fc.last_name, fc.phone, fc.email, fc.address, fc.admin_id || defaultAdminId, hash(fc.password));
    const cid = c.lastInsertRowid;
    const ap = fc.addr_parts;
    db.prepare(`INSERT INTO address (customer_id,recipient,phone,house_no,village,road,subdistrict,district,province,postal_code,is_default)
      VALUES (?,?,?,?,?,?,?,?,?,?,1)`)
      .run(cid, `${fc.first_name} ${fc.last_name}`, fc.phone, ap.house_no, ap.village, ap.road, ap.subdistrict, ap.district, ap.province, ap.postal_code);
  }
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

const { createRealtimeSqlManager } = require('./mssql-sync');
createRealtimeSqlManager(db).notifyChange('seed', 'seed');

console.log('ระบบพร้อมใช้งาน:');
console.log('หมวดหมู่ที่จำหน่าย: เสื้อยืด, เสื้อโปโล, เสื้อแขนยาว, กางเกง');
console.log('แอดมินทั้ง 5 บัญชี (รหัสผ่าน: admin1234):');
for (const a of ADMINS) {
  console.log(`  #${a.id} ${a.name} — ${a.email}`);
}
console.log('ลูกค้า (เดโม่): demo@shop.com / demo1234');
console.log(`ลูกค้าตัวอย่าง (${FAKE_CUSTOMERS.length} บัญชี): พร้อมใช้งาน (รหัสผ่านตามลำดับ Customer01# ถึง Customer20#)`);
