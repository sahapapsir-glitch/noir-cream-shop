const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const { createRealtimeSqlManager } = require('./mssql-sync');

const sqlSync = createRealtimeSqlManager(db);

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_DAYS = 7;
const FREE_SHIPPING_MIN = 1000;
const SHIPPING_FEE = 50;
const PAY_METHODS = ['โอนผ่านธนาคาร', 'PromptPay', 'บัตรเครดิต/เดบิต', 'เก็บเงินปลายทาง'];

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const ALLOWED_CATEGORIES = ['เสื้อยืด', 'เสื้อโปโล', 'เสื้อแขนยาว', 'กางเกง'];

/* ---------- helpers ---------- */
const tx = (fn) => {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
};
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const bad = (msg, status = 400) => { throw new HttpError(status, msg); };
const wrap = (fn) => async (req, res) => {
  try {
    const out = (await fn(req, res)) ?? { ok: true };
    if (
      ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method) &&
      !req.path.startsWith('/api/coupon/check') &&
      !req.path.startsWith('/api/login') &&
      !req.path.startsWith('/api/logout')
    ) {
      sqlSync.notifyChange(`${req.method} ${req.path}`, 'web');
      const shouldAwaitGitHub =
        req.path.startsWith('/api/admin/') ||
        req.path === '/api/register' ||
        req.path === '/api/checkout' ||
        req.path.startsWith('/api/addresses') ||
        req.path.startsWith('/api/me') ||
        req.path.startsWith('/api/orders/');
      if (shouldAwaitGitHub && sqlSync.getGitHubStatus().connected) {
        await Promise.race([
          sqlSync.syncToGitHubNow(`${req.method} ${req.path}`).catch(() => null),
          new Promise((r) => setTimeout(r, 4500))
        ]);
      }
    }
    res.json(out);
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
    console.error(e); res.status(500).json({ error: 'เกิดข้อผิดพลาดในระบบ' });
  }
};
const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const int = (v, d = 0) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };
const syncStock = (pid) => {
  db.prepare('UPDATE product_variant SET stock_quantity=stock WHERE product_id=?').run(pid);
  db.prepare(`
    UPDATE product SET
      stock = (SELECT COALESCE(SUM(stock),0) FROM product_variant WHERE product_id=?),
      quantity = (SELECT COALESCE(SUM(stock),0) FROM product_variant WHERE product_id=?),
      price = COALESCE((SELECT MIN(price) FROM product_variant WHERE product_id=?), price, 0)
    WHERE product_id=?
  `).run(pid, pid, pid, pid);
};
const syncCustomerAddress = (uid) => {
  const a = db.prepare('SELECT * FROM address WHERE customer_id=? ORDER BY is_default DESC, address_id LIMIT 1').get(uid);
  const full = a ? [a.house_no, a.village, a.road, a.subdistrict, a.district, a.province, a.postal_code].filter(Boolean).join(' ') : null;
  db.prepare('UPDATE customer SET address=? WHERE customer_id=?').run(full, uid);
};

