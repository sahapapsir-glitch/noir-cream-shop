const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'shop.db'));
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');

/*
  โครงสร้างตารางอ้างอิงตรงตาม ER Diagram (Chen ER หน้า 1–8 และ Crow's Foot ER หน้า 13–16)
  พร้อมรองรับ Data Dictionary และฟีเจอร์เว็บร้านเสื้อผ้าครบวงจร
*/
db.exec(`
CREATE TABLE IF NOT EXISTS employee (          -- Employee (หน้า 1, 13)
  employee_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name    TEXT NOT NULL,                 -- ชื่อ / First_Name
  last_name     TEXT NOT NULL,                 -- นามสกุล / Last_Name
  email         TEXT,                          -- อีเมล / email
  phone         TEXT,                          -- เบอร์โทรศัพท์ / phone
  position      TEXT,                          -- ตำแหน่ง (Chen ER หน้า 1)
  address       TEXT                           -- ที่อยู่ / address (Crow's Foot หน้า 13)
);

CREATE TABLE IF NOT EXISTS admin (             -- Admin (หน้า 1, 16)
  admin_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,                 -- ชื่อแอดมิน / name
  email         TEXT NOT NULL UNIQUE,          -- อีเมล / email
  phone         TEXT,                          -- เบอร์โทรศัพท์ / phone
  password_hash TEXT NOT NULL                  -- [+] ใช้ล็อกอิน
);

CREATE TABLE IF NOT EXISTS supplier (          -- SUPPLIER (หน้า 1, 13)
  supplier_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,                 -- ชื่อซัพพลายเออร์ / name
  contact_name  TEXT,                          -- ชื่อผู้ติดต่อ / contact_name
  phone         TEXT,                          -- เบอร์โทรศัพท์ / phone
  email         TEXT,                          -- อีเมล / email
  address       TEXT,                          -- ที่อยู่ / address
  employee_id   INTEGER REFERENCES employee(employee_id),  -- รหัสผู้ดูแล (ดูแล/ติดต่อ 1:N)
  admin_id      INTEGER REFERENCES admin(admin_id)         -- Admin_id FK (หน้า 13)
);

CREATE TABLE IF NOT EXISTS product (           -- Product (หน้า 2, 13)
  product_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,                 -- ชื่อสินค้า / Product_Name
  category      TEXT NOT NULL,                 -- หมวดหมู่ (เสื้อยืด, เสื้อโปโล, เสื้อแขนยาว, กางเกง)
  description   TEXT,                          -- คำอธิบาย / description
  status        TEXT NOT NULL DEFAULT 'active',-- สถานะสินค้า / status (active / inactive)
  stock         INTEGER NOT NULL DEFAULT 0,    -- จำนวนสินค้าคงเหลือรวม
  quantity      INTEGER NOT NULL DEFAULT 0,    -- จำนวนสินค้า / quantity (หน้า 13)
  price         REAL NOT NULL DEFAULT 0,       -- ราคาเริ่มต้น (รองรับ Data Dictionary)
  supplier_id   INTEGER REFERENCES supplier(supplier_id),  -- จัดหาสินค้า (Supplier 1:N Product)
  employee_id   INTEGER REFERENCES employee(employee_id),  -- เพิ่ม/จัดการสินค้า (Employee 1:N Product)
  image_url     TEXT,                          -- [+]
  is_featured   INTEGER NOT NULL DEFAULT 0,    -- [+]
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS product_variant (   -- Product variant (หน้า 2, 14)
  variant_id     INTEGER PRIMARY KEY AUTOINCREMENT,        -- รหัสรูปแบบสินค้า / Variant_ID
  product_id     INTEGER NOT NULL REFERENCES product(product_id) ON DELETE CASCADE, -- ประกอบด้วย (1:N)
  size           TEXT NOT NULL,                            -- ขนาด / Size
  color          TEXT NOT NULL,                            -- สี / Color
  color_hex      TEXT,                                     -- [+]
  image_url      TEXT,                                     -- [+] รูปภาพเฉพาะสี/รูปแบบนี้ (ถ้าว่างใช้ product.image_url)
  price          REAL NOT NULL,                            -- ราคา / Price
  stock          INTEGER NOT NULL DEFAULT 0,               -- จำนวนสินค้าคงเหลือ
  stock_quantity INTEGER NOT NULL DEFAULT 0,               -- stock_quantity (หน้า 14)
  sku            TEXT UNIQUE                               -- [+]
);

CREATE TABLE IF NOT EXISTS customer (          -- Customer (หน้า 1, 4, 5, 14)
  customer_id   INTEGER PRIMARY KEY AUTOINCREMENT,         -- รหัสลูกค้า / Customer_ID
  first_name    TEXT NOT NULL,                             -- ชื่อ / name
  last_name     TEXT NOT NULL,                             -- นามสกุล / surname
  phone         TEXT,                                      -- เบอร์โทรศัพท์ / phone
  email         TEXT NOT NULL UNIQUE,                      -- อีเมล / email
  address       TEXT,                                      -- ที่อยู่หลัก / address (หน้า 14 & Data Dictionary)
  admin_id      INTEGER REFERENCES admin(admin_id),        -- จัดการข้อมูล (Admin 1:N Customer หน้า 1, 16)
  password_hash TEXT NOT NULL,                             -- [+] ใช้ล็อกอิน
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS address (           -- ที่อยู่ (Composite Attribute ของ Customer หน้า 2)
  address_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id   INTEGER NOT NULL REFERENCES customer(customer_id) ON DELETE CASCADE,
  recipient     TEXT,                          -- [+] ชื่อผู้รับ
  phone         TEXT,                          -- [+] เบอร์โทรผู้รับ
  house_no      TEXT,                          -- บ้านเลขที่
  village       TEXT,                          -- หมู่บ้านเลขที่
  road          TEXT,                          -- ถนน
  subdistrict   TEXT,                          -- ตำบล/แขวง
  district      TEXT,                          -- อำเภอ/เขต
  province      TEXT,                          -- จังหวัด
  postal_code   TEXT,                          -- รหัสไปรษณีย์
  is_default    INTEGER NOT NULL DEFAULT 0     -- [+]
);

CREATE TABLE IF NOT EXISTS cart_item (         -- Cart item (หน้า 5, 14)
  cart_id       INTEGER PRIMARY KEY AUTOINCREMENT,         -- cart_id / card_id
  customer_id   INTEGER NOT NULL REFERENCES customer(customer_id) ON DELETE CASCADE, -- เพิ่มลงตะกร้า
  variant_id    INTEGER NOT NULL REFERENCES product_variant(variant_id) ON DELETE CASCADE, -- รหัสรูปแบบสินค้า / Variant_ID
  product_id    INTEGER REFERENCES product(product_id) ON DELETE CASCADE, -- Product_id (หน้า 5, 14)
  quantity      INTEGER NOT NULL DEFAULT 1,                -- จำนวนสินค้า / Stock Keeping
  total_price   REAL NOT NULL DEFAULT 0,                   -- คำนวณราคาสินค้าทั้งหมด / total_price
  UNIQUE(customer_id, variant_id)
);

CREATE TABLE IF NOT EXISTS coupon (            -- [+] คูปองส่วนลด
  code          TEXT PRIMARY KEY,
  type          TEXT NOT NULL,                 -- percent / fixed
  value         REAL NOT NULL,
  min_total     REAL NOT NULL DEFAULT 0,
  active        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS "order" (           -- Order (หน้า 5, 8, 14)
  order_id      INTEGER PRIMARY KEY AUTOINCREMENT,         -- รหัสคำสั่งซื้อ / Order_ID
  customer_id   INTEGER NOT NULL REFERENCES customer(customer_id), -- รหัสลูกค้า / Customer_ID
  product_id    INTEGER REFERENCES product(product_id),    -- Product_id (หน้า 5, 8, 14)
  order_date    TEXT NOT NULL DEFAULT (datetime('now','localtime')), -- วันที่ทำการสั่งซื้อ / Order_Date
  status        TEXT NOT NULL DEFAULT 'pending',           -- สถานะคำสั่งซื้อ / Order_Status
  subtotal      REAL NOT NULL DEFAULT 0,                   -- [+]
  discount      REAL NOT NULL DEFAULT 0,                   -- [+]
  shipping_fee  REAL NOT NULL DEFAULT 0,                   -- [+]
  total_price   REAL NOT NULL DEFAULT 0,                   -- คำนวณราคาสินค้าทั้งหมด / Total_Price
  coupon_code   TEXT,                                      -- [+]
  ship_name     TEXT, ship_phone TEXT, ship_address TEXT   -- [+] snapshot ที่อยู่จัดส่ง
);

CREATE TABLE IF NOT EXISTS order_item (        -- Order item (หน้า 5, 8, 14 & Order_Detail)
  order_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id      INTEGER NOT NULL REFERENCES "order"(order_id) ON DELETE CASCADE, -- รหัสคำสั่งซื้อ / Order_ID
  variant_id    INTEGER NOT NULL REFERENCES product_variant(variant_id),         -- ถูกสั่งซื้อ (Variant)
  product_id    INTEGER REFERENCES product(product_id),    -- Product_id (หน้า 8, 14)
  quantity      INTEGER NOT NULL,                          -- จำนวน / Quantity
  unit_price    REAL NOT NULL,                             -- ราคาต่อหน่วย ณ วันที่สั่ง
  total_price   REAL NOT NULL DEFAULT 0                    -- คำนวณราคาสินค้าทั้งหมด (หน้า 8)
);

CREATE TABLE IF NOT EXISTS payment (           -- Payment (หน้า 4, 7, 8, 14)
  payment_id    INTEGER PRIMARY KEY AUTOINCREMENT,         -- รหัสการชำระเงิน / Payment_ID
  order_id      INTEGER NOT NULL REFERENCES "order"(order_id) ON DELETE CASCADE, -- ชำระเงิน
  method        TEXT NOT NULL,                             -- วิธีการชำระเงิน / Payment_Method
  status        TEXT NOT NULL DEFAULT 'pending',           -- สถานะการชำระเงิน / Payment_Status
  amount        REAL NOT NULL,                             -- ยอดเงินชำระ / Amount
  paid_at       TEXT                                       -- วันเวลาที่ชำระ / Payment_Date
);

CREATE TABLE IF NOT EXISTS shipment (          -- Shipment (หน้า 4, 16)
  shipment_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  tracking_no      TEXT,                                   -- หมายเลขพัสดุ / Tracking_Number
  payment_id       INTEGER NOT NULL REFERENCES payment(payment_id) ON DELETE CASCADE, -- รหัสการชำระเงิน / Payment_ID
  order_id         INTEGER NOT NULL REFERENCES "order"(order_id) ON DELETE CASCADE,
  product_id       INTEGER REFERENCES product(product_id), -- Product_id (หน้า 4, 16)
  carrier          TEXT,                                   -- ผู้ให้บริการขนส่ง / Carrier_Name
  status           TEXT NOT NULL DEFAULT 'preparing',      -- สถานะการจัดส่ง / Shipment_Status
  shipping_address TEXT,                                   -- ที่อยู่จัดส่ง / Shipping_Address (หน้า 4, 16)
  shipped_at       TEXT                                    -- วันที่จัดส่ง / Shipped_At
);

CREATE TABLE IF NOT EXISTS review (            -- Review (หน้า 5, 13)
  review_id     INTEGER PRIMARY KEY AUTOINCREMENT,         -- รหัสรีวิว / Review_ID
  customer_id   INTEGER NOT NULL REFERENCES customer(customer_id) ON DELETE CASCADE, -- รหัสลูกค้า / Customer_ID
  product_id    INTEGER NOT NULL REFERENCES product(product_id) ON DELETE CASCADE,   -- Product_id
  first_name    TEXT,                                      -- ชื่อ (Chen ER หน้า 5)
  last_name     TEXT,                                      -- นามสกุล (Chen ER หน้า 5)
  rating        INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), -- คะแนนรีวิว / Rating
  comment       TEXT,                                      -- ความคิดเห็น / comment
  review_date   TEXT NOT NULL DEFAULT (date('now','localtime')),     -- วันที่สร้างรีวิว / review_date (หน้า 13)
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')), -- วันเวลาที่สร้างรีวิว
  UNIQUE(customer_id, product_id)
);

CREATE TABLE IF NOT EXISTS wishlist (          -- [+] รายการโปรด
  customer_id   INTEGER NOT NULL REFERENCES customer(customer_id) ON DELETE CASCADE,
  product_id    INTEGER NOT NULL REFERENCES product(product_id) ON DELETE CASCADE,
  PRIMARY KEY (customer_id, product_id)
);

CREATE TABLE IF NOT EXISTS review_like (       -- [+] ไลค์รีวิว
  customer_id   INTEGER NOT NULL REFERENCES customer(customer_id) ON DELETE CASCADE,
  review_id     INTEGER NOT NULL REFERENCES review(review_id) ON DELETE CASCADE,
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  PRIMARY KEY (customer_id, review_id)
);

CREATE TABLE IF NOT EXISTS session (           -- [+] เก็บ session การล็อกอิน
  token         TEXT PRIMARY KEY,
  role          TEXT NOT NULL,                 -- customer / admin
  user_id       INTEGER NOT NULL,
  expires_at    INTEGER NOT NULL
);
`);

