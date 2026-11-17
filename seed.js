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
    address: 'เลขที่ 128/45 ชั้น 14 ห้อง 1402 อาคารพาร์ควิว เอ็กเซ็กคิวทีฟ เรสซิเดนซ์ ซอยสุขุมวิท 55 (ทองหล่อ 13) ถนนสุขุมวิท แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพมหานคร 10110',
    addr_parts: { house_no: 'เลขที่ 128/45 ชั้น 14 ห้อง 1402', village: 'อาคารพาร์ควิว เอ็กเซ็กคิวทีฟ เรสซิเดนซ์', road: 'ซอยสุขุมวิท 55 (ทองหล่อ 13) ถนนสุขุมวิท', subdistrict: 'คลองตันเหนือ', district: 'วัฒนา', province: 'กรุงเทพมหานคร', postal_code: '10110' }
  },
  {
    first_name: 'กิตติศักดิ์',
    last_name: 'สุวรรณรัตน์',
    email: 'kittisak.s@fake.com',
    phone: '082-345-6789',
    password: 'Customer02#',
    admin_id: 2,
    address: 'เลขที่ 88/154 โซน C ซอย 9/2 หมู่บ้านพฤกษาวิลเลจ เดอะซีซัน คลอง 1 หมู่ 6 ซอยรังสิต-นครนายก 32 ถนนพหลโยธิน ตำบลคลองหนึ่ง อำเภอคลองหลวง จังหวัดปทุมธานี 12120',
    addr_parts: { house_no: 'เลขที่ 88/154 โซน C ซอย 9/2', village: 'หมู่บ้านพฤกษาวิลเลจ เดอะซีซัน คลอง 1 หมู่ 6', road: 'ซอยรังสิต-นครนายก 32 ถนนพหลโยธิน', subdistrict: 'คลองหนึ่ง', district: 'คลองหลวง', province: 'ปทุมธานี', postal_code: '12120' }
  },
  {
    first_name: 'ชลธิชา',
    last_name: 'วงศ์สว่าง',
    email: 'chonthicha.w@fake.com',
    phone: '083-456-7890',
    password: 'Customer03#',
    admin_id: 3,
    address: 'เลขที่ 45/92 ชั้น 8 อาคาร B ห้อง 815 คอนโดแอสปาย งามวงศ์วาน หมู่ 2 ซอยงามวงศ์วาน 18 (จุฬาเกษม) ถนนงามวงศ์วาน ตำบลบางเขน อำเภอเมืองนนทบุรี จังหวัดนนทบุรี 11000',
    addr_parts: { house_no: 'เลขที่ 45/92 ชั้น 8 อาคาร B ห้อง 815', village: 'คอนโดแอสปาย งามวงศ์วาน หมู่ 2', road: 'ซอยงามวงศ์วาน 18 (จุฬาเกษม) ถนนงามวงศ์วาน', subdistrict: 'บางเขน', district: 'เมืองนนทบุรี', province: 'นนทบุรี', postal_code: '11000' }
  },
  {
    first_name: 'วรเมธ',
    last_name: 'รัตนเดช',
    email: 'worameth.r@fake.com',
    phone: '084-567-8901',
    password: 'Customer04#',
    admin_id: 4,
    address: 'เลขที่ 102/48 ซอย 15 เฟส 3 หมู่บ้านศุภาลัย พรีมา วิลลา เพชรเกษม ซอยเพชรเกษม 48 แยก 16 ถนนเพชรเกษม แขวงบางหว้า เขตภาษีเจริญ กรุงเทพมหานคร 10160',
    addr_parts: { house_no: 'เลขที่ 102/48 ซอย 15 เฟส 3', village: 'หมู่บ้านศุภาลัย พรีมา วิลลา เพชรเกษม', road: 'ซอยเพชรเกษม 48 แยก 16 ถนนเพชรเกษม', subdistrict: 'บางหว้า', district: 'ภาษีเจริญ', province: 'กรุงเทพมหานคร', postal_code: '10160' }
  },
  {
    first_name: 'พิชญา',
    last_name: 'บุญเลิศ',
    email: 'pitchaya.b@fake.com',
    phone: '085-678-9012',
    password: 'Customer05#',
    admin_id: 5,
    address: 'เลขที่ 77/25 ชั้น 5 ห้อง 503 โครงการเดอะนิมมาน พรีเมียม คอนโดมิเนียม หมู่ 6 ซอยนิมมานเหมินท์ 9 ถนนนิมมานเหมินท์ ตำบลสุเทพ อำเภอเมืองเชียงใหม่ จังหวัดเชียงใหม่ 50200',
    addr_parts: { house_no: 'เลขที่ 77/25 ชั้น 5 ห้อง 503', village: 'โครงการเดอะนิมมาน พรีเมียม คอนโดมิเนียม หมู่ 6', road: 'ซอยนิมมานเหมินท์ 9 ถนนนิมมานเหมินท์', subdistrict: 'สุเทพ', district: 'เมืองเชียงใหม่', province: 'เชียงใหม่', postal_code: '50200' }
  },
  {
    first_name: 'ธนาธิป',
    last_name: 'ประเสริฐยิ่ง',
    email: 'thanathip.p@fake.com',
    phone: '086-789-0123',
    password: 'Customer06#',
    admin_id: 1,
    address: 'เลขที่ 215/84 ซอย 4 บล็อค B หมู่บ้านคาซ่า แกรนด์ มิตรสัมพันธ์-บางแสน หมู่ 3 ซอยมิตรสัมพันธ์ 13 ถนนลงหาดบางแสน ตำบลแสนสุข อำเภอเมืองชลบุรี จังหวัดชลบุรี 20130',
    addr_parts: { house_no: 'เลขที่ 215/84 ซอย 4 บล็อค B', village: 'หมู่บ้านคาซ่า แกรนด์ มิตรสัมพันธ์-บางแสน หมู่ 3', road: 'ซอยมิตรสัมพันธ์ 13 ถนนลงหาดบางแสน', subdistrict: 'แสนสุข', district: 'เมืองชลบุรี', province: 'ชลบุรี', postal_code: '20130' }
  },
  {
    first_name: 'ศิริพร',
    last_name: 'มณีโชติ',
    email: 'siriporn.m@fake.com',
    phone: '087-890-1234',
    password: 'Customer07#',
    admin_id: 2,
    address: 'เลขที่ 64/119 ซอยลดาวัลย์ 8 โซนการ์เดน หมู่บ้านลดาวัลย์ ศรีนครินทร์ โครงการ 2 หมู่ 5 ซอยศรีด่าน 22 ถนนศรีนครินทร์ ตำบลบางแก้ว อำเภอบางพลี จังหวัดสมุทรปราการ 10540',
    addr_parts: { house_no: 'เลขที่ 64/119 ซอยลดาวัลย์ 8 โซนการ์เดน', village: 'หมู่บ้านลดาวัลย์ ศรีนครินทร์ โครงการ 2 หมู่ 5', road: 'ซอยศรีด่าน 22 ถนนศรีนครินทร์', subdistrict: 'บางแก้ว', district: 'บางพลี', province: 'สมุทรปราการ', postal_code: '10540' }
  },
  {
    first_name: 'อนุชา',
    last_name: 'อักษรศรี',
    email: 'anucha.a@fake.com',
    phone: '088-901-2345',
    password: 'Customer08#',
    admin_id: 3,
    address: 'เลขที่ 159/37 ซอยมิตรภาพ 19 แยก 4 หมู่บ้านสีมานคร วิลเลจ แกรนด์พาร์ค หมู่ 1 ซอยมิตรภาพร่วมใจ ถนนมิตรภาพสายหลัก ตำบลในเมือง อำเภอเมืองนครราชสีมา จังหวัดนครราชสีมา 30000',
    addr_parts: { house_no: 'เลขที่ 159/37 ซอยมิตรภาพ 19 แยก 4', village: 'หมู่บ้านสีมานคร วิลเลจ แกรนด์พาร์ค หมู่ 1', road: 'ซอยมิตรภาพร่วมใจ ถนนมิตรภาพสายหลัก', subdistrict: 'ในเมือง', district: 'เมืองนครราชสีมา', province: 'นครราชสีมา', postal_code: '30000' }
  },
  {
    first_name: 'กัญญาณัฐ',
    last_name: 'สัจธรรม',
    email: 'kanyanat.s@fake.com',
    phone: '089-012-3456',
    password: 'Customer09#',
    admin_id: 4,
    address: 'เลขที่ 33/72 ซอย 22 เฟสเลควิว หมู่บ้านสราญสิริ ท่าข้าม-พระราม 2 โครงการหรู ซอยท่าข้าม 7 แยก 4 ถนนพระราม 2 แขวงท่าข้าม เขตบางขุนเทียน กรุงเทพมหานคร 10150',
    addr_parts: { house_no: 'เลขที่ 33/72 ซอย 22 เฟสเลควิว', village: 'หมู่บ้านสราญสิริ ท่าข้าม-พระราม 2 โครงการหรู', road: 'ซอยท่าข้าม 7 แยก 4 ถนนพระราม 2', subdistrict: 'ท่าข้าม', district: 'บางขุนเทียน', province: 'กรุงเทพมหานคร', postal_code: '10150' }
  },
  {
    first_name: 'ธีรภัทร',
    last_name: 'จินดารัตน์',
    email: 'theerapat.j@fake.com',
    phone: '090-123-4567',
    password: 'Customer10#',
    admin_id: 5,
    address: 'เลขที่ 512/93 ชั้น 7 ห้อง 704 อาคาร A คอนโดกัลปพฤกษ์ พาร์ค ขอนแก่น แอร์พอร์ต หมู่ 5 ซอยมะลิวัลย์ 14 ถนนมะลิวัลย์ ตำบลในเมือง อำเภอเมืองขอนแก่น จังหวัดขอนแก่น 40000',
    addr_parts: { house_no: 'เลขที่ 512/93 ชั้น 7 ห้อง 704 อาคาร A', village: 'คอนโดกัลปพฤกษ์ พาร์ค ขอนแก่น แอร์พอร์ต หมู่ 5', road: 'ซอยมะลิวัลย์ 14 ถนนมะลิวัลย์', subdistrict: 'ในเมือง', district: 'เมืองขอนแก่น', province: 'ขอนแก่น', postal_code: '40000' }
  },
  {
    first_name: 'ปริยากร',
    last_name: 'อินทร์แก้ว',
    email: 'pariyakorn.i@fake.com',
    phone: '091-234-5678',
    password: 'Customer11#',
    admin_id: 1,
    address: 'เลขที่ 28/46 ชั้น 3 ห้องพูลวิลล่า A3 เดอะรอยัล ภูเก็ต มารีนา ลักชัวรี เรสซิเดนซ์ หมู่ 2 ซอยเกาะแก้ว 24 ถนนเทพกระษัตรี ตำบลตลาดใหญ่ อำเภอเมืองภูเก็ต จังหวัดภูเก็ต 83000',
    addr_parts: { house_no: 'เลขที่ 28/46 ชั้น 3 ห้องพูลวิลล่า A3', village: 'เดอะรอยัล ภูเก็ต มารีนา ลักชัวรี เรสซิเดนซ์ หมู่ 2', road: 'ซอยเกาะแก้ว 24 ถนนเทพกระษัตรี', subdistrict: 'ตลาดใหญ่', district: 'เมืองภูเก็ต', province: 'ภูเก็ต', postal_code: '83000' }
  },
  {
    first_name: 'ภาณุพงศ์',
    last_name: 'รุ่งเรือง',
    email: 'panupong.r@fake.com',
    phone: '092-345-6789',
    password: 'Customer12#',
    admin_id: 2,
    address: 'เลขที่ 90/118 ซอยคาซ่า 5 ซอยย่อย 3 หมู่บ้านคาซ่า วิลล์ ราชพฤกษ์-พระราม 5 หมู่ 4 ซอยบางรักน้อย 18 ถนนราชพฤกษ์ ตำบลบางรักน้อย อำเภอเมืองนนทบุรี จังหวัดนนทบุรี 11000',
    addr_parts: { house_no: 'เลขที่ 90/118 ซอยคาซ่า 5 ซอยย่อย 3', village: 'หมู่บ้านคาซ่า วิลล์ ราชพฤกษ์-พระราม 5 หมู่ 4', road: 'ซอยบางรักน้อย 18 ถนนราชพฤกษ์', subdistrict: 'บางรักน้อย', district: 'เมืองนนทบุรี', province: 'นนทบุรี', postal_code: '11000' }
  },
  {
    first_name: 'อภิญญา',
    last_name: 'พงษ์พาณิชย์',
    email: 'apinya.p@fake.com',
    phone: '093-456-7890',
    password: 'Customer13#',
    admin_id: 3,
    address: 'เลขที่ 14/255 ซอยสุรนารายณ์ 11/3 หมู่บ้านเซเรเน่การ์เด้น โคราช วิลล่า หมู่ 8 ซอยบ้านเกาะร่วมพัฒนา ถนนสุรนารายณ์ ตำบลบ้านเกาะ อำเภอเมืองนครราชสีมา จังหวัดนครราชสีมา 30000',
    addr_parts: { house_no: 'เลขที่ 14/255 ซอยสุรนารายณ์ 11/3', village: 'หมู่บ้านเซเรเน่การ์เด้น โคราช วิลล่า หมู่ 8', road: 'ซอยบ้านเกาะร่วมพัฒนา ถนนสุรนารายณ์', subdistrict: 'บ้านเกาะ', district: 'เมืองนครราชสีมา', province: 'นครราชสีมา', postal_code: '30000' }
  },
  {
    first_name: 'กรกช',
    last_name: 'ตันติวิวัฒน์',
    email: 'korakot.t@fake.com',
    phone: '094-567-8901',
    password: 'Customer14#',
    admin_id: 4,
    address: 'เลขที่ 119/53 ซอยรามอินทรา 65 แยก 2-4 หมู่บ้านชัยพฤกษ์ รามอินทรา-วงแหวน ซอย 12 ซอยคู้บอน 27 แยก 10 ถนนรามอินทรา แขวงคันนายาว เขตคันนายาว กรุงเทพมหานคร 10230',
    addr_parts: { house_no: 'เลขที่ 119/53 ซอยรามอินทรา 65 แยก 2-4', village: 'หมู่บ้านชัยพฤกษ์ รามอินทรา-วงแหวน ซอย 12', road: 'ซอยคู้บอน 27 แยก 10 ถนนรามอินทรา', subdistrict: 'คันนายาว', district: 'คันนายาว', province: 'กรุงเทพมหานคร', postal_code: '10230' }
  },
  {
    first_name: 'มนัสวี',
    last_name: 'ศรีสุวรรณ',
    email: 'manatsawee.s@fake.com',
    phone: '095-678-9012',
    password: 'Customer15#',
    admin_id: 5,
    address: 'เลขที่ 67/124 ชั้น 10 อาคารแกรนด์ C เดอะไฮทส์ คอนโดมิเนียม แอท ช้างเผือก หมู่ 7 ซอยสุขเกษม 4 ถนนซุปเปอร์ไฮเวย์ เชียงใหม่-ลำปาง ตำบลช้างเผือก อำเภอเมืองเชียงใหม่ จังหวัดเชียงใหม่ 50300',
    addr_parts: { house_no: 'เลขที่ 67/124 ชั้น 10 อาคารแกรนด์ C', village: 'เดอะไฮทส์ คอนโดมิเนียม แอท ช้างเผือก หมู่ 7', road: 'ซอยสุขเกษม 4 ถนนซุปเปอร์ไฮเวย์ เชียงใหม่-ลำปาง', subdistrict: 'ช้างเผือก', district: 'เมืองเชียงใหม่', province: 'เชียงใหม่', postal_code: '50300' }
  },
  {
    first_name: 'พงศธร',
    last_name: 'ศักดิ์เจริญ',
    email: 'pongsatorn.s@fake.com',
    phone: '096-789-0123',
    password: 'Customer16#',
    admin_id: 1,
    address: 'เลขที่ 203/67 ชั้น 18 ห้องวิวทะเล 1802 ลุมพินี วิลล์ นาเกลือ-วงศ์อมาตย์ เฟสบี หมู่ 1 ซอยนาเกลือ 16/1 ถนนสุขุมวิท-พัทยา ตำบลนาเกลือ อำเภอบางละมุง จังหวัดชลบุรี 20150',
    addr_parts: { house_no: 'เลขที่ 203/67 ชั้น 18 ห้องวิวทะเล 1802', village: 'ลุมพินี วิลล์ นาเกลือ-วงศ์อมาตย์ เฟสบี หมู่ 1', road: 'ซอยนาเกลือ 16/1 ถนนสุขุมวิท-พัทยา', subdistrict: 'นาเกลือ', district: 'บางละมุง', province: 'ชลบุรี', postal_code: '20150' }
  },
  {
    first_name: 'ลลิตา',
    last_name: 'วรเวช',
    email: 'lalita.w@fake.com',
    phone: '097-890-1234',
    password: 'Customer17#',
    admin_id: 2,
    address: 'เลขที่ 55/182 ซอยแจ้งวัฒนะ-ปากเกร็ด 43 แยก 6 หมู่บ้านเพอร์เฟค เพลส แจ้งวัฒนะ โครงการพรีเมียม ซอยคลองเกลือ 12 ถนนแจ้งวัฒนะ ตำบลบางพูด อำเภอปากเกร็ด จังหวัดนนทบุรี 11120',
    addr_parts: { house_no: 'เลขที่ 55/182 ซอยแจ้งวัฒนะ-ปากเกร็ด 43 แยก 6', village: 'หมู่บ้านเพอร์เฟค เพลส แจ้งวัฒนะ โครงการพรีเมียม', road: 'ซอยคลองเกลือ 12 ถนนแจ้งวัฒนะ', subdistrict: 'บางพูด', district: 'ปากเกร็ด', province: 'นนทบุรี', postal_code: '11120' }
  },
  {
    first_name: 'ศรัณย์',
    last_name: 'ธรรมทัศน์',
    email: 'saran.t@fake.com',
    phone: '098-901-2345',
    password: 'Customer18#',
    admin_id: 3,
    address: 'เลขที่ 84/39 ซอยชะอำใต้ 7 แปลงริมสระว่ายน้ำ วิลล่า มาลี บีชไซด์ รีสอร์ทแอนด์เรสซิเดนซ์ หมู่ 3 ซอยร่วมจิตรพัฒนา ถนนเพชรเกษมสายใต้ ตำบลชะอำ อำเภอชะอำ จังหวัดเพชรบุรี 76120',
    addr_parts: { house_no: 'เลขที่ 84/39 ซอยชะอำใต้ 7 แปลงริมสระว่ายน้ำ', village: 'วิลล่า มาลี บีชไซด์ รีสอร์ทแอนด์เรสซิเดนซ์ หมู่ 3', road: 'ซอยร่วมจิตรพัฒนา ถนนเพชรเกษมสายใต้', subdistrict: 'ชะอำ', district: 'ชะอำ', province: 'เพชรบุรี', postal_code: '76120' }
  },
  {
    first_name: 'นภัสสร',
    last_name: 'กิตติคุณ',
    email: 'napatsorn.k@fake.com',
    phone: '099-012-3456',
    password: 'Customer19#',
    admin_id: 4,
    address: 'เลขที่ 310/25 ซอย 18 ซอยย่อยมัณฑนา 4 หมู่บ้านมัณฑนา วงแหวน-บางแค โครงการ 1 ซอยเพชรเกษม 63 แยก 8 ถนนกาญจนาภิเษก แขวงบางแค เขตบางแค กรุงเทพมหานคร 10160',
    addr_parts: { house_no: 'เลขที่ 310/25 ซอย 18 ซอยย่อยมัณฑนา 4', village: 'หมู่บ้านมัณฑนา วงแหวน-บางแค โครงการ 1', road: 'ซอยเพชรเกษม 63 แยก 8 ถนนกาญจนาภิเษก', subdistrict: 'บางแค', district: 'บางแค', province: 'กรุงเทพมหานคร', postal_code: '10160' }
  },
  {
    first_name: 'ชานนท์',
    last_name: 'วิมลศิลป์',
    email: 'chanon.w@fake.com',
    phone: '080-123-4567',
    password: 'Customer20#',
    admin_id: 5,
    address: 'เลขที่ 42/158 ซอยพัฒนาอุดร 6 เฟสการ์เดน 2 หมู่บ้านสิทธาการ์เด้นท์ โฮม อุดรธานีการ์เดน หมู่ 5 ซอยบ้านหนองขาม 12 ถนนรอบเมืองสายเหนือ ตำบลหมากแข้ง อำเภอเมืองอุดรธานี จังหวัดอุดรธานี 41000',
    addr_parts: { house_no: 'เลขที่ 42/158 ซอยพัฒนาอุดร 6 เฟสการ์เดน 2', village: 'หมู่บ้านสิทธาการ์เด้นท์ โฮม อุดรธานีการ์เดน หมู่ 5', road: 'ซอยบ้านหนองขาม 12 ถนนรอบเมืองสายเหนือ', subdistrict: 'หมากแข้ง', district: 'เมืองอุดรธานี', province: 'อุดรธานี', postal_code: '41000' }
  }
];