/* ---------- session ---------- */
const parseCookies = (req) => Object.fromEntries((req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((x) => x[0]));
app.use((req, res, next) => {
  const token = parseCookies(req).sid;
  req.user = null;
  if (token) {
    const s = db.prepare('SELECT * FROM session WHERE token=? AND expires_at>?').get(token, Date.now());
    if (s) {
      req.user = { role: s.role, id: s.user_id, token };
    }
  }
  next();
});
const startSession = (res, role, id) => {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO session (token,role,user_id,expires_at) VALUES (?,?,?,?)')
    .run(token, role, id, Date.now() + SESSION_DAYS * 864e5);
  res.setHeader('Set-Cookie', `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}`);
};
const needCustomer = (req) => { if (!req.user || req.user.role !== 'customer') bad('กรุณาเข้าสู่ระบบก่อน', 401); return req.user.id; };
const needAdmin = (req) => { if (!req.user || req.user.role !== 'admin') bad('ต้องเป็นผู้ดูแลระบบ', 403); return req.user.id; };

const publicUser = (role, id) => {
  if (role === 'admin') {
    const a = db.prepare('SELECT admin_id id,name,email,phone FROM admin WHERE admin_id=?').get(id);
    return a && { role, id: a.id, name: a.name, email: a.email, phone: a.phone };
  }
  const c = db.prepare('SELECT customer_id id,first_name,last_name,email,phone,address,admin_id FROM customer WHERE customer_id=?').get(id);
  return c && { role, id: c.id, first_name: c.first_name, last_name: c.last_name, name: `${c.first_name} ${c.last_name}`, email: c.email, phone: c.phone, address: c.address };
};

// กันเดารหัสผ่าน: จำกัดความพยายามล็อกอินต่อ IP+อีเมล
const attempts = new Map();
const tooMany = (key) => { const a = attempts.get(key); return a && a.n >= 8 && Date.now() - a.t < 10 * 60 * 1000; };
const fail = (key) => { const a = attempts.get(key); attempts.set(key, { n: (a && Date.now() - a.t < 600000 ? a.n : 0) + 1, t: Date.now() }); };

/* ---------- auth ---------- */
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
app.post('/api/register', wrap((req, res) => {
  const b = req.body || {};
  const first = str(b.first_name, 60), last = str(b.last_name, 60), email = str(b.email, 120).toLowerCase(), phone = str(b.phone, 20);
  const pw = typeof b.password === 'string' ? b.password : '';
  if (!first || !last) bad('กรุณากรอกชื่อและนามสกุล');
  if (!emailRe.test(email)) bad('รูปแบบอีเมลไม่ถูกต้อง');
  if (phone && !/^[0-9+\-\s]{9,20}$/.test(phone)) bad('เบอร์โทรศัพท์ไม่ถูกต้อง');
  if (pw.length < 8) bad('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
  if (db.prepare('SELECT 1 FROM customer WHERE email=?').get(email)) bad('อีเมลนี้ถูกใช้สมัครแล้ว', 409);
  const defaultAdmin = db.prepare('SELECT admin_id FROM admin ORDER BY admin_id LIMIT 1').get()?.admin_id || null;
  const id = db.prepare('INSERT INTO customer (first_name,last_name,phone,email,admin_id,password_hash) VALUES (?,?,?,?,?,?)')
    .run(first, last, phone, email, defaultAdmin, bcrypt.hashSync(pw, 10)).lastInsertRowid;
  startSession(res, 'customer', Number(id));
  return { user: publicUser('customer', Number(id)) };
}));

app.post('/api/login', wrap((req, res) => {
  const rawInput = str(req.body?.email, 120);
  const email = rawInput.toLowerCase();
  const pw = typeof req.body?.password === 'string' ? req.body.password : '';
  const key = req.ip + '|' + email;
  if (tooMany(key)) bad('ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอ 10 นาที', 429);
  let role = 'customer', row = db.prepare('SELECT customer_id id,password_hash h FROM customer WHERE email=?').get(email);
  if (!row) { role = 'admin'; row = db.prepare("SELECT admin_id id,password_hash h FROM admin WHERE LOWER(email)=? OR name=? OR name LIKE ? || ' %'").get(email, rawInput, rawInput); }
  if (!row || !bcrypt.compareSync(pw, row.h)) { fail(key); bad('อีเมลหรือรหัสผ่านไม่ถูกต้อง', 401); }
  attempts.delete(key);
  startSession(res, role, row.id);
  return { user: publicUser(role, row.id) };
}));

app.post('/api/logout', wrap((req, res) => {
  if (req.user) db.prepare('DELETE FROM session WHERE token=?').run(req.user.token);
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
}));

app.get('/api/me', wrap((req) => ({ user: req.user ? publicUser(req.user.role, req.user.id) : null })));

app.put('/api/me', wrap((req) => {
  const id = needCustomer(req), b = req.body || {};
  const first = str(b.first_name, 60), last = str(b.last_name, 60), phone = str(b.phone, 20);
  if (!first || !last) bad('กรุณากรอกชื่อและนามสกุล');
  db.prepare('UPDATE customer SET first_name=?,last_name=?,phone=? WHERE customer_id=?').run(first, last, phone, id);
  db.prepare('UPDATE review SET first_name=?,last_name=? WHERE customer_id=?').run(first, last, id);
  return { user: publicUser('customer', id) };
}));

app.put('/api/me/password', wrap((req) => {
  const id = needCustomer(req);
  const { old_password, new_password } = req.body || {};
  const row = db.prepare('SELECT password_hash h FROM customer WHERE customer_id=?').get(id);
  if (!bcrypt.compareSync(String(old_password || ''), row.h)) bad('รหัสผ่านเดิมไม่ถูกต้อง');
  if (String(new_password || '').length < 8) bad('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร');
  db.prepare('UPDATE customer SET password_hash=? WHERE customer_id=?').run(bcrypt.hashSync(new_password, 10), id);
}));

/* ---------- products ---------- */
const productList = (where, params, order, uid) => {
  const rows = db.prepare(`
    SELECT p.*, (SELECT MIN(price) FROM product_variant v WHERE v.product_id=p.product_id) min_price,
           (SELECT MAX(price) FROM product_variant v WHERE v.product_id=p.product_id) max_price,
           (SELECT ROUND(AVG(rating),1) FROM review r WHERE r.product_id=p.product_id) rating,
           (SELECT COUNT(*) FROM review r WHERE r.product_id=p.product_id) review_count
    FROM product p WHERE ${where} ${order}`).all(...params);
  const wl = uid ? new Set(db.prepare('SELECT product_id FROM wishlist WHERE customer_id=?').all(uid).map((r) => r.product_id)) : new Set();
  return rows.map((r) => ({ ...r, wished: wl.has(r.product_id) }));
};

app.get('/api/categories', wrap(() => {
  const counts = Object.fromEntries(
    db.prepare("SELECT category, COUNT(*) n FROM product WHERE status='active' GROUP BY category").all().map((r) => [r.category, r.n])
  );
  return {
    categories: ALLOWED_CATEGORIES.map((cat) => ({
      category: cat,
      n: counts[cat] || 0
    }))
  };
}));

app.get('/api/products', wrap((req) => {
  const q = str(req.query.q, 60), cat = str(req.query.category, 60), sort = str(req.query.sort, 20);
  const where = ["p.status='active'"], params = [];
  if (q) { where.push('(p.name LIKE ? OR p.description LIKE ? OR p.category LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (cat) { where.push('p.category=?'); params.push(cat); }
  if (req.query.featured) where.push('p.is_featured=1');
  const orders = {
    new: 'ORDER BY p.created_at DESC, p.product_id DESC',
    price_asc: 'ORDER BY min_price ASC',
    price_desc: 'ORDER BY min_price DESC',
    rating: 'ORDER BY rating DESC NULLS LAST',
  };
  return { products: productList(where.join(' AND '), params, orders[sort] || 'ORDER BY p.product_id', req.user?.role === 'customer' ? req.user.id : null) };
}));

app.get('/api/products/:id', wrap((req) => {
  const uid = req.user?.role === 'customer' ? req.user.id : null;
  const [p] = productList("p.product_id=? AND p.status='active'", [int(req.params.id)], '', uid);
  if (!p) bad('ไม่พบสินค้า', 404);
  p.variants = db.prepare('SELECT variant_id,size,color,color_hex,price,stock,stock_quantity FROM product_variant WHERE product_id=? ORDER BY color,rowid').all(p.product_id);
  p.reviews = db.prepare(`
    SELECT r.review_id, r.customer_id, r.rating, r.comment, r.review_date, r.created_at,
           (COALESCE(r.first_name, c.first_name) || ' ' || COALESCE(r.last_name, c.last_name)) customer_name,
           COALESCE(r.first_name, c.first_name) first_name,
           COALESCE(r.last_name, c.last_name) last_name,
           (SELECT COUNT(*) FROM review_like rl WHERE rl.review_id = r.review_id) like_count,
           ${uid ? `(SELECT COUNT(*) FROM review_like rl WHERE rl.review_id = r.review_id AND rl.customer_id = ${uid})` : '0'} liked_by_me
    FROM review r
    JOIN customer c USING(customer_id)
    WHERE r.product_id = ?
    ORDER BY r.created_at DESC
  `).all(p.product_id);
  p.can_review = false;
  if (uid) {
    const bought = db.prepare(`SELECT 1 FROM "order" o JOIN order_item oi USING(order_id) JOIN product_variant v USING(variant_id)
      WHERE o.customer_id=? AND v.product_id=? AND o.status IN ('paid','shipped','completed') LIMIT 1`).get(uid, p.product_id);
    p.can_review = !!bought;
    p.my_review = db.prepare('SELECT review_id, rating, comment FROM review WHERE customer_id=? AND product_id=?').get(uid, p.product_id) || null;
  }
  delete p.supplier_id;
  return { product: p };
}));

app.post('/api/products/:id/reviews', wrap((req) => {
  const uid = needCustomer(req), pid = int(req.params.id);
  const rating = int(req.body?.rating), comment = str(req.body?.comment, 1000);
  if (rating < 1 || rating > 5) bad('กรุณาให้คะแนน 1-5 ดาว');
  const bought = db.prepare(`SELECT 1 FROM "order" o JOIN order_item oi USING(order_id) JOIN product_variant v USING(variant_id)
    WHERE o.customer_id=? AND v.product_id=? AND o.status IN ('paid','shipped','completed') LIMIT 1`).get(uid, pid);
  if (!bought) bad('รีวิวได้เฉพาะสินค้าที่เคยสั่งซื้อและชำระเงินแล้ว', 403);
  const cust = db.prepare('SELECT first_name, last_name FROM customer WHERE customer_id=?').get(uid);
  db.prepare(`INSERT INTO review (customer_id,product_id,first_name,last_name,rating,comment,review_date) VALUES (?,?,?,?,?,?,date('now','localtime'))
    ON CONFLICT(customer_id,product_id) DO UPDATE SET
      first_name=excluded.first_name,
      last_name=excluded.last_name,
      rating=excluded.rating,
      comment=excluded.comment,
      review_date=date('now','localtime'),
      created_at=datetime('now','localtime')`)
    .run(uid, pid, cust?.first_name || '', cust?.last_name || '', rating, comment);
  return { ok: true };
}));

app.delete('/api/reviews/:id', wrap((req) => {
  if (!req.user) bad('กรุณาเข้าสู่ระบบก่อน', 401);
  const rid = int(req.params.id);
  const r = db.prepare('SELECT * FROM review WHERE review_id=?').get(rid);
  if (!r) bad('ไม่พบรีวิวนี้', 404);
  if (req.user.role !== 'admin' && req.user.id !== r.customer_id) {
    bad('ไม่มีสิทธิ์ลบรีวิวนี้', 403);
  }
  db.prepare('DELETE FROM review WHERE review_id=?').run(rid);
  return { ok: true };
}));

app.post('/api/reviews/:id/like', wrap((req) => {
  const uid = needCustomer(req);
  const rid = int(req.params.id);
  if (!db.prepare('SELECT 1 FROM review WHERE review_id=?').get(rid)) bad('ไม่พบรีวิวนี้', 404);
  const exists = db.prepare('SELECT 1 FROM review_like WHERE customer_id=? AND review_id=?').get(uid, rid);
  if (exists) {
    db.prepare('DELETE FROM review_like WHERE customer_id=? AND review_id=?').run(uid, rid);
  } else {
    db.prepare('INSERT INTO review_like (customer_id, review_id) VALUES (?,?)').run(uid, rid);
  }
  const count = db.prepare('SELECT COUNT(*) n FROM review_like WHERE review_id=?').get(rid).n;
  return { liked: !exists, likes: count };
}));

/* ---------- wishlist ---------- */
app.get('/api/wishlist', wrap((req) => {
  const uid = needCustomer(req);
  const ids = db.prepare('SELECT product_id FROM wishlist WHERE customer_id=?').all(uid).map((r) => r.product_id);
  if (!ids.length) return { products: [] };
  return { products: productList(`p.status='active' AND p.product_id IN (${ids.map(() => '?').join(',')})`, ids, '', uid) };
}));
app.post('/api/wishlist/:id', wrap((req) => {
  const uid = needCustomer(req), pid = int(req.params.id);
  if (!db.prepare('SELECT 1 FROM product WHERE product_id=?').get(pid)) bad('ไม่พบสินค้า', 404);
  const has = db.prepare('SELECT 1 FROM wishlist WHERE customer_id=? AND product_id=?').get(uid, pid);
  if (has) db.prepare('DELETE FROM wishlist WHERE customer_id=? AND product_id=?').run(uid, pid);
  else db.prepare('INSERT INTO wishlist VALUES (?,?)').run(uid, pid);
  return { wished: !has };
}));

/* ---------- cart ---------- */
const getCart = (uid) => {
  const items = db.prepare(`
    SELECT ci.cart_id, ci.quantity, ci.total_price, v.variant_id, v.size, v.color, v.color_hex, v.price, v.stock,
           p.product_id, p.name, p.image_url
    FROM cart_item ci JOIN product_variant v USING(variant_id) JOIN product p ON p.product_id = v.product_id
    WHERE ci.customer_id=? ORDER BY ci.cart_id`).all(uid);
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  return { items, subtotal, count: items.reduce((s, i) => s + i.quantity, 0) };
};
app.get('/api/cart', wrap((req) => getCart(needCustomer(req))));
app.post('/api/cart', wrap((req) => {
  const uid = needCustomer(req), vid = int(req.body?.variant_id), qty = Math.max(1, int(req.body?.quantity, 1));
  const v = db.prepare(`SELECT v.stock, v.product_id, v.price FROM product_variant v JOIN product p USING(product_id) WHERE v.variant_id=? AND p.status='active'`).get(vid);
  if (!v) bad('ไม่พบสินค้า', 404);
  const cur = db.prepare('SELECT quantity FROM cart_item WHERE customer_id=? AND variant_id=?').get(uid, vid)?.quantity || 0;
  if (cur + qty > v.stock) bad(v.stock === 0 ? 'สินค้าหมด' : `สินค้าคงเหลือ ${v.stock} ชิ้น`);
  const newQty = cur + qty;
  db.prepare(`INSERT INTO cart_item (customer_id,variant_id,product_id,quantity,total_price) VALUES (?,?,?,?,?)
    ON CONFLICT(customer_id,variant_id) DO UPDATE SET
      product_id=excluded.product_id,
      quantity=quantity+excluded.quantity,
      total_price=(quantity+excluded.quantity)*?`).run(uid, vid, v.product_id, qty, newQty * v.price, v.price);
  return getCart(uid);
}));
app.put('/api/cart/:id', wrap((req) => {
  const uid = needCustomer(req), qty = int(req.body?.quantity);
  const row = db.prepare(`SELECT ci.cart_id, v.stock, v.price, v.product_id FROM cart_item ci JOIN product_variant v USING(variant_id)
    WHERE ci.cart_id=? AND ci.customer_id=?`).get(int(req.params.id), uid);
  if (!row) bad('ไม่พบรายการ', 404);
  if (qty < 1) bad('จำนวนต้องมากกว่า 0');
  if (qty > row.stock) bad(`สินค้าคงเหลือ ${row.stock} ชิ้น`);
  db.prepare('UPDATE cart_item SET quantity=?, product_id=?, total_price=? WHERE cart_id=?')
    .run(qty, row.product_id, qty * row.price, row.cart_id);
  return getCart(uid);
}));
app.delete('/api/cart/:id', wrap((req) => {
  const uid = needCustomer(req);
  db.prepare('DELETE FROM cart_item WHERE cart_id=? AND customer_id=?').run(int(req.params.id), uid);
  return getCart(uid);
}));

/* ---------- addresses ---------- */
const addrFields = ['recipient', 'phone', 'house_no', 'village', 'road', 'subdistrict', 'district', 'province', 'postal_code'];
const readAddr = (b) => {
  const a = Object.fromEntries(addrFields.map((f) => [f, str(b?.[f], 120)]));
  if (!a.recipient || !a.house_no || !a.subdistrict || !a.district || !a.province) bad('กรุณากรอกชื่อผู้รับ บ้านเลขที่ ตำบล อำเภอ จังหวัด');
  if (!/^\d{5}$/.test(a.postal_code)) bad('รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก');
  if (!/^[0-9+\-\s]{9,20}$/.test(a.phone)) bad('เบอร์โทรศัพท์ไม่ถูกต้อง');
  return a;
};
app.get('/api/addresses', wrap((req) => ({
  addresses: db.prepare('SELECT * FROM address WHERE customer_id=? ORDER BY is_default DESC, address_id').all(needCustomer(req)),
})));
app.post('/api/addresses', wrap((req) => {
  const uid = needCustomer(req), a = readAddr(req.body);
  const first = !db.prepare('SELECT 1 FROM address WHERE customer_id=?').get(uid);
  const makeDefault = first || !!req.body.is_default;
  tx(() => {
    if (makeDefault) db.prepare('UPDATE address SET is_default=0 WHERE customer_id=?').run(uid);
    db.prepare(`INSERT INTO address (customer_id,${addrFields.join(',')},is_default) VALUES (?,${addrFields.map(() => '?').join(',')},?)`)
      .run(uid, ...addrFields.map((f) => a[f]), makeDefault ? 1 : 0);
    syncCustomerAddress(uid);
  });
}));
app.put('/api/addresses/:id/default', wrap((req) => {
  const uid = needCustomer(req), id = int(req.params.id);
  if (!db.prepare('SELECT 1 FROM address WHERE address_id=? AND customer_id=?').get(id, uid)) bad('ไม่พบที่อยู่', 404);
  tx(() => {
    db.prepare('UPDATE address SET is_default=0 WHERE customer_id=?').run(uid);
    db.prepare('UPDATE address SET is_default=1 WHERE address_id=?').run(id);
    syncCustomerAddress(uid);
  });
}));
app.delete('/api/addresses/:id', wrap((req) => {
  const uid = needCustomer(req);
  tx(() => {
    db.prepare('DELETE FROM address WHERE address_id=? AND customer_id=?').run(int(req.params.id), uid);
    syncCustomerAddress(uid);
  });
}));

/* ---------- coupon / checkout ---------- */
const calcCoupon = (code, subtotal) => {
  if (!code) return { discount: 0 };
  const c = db.prepare('SELECT * FROM coupon WHERE code=? AND active=1').get(code.toUpperCase());
  if (!c) bad('ไม่พบโค้ดส่วนลดนี้');
  if (subtotal < c.min_total) bad(`โค้ดนี้ใช้ได้เมื่อซื้อขั้นต่ำ ${c.min_total} บาท`);
  const discount = c.type === 'percent' ? Math.round(subtotal * c.value / 100) : Math.min(c.value, subtotal);
  return { discount, code: c.code };
};
const shippingFor = (subtotal) => (subtotal >= FREE_SHIPPING_MIN || subtotal === 0 ? 0 : SHIPPING_FEE);

app.get('/api/config', wrap(() => ({
  store_name: 'NOIR & CREAM',
  categories: ALLOWED_CATEGORIES,
  free_shipping_min: FREE_SHIPPING_MIN,
  shipping_fee: SHIPPING_FEE,
  pay_methods: PAY_METHODS,
  contact: {
    line: '@noircream',
    instagram: '@noircream.official',
    facebook: 'Noir & Cream Official',
    email: 'contact@noircream.example',
    phone: '081-234-5678',
    hours: 'จันทร์ – เสาร์ 09:00 – 19:00 น.'
  }
})));

app.post('/api/coupon/check', wrap((req) => {
  const uid = needCustomer(req), cart = getCart(uid);
  const r = calcCoupon(str(req.body?.code, 30), cart.subtotal);
  return { discount: r.discount, code: r.code, shipping_fee: shippingFor(cart.subtotal), total: cart.subtotal - r.discount + shippingFor(cart.subtotal) };
}));

app.post('/api/orders', wrap((req) => {
  const uid = needCustomer(req), b = req.body || {};
  const addr = db.prepare('SELECT * FROM address WHERE address_id=? AND customer_id=?').get(int(b.address_id), uid);
  if (!addr) bad('กรุณาเลือกที่อยู่จัดส่ง');
  const method = str(b.method, 40);
  if (!PAY_METHODS.includes(method)) bad('กรุณาเลือกวิธีชำระเงิน');
  return tx(() => {
    const cart = getCart(uid);
    if (!cart.items.length) bad('ตะกร้าสินค้าว่างเปล่า');
    for (const i of cart.items) if (i.quantity > i.stock) bad(`"${i.name} (${i.color}/${i.size})" คงเหลือ ${i.stock} ชิ้น กรุณาปรับจำนวน`);
    const { discount, code } = calcCoupon(str(b.coupon_code, 30), cart.subtotal);
    const ship = shippingFor(cart.subtotal), total = cart.subtotal - discount + ship;
    const full = [addr.house_no, addr.village, addr.road, addr.subdistrict, addr.district, addr.province, addr.postal_code].filter(Boolean).join(' ');
    const primaryProductId = cart.items[0]?.product_id || null;
    const oid = Number(db.prepare(`INSERT INTO "order" (customer_id,product_id,subtotal,discount,shipping_fee,total_price,coupon_code,ship_name,ship_phone,ship_address)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(uid, primaryProductId, cart.subtotal, discount, ship, total, code || null, addr.recipient, addr.phone, full).lastInsertRowid);
    const insI = db.prepare('INSERT INTO order_item (order_id,variant_id,product_id,quantity,unit_price,total_price) VALUES (?,?,?,?,?,?)');
    const dec = db.prepare('UPDATE product_variant SET stock=stock-?, stock_quantity=stock-? WHERE variant_id=?');
    const pids = new Set();
    for (const i of cart.items) {
      insI.run(oid, i.variant_id, i.product_id, i.quantity, i.price, i.quantity * i.price);
      dec.run(i.quantity, i.quantity, i.variant_id);
      pids.add(i.product_id);
    }
    pids.forEach(syncStock);
    db.prepare('INSERT INTO payment (order_id,method,status,amount) VALUES (?,?,?,?)').run(oid, method, 'pending', total);
    db.prepare('DELETE FROM cart_item WHERE customer_id=?').run(uid);
    return { order_id: oid };
  });
}));

/* ---------- orders (customer) ---------- */
const orderDetail = (oid) => {
  const o = db.prepare('SELECT * FROM "order" WHERE order_id=?').get(oid);
  if (!o) return null;
  o.items = db.prepare(`SELECT oi.order_item_id, oi.variant_id, oi.quantity, oi.unit_price, oi.total_price, v.size, v.color, p.product_id, p.name, p.image_url, v.color_hex
    FROM order_item oi JOIN product_variant v USING(variant_id) JOIN product p ON p.product_id = v.product_id WHERE oi.order_id=?`).all(oid);
  o.payment = db.prepare('SELECT * FROM payment WHERE order_id=?').get(oid);
  o.shipment = db.prepare('SELECT * FROM shipment WHERE order_id=?').get(oid) || null;
  return o;
};
app.get('/api/orders', wrap((req) => {
  const uid = needCustomer(req);
  const ids = db.prepare('SELECT order_id FROM "order" WHERE customer_id=? ORDER BY order_id DESC').all(uid);
  return { orders: ids.map((r) => orderDetail(r.order_id)) };
}));
const ownOrder = (req) => {
  const uid = needCustomer(req), o = orderDetail(int(req.params.id));
  if (!o || o.customer_id !== uid) bad('ไม่พบคำสั่งซื้อ', 404);
  return o;
};
app.get('/api/orders/:id', wrap((req) => ({ order: ownOrder(req) })));

// จำลองการชำระเงิน (ยังไม่เชื่อมระบบ payment gateway จริง)
app.post('/api/orders/:id/pay', wrap((req) => {
  const o = ownOrder(req);
  if (o.status !== 'pending') bad('คำสั่งซื้อนี้ไม่อยู่ในสถานะรอชำระเงิน');
  if (o.payment.method === 'เก็บเงินปลายทาง') bad('คำสั่งซื้อแบบเก็บเงินปลายทางไม่ต้องชำระล่วงหน้า');
  tx(() => {
    db.prepare("UPDATE payment SET status='paid', paid_at=datetime('now','localtime') WHERE order_id=?").run(o.order_id);
    db.prepare("UPDATE \"order\" SET status='paid' WHERE order_id=?").run(o.order_id);
  });
}));

const cancelOrder = (o) => tx(() => {
  const pids = new Set();
  for (const i of db.prepare('SELECT variant_id,quantity FROM order_item WHERE order_id=?').all(o.order_id)) {
    db.prepare('UPDATE product_variant SET stock=stock+?, stock_quantity=stock+? WHERE variant_id=?').run(i.quantity, i.quantity, i.variant_id);
    pids.add(db.prepare('SELECT product_id FROM product_variant WHERE variant_id=?').get(i.variant_id).product_id);
  }
  pids.forEach(syncStock);
  db.prepare("UPDATE \"order\" SET status='cancelled' WHERE order_id=?").run(o.order_id);
  db.prepare("UPDATE payment SET status='cancelled' WHERE order_id=?").run(o.order_id);
});
app.post('/api/orders/:id/cancel', wrap((req) => {
  const o = ownOrder(req);
  if (o.status !== 'pending') bad('ยกเลิกได้เฉพาะคำสั่งซื้อที่ยังไม่ชำระเงิน');
  cancelOrder(o);
}));

const completeOrder = (o) => tx(() => {
  db.prepare("UPDATE \"order\" SET status='completed' WHERE order_id=?").run(o.order_id);
  db.prepare("UPDATE payment SET status='paid', paid_at=COALESCE(paid_at,datetime('now','localtime')) WHERE order_id=?").run(o.order_id);
  db.prepare("UPDATE shipment SET status='delivered' WHERE order_id=?").run(o.order_id);
});
app.post('/api/orders/:id/received', wrap((req) => {
  const o = ownOrder(req);
  if (o.status !== 'shipped') bad('ยืนยันได้เมื่อสินค้าอยู่ระหว่างจัดส่ง');
  completeOrder(o);
}));

/* ---------- admin ---------- */
app.get('/api/admin/stats', wrap((req) => {
  needAdmin(req);
  const one = (sql) => db.prepare(sql).get();
  return {
    customers: one('SELECT COUNT(*) n FROM customer').n,
    products: one("SELECT COUNT(*) n FROM product WHERE status='active'").n,
    orders: one('SELECT COUNT(*) n FROM "order"').n,
    revenue: one("SELECT COALESCE(SUM(total_price),0) n FROM \"order\" WHERE status IN ('paid','shipped','completed')").n,
    pending: one("SELECT COUNT(*) n FROM \"order\" WHERE status IN ('pending','paid')").n,
    low_stock: db.prepare(`SELECT v.variant_id,p.name,v.size,v.color,v.stock FROM product_variant v JOIN product p USING(product_id)
      WHERE v.stock<=3 AND p.status='active' ORDER BY v.stock LIMIT 10`).all(),
  };
}));

app.get('/api/admin/products', wrap((req) => {
  needAdmin(req);
  const products = db.prepare(`
    SELECT p.*, s.name supplier_name, (e.first_name || ' ' || e.last_name) employee_name
    FROM product p
    LEFT JOIN supplier s USING(supplier_id)
    LEFT JOIN employee e ON e.employee_id = p.employee_id
    ORDER BY p.product_id DESC
  `).all();
  const vs = db.prepare('SELECT * FROM product_variant ORDER BY product_id,color,rowid').all();
  products.forEach((p) => { p.variants = vs.filter((v) => v.product_id === p.product_id); });
  return {
    products,
    suppliers: db.prepare('SELECT supplier_id,name FROM supplier').all(),
    employees: db.prepare('SELECT employee_id,first_name,last_name,position FROM employee').all(),
    allowed_categories: ALLOWED_CATEGORIES
  };
}));

const readProduct = (b) => {
  const name = str(b?.name, 120);
  let category = str(b?.category, 60);
  if (!ALLOWED_CATEGORIES.includes(category)) {
    category = ALLOWED_CATEGORIES[0];
  }
  if (!name) bad('กรุณากรอกชื่อสินค้า');
  const image = str(b?.image_url, 500);
  if (image && !/^(shape:[a-z]+|https?:\/\/\S+|data:image\/\S+)$/i.test(image)) bad('ลิงก์รูปภาพต้องขึ้นต้นด้วย http:// หรือ https:// หรือ shape:');
  const defaultShape = category === 'เสื้อโปโล' ? 'shape:polo' : (category === 'เสื้อแขนยาว' ? 'shape:longsleeve' : (category === 'กางเกง' ? 'shape:pants' : 'shape:tee'));
  const defaultEmp = db.prepare('SELECT employee_id FROM employee ORDER BY employee_id LIMIT 1').get()?.employee_id || null;
  return [
    name,
    category,
    str(b?.description, 2000),
    b?.status === 'inactive' ? 'inactive' : 'active',
    int(b?.supplier_id) || null,
    int(b?.employee_id) || defaultEmp,
    image || defaultShape,
    b?.is_featured ? 1 : 0
  ];
};

app.post('/api/admin/products', wrap((req) => {
  needAdmin(req);
  const b = req.body || {};
  return tx(() => {
    const pdata = readProduct(b);
    const pid = Number(db.prepare('INSERT INTO product (name,category,description,status,supplier_id,employee_id,image_url,is_featured) VALUES (?,?,?,?,?,?,?,?)').run(...pdata).lastInsertRowid);

    // Support multi-variant batch creation
    if (Array.isArray(b.variants) && b.variants.length > 0) {
      const insV = db.prepare('INSERT INTO product_variant (product_id,size,color,color_hex,price,stock,stock_quantity,sku) VALUES (?,?,?,?,?,?,?,?)');
      for (const v of b.variants) {
        const size = str(v.size, 20);
        const color = str(v.color, 30);
        const price = Number(v.price);
        const stock = Math.max(0, int(v.stock, 0));
        if (size && color && price > 0) {
          const hex = /^#[0-9a-f]{6}$/i.test(v.color_hex || '') ? v.color_hex : '#EADFC8';
          const sku = `SKU-${pid}-${size}-${color}`.replace(/\s/g, '');
          insV.run(pid, size, color, hex, price, stock, stock, sku);
        }
      }
      syncStock(pid);
    }
    return { product_id: pid };
  });
}));

app.put('/api/admin/products/:id', wrap((req) => {
  needAdmin(req);
  const pid = int(req.params.id);
  db.prepare('UPDATE product SET name=?,category=?,description=?,status=?,supplier_id=?,employee_id=?,image_url=?,is_featured=? WHERE product_id=?')
    .run(...readProduct(req.body), pid);
  syncStock(pid);
}));

app.delete('/api/admin/products/:id', wrap((req) => {
  needAdmin(req);
  const pid = int(req.params.id);
  const p = db.prepare('SELECT product_id FROM product WHERE product_id=?').get(pid);
  if (!p) bad('ไม่พบสินค้า', 404);
  const hasOrders = db.prepare('SELECT 1 FROM order_item oi JOIN product_variant pv USING(variant_id) WHERE pv.product_id=? LIMIT 1').get(pid);
  if (hasOrders) {
    db.prepare("UPDATE product SET status='inactive' WHERE product_id=?").run(pid);
    return { ok: true, message: 'เปลี่ยนสถานะเป็นซ่อนแล้วเนื่องจากมีประวัติคำสั่งซื้อ' };
  }
  tx(() => {
    db.prepare('DELETE FROM cart_item WHERE product_id=? OR variant_id IN (SELECT variant_id FROM product_variant WHERE product_id=?)').run(pid, pid);
    db.prepare('UPDATE "order" SET product_id=NULL WHERE product_id=?').run(pid);
    db.prepare('UPDATE shipment SET product_id=NULL WHERE product_id=?').run(pid);
    db.prepare('UPDATE order_item SET product_id=NULL WHERE product_id=?').run(pid);
    db.prepare('DELETE FROM product_variant WHERE product_id=?').run(pid);
    db.prepare('DELETE FROM wishlist WHERE product_id=?').run(pid);
    db.prepare('DELETE FROM review WHERE product_id=?').run(pid);
    db.prepare('DELETE FROM product WHERE product_id=?').run(pid);
  });
  return { ok: true };
}));

app.post('/api/admin/stock/clear', wrap((req) => {
  needAdmin(req);
  tx(() => {
    db.prepare('DELETE FROM cart_item').run();
    db.prepare('DELETE FROM wishlist').run();
    db.prepare('DELETE FROM review').run();
    db.prepare('DELETE FROM order_item').run();
    db.prepare('DELETE FROM shipment').run();
    db.prepare('DELETE FROM payment').run();
    db.prepare('DELETE FROM "order"').run();
    db.prepare('DELETE FROM product_variant').run();
    db.prepare('DELETE FROM product').run();
  });
  return { ok: true, message: 'ล้างสต็อกและสินค้าทั้งหมดเรียบร้อยแล้ว' };
}));
app.post('/api/admin/products/:id/variants', wrap((req) => {
  needAdmin(req);
  const pid = int(req.params.id), b = req.body || {};

  // Support batch addition of multiple variants
  if (Array.isArray(b.variants) && b.variants.length > 0) {
    return tx(() => {
      const insV = db.prepare('INSERT INTO product_variant (product_id,size,color,color_hex,price,stock,stock_quantity,sku) VALUES (?,?,?,?,?,?,?,?)');
      let added = 0;
      for (const v of b.variants) {
        const size = str(v.size, 20), color = str(v.color, 30);
        const price = Number(v.price), stock = Math.max(0, int(v.stock, 0));
        const hex = /^#[0-9a-f]{6}$/i.test(v.color_hex || '') ? v.color_hex : '#EADFC8';
        if (size && color && price > 0) {
          const sku = `SKU-${pid}-${size}-${color}`.replace(/\s/g, '');
          try {
            insV.run(pid, size, color, hex, price, stock, stock, sku);
            added++;
          } catch {
            db.prepare('UPDATE product_variant SET price=?, stock=stock+?, stock_quantity=stock+? WHERE product_id=? AND size=? AND color=?')
              .run(price, stock, stock, pid, size, color);
            added++;
          }
        }
      }
      syncStock(pid);
      return { ok: true, added };
    });
  }

  // Single variant
  const size = str(b.size, 20), color = str(b.color, 30), price = Number(b.price), stock = int(b.stock);
  if (!size || !color) bad('กรุณากรอกไซซ์และสี');
  if (!(price > 0)) bad('ราคาต้องมากกว่า 0');
  if (stock < 0) bad('จำนวนสต็อกต้องไม่ติดลบ');
  const hex = /^#[0-9a-f]{6}$/i.test(b.color_hex || '') ? b.color_hex : '#CCCCCC';
  const sku = `SKU-${pid}-${size}-${color}`.replace(/\s/g, '');
  try { db.prepare('INSERT INTO product_variant (product_id,size,color,color_hex,price,stock,stock_quantity,sku) VALUES (?,?,?,?,?,?,?,?)').run(pid, size, color, hex, price, stock, stock, sku); }
  catch { bad('มีไซซ์และสีนี้อยู่แล้ว', 409); }
  syncStock(pid);
  return { ok: true };
}));
app.put('/api/admin/variants/:id', wrap((req) => {
  needAdmin(req);
  const id = int(req.params.id), price = Number(req.body?.price), stock = int(req.body?.stock);
  if (!(price > 0) || stock < 0) bad('ราคา/สต็อกไม่ถูกต้อง');
  const v = db.prepare('SELECT product_id FROM product_variant WHERE variant_id=?').get(id);
  if (!v) bad('ไม่พบรายการ', 404);
  db.prepare('UPDATE product_variant SET price=?,stock=?,stock_quantity=? WHERE variant_id=?').run(price, stock, stock, id);
  syncStock(v.product_id);
}));
app.delete('/api/admin/variants/:id', wrap((req) => {
  needAdmin(req);
  const v = db.prepare('SELECT product_id FROM product_variant WHERE variant_id=?').get(int(req.params.id));
  if (!v) bad('ไม่พบรายการ', 404);
  if (db.prepare('SELECT 1 FROM order_item WHERE variant_id=?').get(int(req.params.id))) bad('ลบไม่ได้ เพราะเคยมีคำสั่งซื้อ (ให้ปรับสต็อกเป็น 0 แทน)');
  db.prepare('DELETE FROM product_variant WHERE variant_id=?').run(int(req.params.id));
  syncStock(v.product_id);
}));

app.get('/api/admin/orders', wrap((req) => {
  needAdmin(req);
  const rows = db.prepare(`SELECT o.order_id, c.first_name||' '||c.last_name customer FROM "order" o JOIN customer c USING(customer_id) ORDER BY o.order_id DESC`).all();
  return { orders: rows.map((r) => ({ ...orderDetail(r.order_id), customer: r.customer })) };
}));
app.post('/api/admin/orders/:id/ship', wrap((req) => {
  needAdmin(req);
  const o = orderDetail(int(req.params.id));
  if (!o) bad('ไม่พบคำสั่งซื้อ', 404);
  const cod = o.payment.method === 'เก็บเงินปลายทาง';
  if (!(o.status === 'paid' || (o.status === 'pending' && cod))) bad('คำสั่งซื้อยังไม่พร้อมจัดส่ง (ต้องชำระเงินก่อน)');
  const carrier = str(req.body?.carrier, 60), tracking = str(req.body?.tracking_no, 60);
  if (!carrier || !tracking) bad('กรุณากรอกผู้ให้บริการขนส่งและหมายเลขพัสดุ');
  const primaryPid = o.product_id || o.items?.[0]?.product_id || null;
  tx(() => {
    db.prepare(`INSERT INTO shipment (payment_id,order_id,product_id,carrier,tracking_no,status,shipping_address,shipped_at)
      VALUES (?,?,?,?,?,'shipped',?,datetime('now','localtime'))`)
      .run(o.payment.payment_id, o.order_id, primaryPid, carrier, tracking, o.ship_address || '');
    db.prepare("UPDATE \"order\" SET status='shipped' WHERE order_id=?").run(o.order_id);
  });
}));
app.post('/api/admin/orders/:id/complete', wrap((req) => {
  needAdmin(req);
  const o = orderDetail(int(req.params.id));
  if (!o || o.status !== 'shipped') bad('ทำรายการนี้ได้เฉพาะคำสั่งซื้อที่กำลังจัดส่ง');
  completeOrder(o);
}));
app.post('/api/admin/orders/:id/cancel', wrap((req) => {
  needAdmin(req);
  const o = orderDetail(int(req.params.id));
  if (!o || !['pending', 'paid'].includes(o.status)) bad('ยกเลิกได้เฉพาะคำสั่งซื้อที่ยังไม่จัดส่ง');
  cancelOrder(o);
}));

app.get('/api/admin/customers', wrap((req) => {
  needAdmin(req);
  return { customers: db.prepare(`SELECT c.customer_id,c.first_name,c.last_name,c.email,c.phone,c.address,c.admin_id,c.created_at,
    a.name admin_name,
    (SELECT COUNT(*) FROM "order" o WHERE o.customer_id=c.customer_id) orders,
    (SELECT COALESCE(SUM(total_price),0) FROM "order" o WHERE o.customer_id=c.customer_id AND o.status IN ('paid','shipped','completed')) spent
    FROM customer c
    LEFT JOIN admin a USING(admin_id)
    ORDER BY c.customer_id DESC`).all() };
}));
app.get('/api/admin/suppliers', wrap((req) => {
  needAdmin(req);
  return {
    admins: db.prepare('SELECT admin_id, name, email, phone FROM admin ORDER BY admin_id').all(),
    suppliers: db.prepare(`
      SELECT s.*, e.first_name||' '||e.last_name employee_name, a.name admin_name
      FROM supplier s
      LEFT JOIN employee e USING(employee_id)
      LEFT JOIN admin a ON a.admin_id = s.admin_id
    `).all(),
    employees: db.prepare('SELECT * FROM employee').all(),
  };
}));
app.post('/api/admin/suppliers', wrap((req) => {
  const adminId = needAdmin(req);
  const b = req.body || {}, name = str(b.name, 120);
  if (!name) bad('กรุณากรอกชื่อซัพพลายเออร์');
  db.prepare('INSERT INTO supplier (name,contact_name,phone,email,address,employee_id,admin_id) VALUES (?,?,?,?,?,?,?)')
    .run(name, str(b.contact_name, 80), str(b.phone, 20), str(b.email, 120), str(b.address, 300), int(b.employee_id) || null, adminId);
}));
app.delete('/api/admin/suppliers/:id', wrap((req) => {
  needAdmin(req);
  const sid = int(req.params.id);
  if (!db.prepare('SELECT 1 FROM supplier WHERE supplier_id=?').get(sid)) bad('ไม่พบซัพพลายเออร์นี้', 404);
  tx(() => {
    db.prepare('UPDATE product SET supplier_id=NULL WHERE supplier_id=?').run(sid);
    db.prepare('DELETE FROM supplier WHERE supplier_id=?').run(sid);
  });
  return { ok: true };
}));
app.post('/api/admin/employees', wrap((req) => {
  needAdmin(req);
  const b = req.body || {};
  if (!str(b.first_name, 60) || !str(b.last_name, 60)) bad('กรุณากรอกชื่อและนามสกุลพนักงาน');
  db.prepare('INSERT INTO employee (first_name,last_name,email,phone,position,address) VALUES (?,?,?,?,?,?)')
    .run(str(b.first_name, 60), str(b.last_name, 60), str(b.email, 120), str(b.phone, 20), str(b.position, 80), str(b.address, 300));
}));
app.delete('/api/admin/employees/:id', wrap((req) => {
  needAdmin(req);
  const eid = int(req.params.id);
  if (!db.prepare('SELECT 1 FROM employee WHERE employee_id=?').get(eid)) bad('ไม่พบพนักงานนี้', 404);
  tx(() => {
    db.prepare('UPDATE supplier SET employee_id=NULL WHERE employee_id=?').run(eid);
    db.prepare('UPDATE product SET employee_id=NULL WHERE employee_id=?').run(eid);
    db.prepare('DELETE FROM employee WHERE employee_id=?').run(eid);
  });
  return { ok: true };
}));

/* ---------- Realtime SQL Server (SSMS .\SQLEXPRESS01) Integration ---------- */
app.get('/api/sql/status', (req, res) => {
  res.json({
    status: sqlSync.getStatus(),
    snapshot: sqlSync.getSnapshot()
  });
});

app.get('/api/sql/snapshot', (req, res) => {
  if (req.query.instance) {
    sqlSync.registerBridgeHeartbeat({
      instance: str(req.query.instance, 120),
      database: str(req.query.database, 80) || 'NoirCreamShop'
    });
  }
  const snap = sqlSync.getSnapshot();
  // ถอด password_hash ออกจาก response หากไม่ได้ใช้เพื่อซิงค์ภายใน
  res.json({
    ...snap,
    status: sqlSync.getStatus()
  });
});

app.get('/api/sql/script', (req, res) => {
  const script = sqlSync.generateSqlServerScript();
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  if (req.query.download) {
    res.setHeader('Content-Disposition', 'attachment; filename="NoirCreamShop_SQLServer.sql"');
  }
  res.send(script);
});

app.get('/api/sql/bridge.ps1', (req, res) => {
  const psPath = path.join(__dirname, 'sync-ssms-realtime.ps1');
  const raw = fs.existsSync(psPath) ? fs.readFileSync(psPath, 'utf8') : '';
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(raw);
});

app.post('/api/sql/push', (req, res) => {
  try {
    const b = req.body || {};
    if (!b.tables || typeof b.tables !== 'object') {
      return res.status(400).json({ error: 'ไม่พบข้อมูลตารางสำหรับซิงค์' });
    }
    sqlSync.registerBridgeHeartbeat({
      instance: str(b.instance, 120) || '.\\SQLEXPRESS01',
      database: str(b.database, 80) || 'NoirCreamShop'
    });
    sqlSync.applySnapshotToSqlite(b.tables);
    // ซิงค์ยอดสต็อกและที่อยู่ลูกค้าให้ตรงกันเสมอ
    for (const p of db.prepare('SELECT product_id FROM product').all()) {
      syncStock(p.product_id);
    }
    for (const c of db.prepare('SELECT customer_id FROM customer').all()) {
      syncCustomerAddress(c.customer_id);
    }
    const snap = sqlSync.notifyChange('SSMS Push (2-Way Sync)', 'ssms');
    res.json({
      ok: true,
      checksum: snap?.checksum,
      counts: snap?.counts,
      status: sqlSync.getStatus()
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'ซิงค์ข้อมูลจาก SSMS ไม่สำเร็จ' });
  }
});

app.post('/api/sql/query', (req, res) => {
  try {
    needAdmin(req);
    const rawSql = String(req.body?.sql || '').trim();
    if (!rawSql) bad('กรุณากรอกคำสั่ง SQL');
    const translated = sqlSync.translateTSqlToSqlite(rawSql);
    if (!translated) bad('คำสั่ง SQL ไม่ถูกต้อง');

    const t0 = performance.now();
    const isSelect = /^\s*(SELECT|PRAGMA|WITH|EXPLAIN)\b/i.test(translated);
    let rows = [], columns = [], changes = 0;

    if (isSelect) {
      const stmt = db.prepare(translated);
      rows = stmt.all();
      columns = rows.length ? Object.keys(rows[0]) : [];
    } else {
      const stmt = db.prepare(translated);
      const r = stmt.run();
      changes = Number(r.changes || 0);
      for (const p of db.prepare('SELECT product_id FROM product').all()) {
        syncStock(p.product_id);
      }
      sqlSync.notifyChange(`SQL Execute: ${rawSql.slice(0, 60)}`, 'sql-console');
    }
    const durationMs = Number((performance.now() - t0).toFixed(2));
    res.json({
      ok: true,
      isSelect,
      rows,
      columns,
      changes,
      durationMs,
      snapshot: sqlSync.getSnapshot(),
      status: sqlSync.getStatus()
    });
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
    res.status(400).json({ error: e.message || 'รันคำสั่ง SQL ไม่สำเร็จ' });
  }
});

app.get('/api/sql/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const snap = sqlSync.getSnapshot();
  const initPayload = {
    checksum: snap.checksum,
    timestamp: snap.timestamp,
    counts: snap.counts,
    ssmsStatus: sqlSync.getStatus()
  };
  res.write(`event: init\ndata: ${JSON.stringify(initPayload)}\n\n`);
  sqlSync.addSseClient(res);

  const keepAlive = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { clearInterval(keepAlive); }
  }, 20000);
  res.on('close', () => clearInterval(keepAlive));
});

app.get('/api/github/status', (req, res) => {
  res.json({ github: sqlSync.getGitHubStatus() });
});

app.post('/api/github/sync', async (req, res) => {
  try {
    needAdmin(req);
    const github = await sqlSync.syncToGitHubNow('Manual Admin Sync');
    if (github.lastError) {
      return res.status(400).json({ error: github.lastError, github });
    }
    res.json({ ok: true, github });
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
    res.status(500).json({ error: e.message || 'ซิงค์ขึ้น GitHub ไม่สำเร็จ' });
  }
});

app.post('/api/github/pull', async (req, res) => {
  try {
    needAdmin(req);
    const restored = await sqlSync.restoreFromGitHub(true);
    if (restored?.restored) {
      for (const p of db.prepare('SELECT product_id FROM product').all()) {
        syncStock(p.product_id);
      }
      for (const c of db.prepare('SELECT customer_id FROM customer').all()) {
        syncCustomerAddress(c.customer_id);
      }
      sqlSync.notifyChange('GitHub Pull Restore', 'github');
    }
    res.json({ ok: true, restored, github: sqlSync.getGitHubStatus() });
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
    res.status(500).json({ error: e.message || 'ดึงข้อมูลจาก GitHub ไม่สำเร็จ' });
  }
});

app.post('/api/github/token', async (req, res) => {
  try {
    needAdmin(req);
    const tok = String(req.body?.token || '').trim();
    sqlSync.setGitHubToken(tok);
    if (!tok) {
      return res.json({ ok: true, github: sqlSync.getGitHubStatus() });
    }
    const github = await sqlSync.syncToGitHubNow('Setup GitHub Token');
    if (github.lastError) {
      return res.status(400).json({ error: github.lastError, github });
    }
    res.json({ ok: true, github });
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ error: e.message });
    res.status(500).json({ error: e.message || 'ตั้งค่า GitHub Token ไม่สำเร็จ' });
  }
});

app.use('/api', (req, res) => res.status(404).json({ error: 'ไม่พบ API นี้' }));
app.listen(PORT, () => {
  console.log(`ร้านเปิดแล้วที่ http://localhost:${PORT} (พร้อมระบบเชื่อม SQL Server Realtime: .\\SQLEXPRESS01 และ GitHub Auto-Sync)`);
  sqlSync.restoreFromGitHub(false).then((r) => {
    if (r?.restored) {
      console.log(`☁️ กู้คืนข้อมูลล่าสุดจาก GitHub สำเร็จ (Checksum: ${r.checksum})`);
    }
  }).catch(() => {});
});