// Auto-migrate คอลัมน์ที่เพิ่มเข้ามาใหม่สำหรับฐานข้อมูลเดิม (shop.db)
const ensureCol = (table, col, def) => {
  const cols = db.prepare(`PRAGMA table_info("${table}")`).all().map((c) => c.name);
  if (!cols.includes(col)) {
    db.exec(`ALTER TABLE "${table}" ADD COLUMN ${col} ${def}`);
  }
};

ensureCol('employee', 'address', 'TEXT');
ensureCol('supplier', 'admin_id', 'INTEGER REFERENCES admin(admin_id)');
ensureCol('product', 'employee_id', 'INTEGER REFERENCES employee(employee_id)');
ensureCol('product', 'quantity', 'INTEGER NOT NULL DEFAULT 0');
ensureCol('product', 'price', 'REAL NOT NULL DEFAULT 0');
ensureCol('product_variant', 'stock_quantity', 'INTEGER NOT NULL DEFAULT 0');
ensureCol('product_variant', 'image_url', 'TEXT');
ensureCol('customer', 'address', 'TEXT');
ensureCol('customer', 'admin_id', 'INTEGER REFERENCES admin(admin_id)');
ensureCol('cart_item', 'product_id', 'INTEGER REFERENCES product(product_id) ON DELETE CASCADE');
ensureCol('cart_item', 'total_price', 'REAL NOT NULL DEFAULT 0');
ensureCol('order', 'product_id', 'INTEGER REFERENCES product(product_id)');
ensureCol('order_item', 'product_id', 'INTEGER REFERENCES product(product_id)');
ensureCol('order_item', 'total_price', 'REAL NOT NULL DEFAULT 0');
ensureCol('shipment', 'product_id', 'INTEGER REFERENCES product(product_id)');
ensureCol('shipment', 'shipping_address', 'TEXT');
ensureCol('review', 'first_name', 'TEXT');
ensureCol('review', 'last_name', 'TEXT');
ensureCol('review', 'review_date', "TEXT DEFAULT ''");