const demoAddrText = 'เลขที่ 99/148 อาคารพาโนรามา ทาวเวอร์ ชั้น 19 ห้อง 1908 หมู่บ้านสุขใจแลนด์ หมู่ 7 ซอยกิ่งแก้ว 25/1 ถนนบางนา-ตราด กม.12 ตำบลบางพลีใหญ่ อำเภอบางพลี จังหวัดสมุทรปราการ 10540';
const demoCust = db.prepare('SELECT customer_id FROM customer WHERE email=?').get('demo@shop.com');
if (demoCust) {
  db.prepare('UPDATE customer SET address=? WHERE customer_id=?').run(demoAddrText, demoCust.customer_id);
  db.prepare('DELETE FROM address WHERE customer_id=?').run(demoCust.customer_id);
  db.prepare(`INSERT INTO address (customer_id,recipient,phone,house_no,village,road,subdistrict,district,province,postal_code,is_default)
    VALUES (?,?,?,?,?,?,?,?,?,?,1)`)
    .run(demoCust.customer_id, 'สมชาย ทดสอบ', '089-999-9999', 'เลขที่ 99/148 ชั้น 19 ห้อง 1908', 'อาคารพาโนรามา ทาวเวอร์ สุขใจแลนด์ หมู่ 7', 'ซอยกิ่งแก้ว 25/1 ถนนบางนา-ตราด กม.12', 'บางพลีใหญ่', 'บางพลี', 'สมุทรปราการ', '10540');
} else {
  const c = db.prepare('INSERT INTO customer (first_name,last_name,phone,email,address,admin_id,password_hash) VALUES (?,?,?,?,?,?,?)')
    .run('สมชาย', 'ทดสอบ', '089-999-9999', 'demo@shop.com', demoAddrText, defaultAdminId, hash('demo1234'));
  db.prepare(`INSERT INTO address (customer_id,recipient,phone,house_no,village,road,subdistrict,district,province,postal_code,is_default)
    VALUES (?,?,?,?,?,?,?,?,?,?,1)`)
    .run(c.lastInsertRowid, 'สมชาย ทดสอบ', '089-999-9999', 'เลขที่ 99/148 ชั้น 19 ห้อง 1908', 'อาคารพาโนรามา ทาวเวอร์ สุขใจแลนด์ หมู่ 7', 'ซอยกิ่งแก้ว 25/1 ถนนบางนา-ตราด กม.12', 'บางพลีใหญ่', 'บางพลี', 'สมุทรปราการ', '10540');
}

for (const fc of FAKE_CUSTOMERS) {
  const existing = db.prepare('SELECT customer_id FROM customer WHERE email=?').get(fc.email);
  if (existing) {
    db.prepare('UPDATE customer SET first_name=?,last_name=?,phone=?,address=?,admin_id=?,password_hash=? WHERE customer_id=?')
      .run(fc.first_name, fc.last_name, fc.phone, fc.address, fc.admin_id || defaultAdminId, hash(fc.password), existing.customer_id);
    const ap = fc.addr_parts;
    db.prepare('DELETE FROM address WHERE customer_id=?').run(existing.customer_id);
    db.prepare(`INSERT INTO address (customer_id,recipient,phone,house_no,village,road,subdistrict,district,province,postal_code,is_default)
      VALUES (?,?,?,?,?,?,?,?,?,?,1)`)
      .run(existing.customer_id, `${fc.first_name} ${fc.last_name}`, fc.phone, ap.house_no, ap.village, ap.road, ap.subdistrict, ap.district, ap.province, ap.postal_code);
  } else {
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