// ซิงค์ข้อมูลเดิมในฐานข้อมูลให้มีค่าครบทุกคอลัมน์ตาม ER
db.exec(`
  UPDATE product_variant SET stock_quantity = stock WHERE stock_quantity != stock;
  UPDATE product SET
    quantity = stock,
    price = COALESCE((SELECT MIN(v.price) FROM product_variant v WHERE v.product_id = product.product_id), price, 0),
    employee_id = COALESCE(employee_id, (SELECT employee_id FROM employee LIMIT 1));
  UPDATE supplier SET admin_id = COALESCE(admin_id, (SELECT admin_id FROM admin LIMIT 1));
  UPDATE customer SET
    admin_id = COALESCE(admin_id, (SELECT admin_id FROM admin LIMIT 1)),
    address = COALESCE(address, (
      SELECT TRIM(COALESCE(house_no,'') || ' ' || COALESCE(village,'') || ' ' || COALESCE(road,'') || ' ' || COALESCE(subdistrict,'') || ' ' || COALESCE(district,'') || ' ' || COALESCE(province,'') || ' ' || COALESCE(postal_code,''))
      FROM address a WHERE a.customer_id = customer.customer_id ORDER BY a.is_default DESC, a.address_id LIMIT 1
    ));
  UPDATE cart_item SET
    product_id = COALESCE(product_id, (SELECT v.product_id FROM product_variant v WHERE v.variant_id = cart_item.variant_id)),
    total_price = quantity * COALESCE((SELECT v.price FROM product_variant v WHERE v.variant_id = cart_item.variant_id), 0);
  UPDATE order_item SET
    product_id = COALESCE(product_id, (SELECT v.product_id FROM product_variant v WHERE v.variant_id = order_item.variant_id)),
    total_price = quantity * unit_price;
  UPDATE "order" SET
    product_id = COALESCE(product_id, (SELECT oi.product_id FROM order_item oi WHERE oi.order_id = "order".order_id LIMIT 1));
  UPDATE shipment SET
    product_id = COALESCE(product_id, (SELECT o.product_id FROM "order" o WHERE o.order_id = shipment.order_id)),
    shipping_address = COALESCE(shipping_address, (SELECT o.ship_address FROM "order" o WHERE o.order_id = shipment.order_id));
  UPDATE review SET
    first_name = COALESCE(first_name, (SELECT c.first_name FROM customer c WHERE c.customer_id = review.customer_id)),
    last_name = COALESCE(last_name, (SELECT c.last_name FROM customer c WHERE c.customer_id = review.customer_id)),
    review_date = CASE WHEN review_date IS NULL OR review_date = '' THEN substr(created_at, 1, 10) ELSE review_date END;
`);

// สร้าง VIEW รองรับชื่อตารางและชื่อฟิลด์ตามเอกสาร Data Dictionary (PDF ไฟล์ที่ 2: Orders, Order_Detail)
db.exec(`
  CREATE VIEW IF NOT EXISTS Orders AS
  SELECT
    order_id,
    customer_id,
    order_date,
    total_price AS total_amount,
    status AS order_status
  FROM "order";

  CREATE VIEW IF NOT EXISTS Order_Detail AS
  SELECT
    order_item_id AS order_detail_id,
    order_id,
    product_id,
    quantity,
    unit_price
  FROM order_item;
`);

module.exports = db;
