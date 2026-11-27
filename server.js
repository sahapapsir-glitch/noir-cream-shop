const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const db = require('./db');
const { createRealtimeSqlManager } = require('./mssql-sync');

try { db.prepare('DELETE FROM session WHERE expires_at <= ?').run(Date.now()); } catch {}

const sqlSync = createRealtimeSqlManager(db);

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_DAYS = 7;
const FREE_SHIPPING_MIN = 1000;
const SHIPPING_FEE = 50;
const PAY_METHODS = ['โอนผ่านธนาคาร', 'PromptPay', 'บัตรเครดิต/เดบิต', 'เก็บเงินปลายทาง'];

app.use((req, res, next) => {
  if (req.method === 'HEAD' || req.path === '/api/sql/stream' || req.headers.range) {
    return next();
  }
  if (!/\bgzip\b/i.test(String(req.headers['accept-encoding'] || ''))) {
    return next();
  }

  const origWrite = res.write.bind(res);
  const origEnd = res.end.bind(res);
  const origWriteHead = res.writeHead.bind(res);
  let gzip = null;
  let decided = false;

  const isCompressible = () => {
    if (res.statusCode < 200 || res.statusCode === 204 || res.statusCode === 304) return false;
    if (res.getHeader('Content-Encoding')) return false;
    const ct = String(res.getHeader('Content-Type') || '');
    return /^(text\/|application\/(json|javascript|xml)|image\/svg\+xml)/i.test(ct) || /\+(json|xml)\b/i.test(ct);
  };

  const startGzip = () => {
    if (decided) return;
    decided = true;
    const cl = Number(res.getHeader('Content-Length'));
    if (!isCompressible() || (Number.isFinite(cl) && cl < 512)) return;
    res.removeHeader('Content-Length');
    res.setHeader('Content-Encoding', 'gzip');
    res.vary('Accept-Encoding');
    gzip = zlib.createGzip({ level: 6 });
    let waitSocket = false;
    gzip.on('data', (chunk) => {
      if (!origWrite(chunk)) {
        waitSocket = true;
        gzip.pause();
      }
    });
    res.on('drain', () => {
      if (waitSocket && gzip) {
        waitSocket = false;
        gzip.resume();
      }
    });
    gzip.on('drain', () => {
      if (!waitSocket) res.emit('drain');
    });
    gzip.on('end', () => origEnd());
    gzip.on('error', () => {
      try { origEnd(); } catch {}
    });
    res.on('close', () => {
      if (gzip && !gzip.destroyed) gzip.destroy();
    });
  };

  res.writeHead = (statusCode, statusMessage, headers) => {
    if (typeof statusMessage === 'object' && statusMessage !== null) {
      headers = statusMessage;
      statusMessage = undefined;
    }
    if (headers) {
      for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    }
    res.statusCode = statusCode;
    if (!decided) startGzip();
    return statusMessage !== undefined ? origWriteHead(res.statusCode, statusMessage) : origWriteHead(res.statusCode);
  };

  res.write = (chunk, encoding, cb) => {
    if (!decided) startGzip();
    if (gzip) return gzip.write(chunk, encoding, cb);
    return origWrite(chunk, encoding, cb);
  };

  res.end = (chunk, encoding, cb) => {
    if (typeof chunk === 'function') { cb = chunk; chunk = undefined; }
    if (typeof encoding === 'function') { cb = encoding; encoding = undefined; }
    if (!decided) {
      const cl = Number(res.getHeader('Content-Length'));
      const len = chunk !== undefined && chunk !== null
        ? (Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk), typeof encoding === 'string' ? encoding : 'utf8'))
        : 0;
      if ((Number.isFinite(cl) && cl >= 512) || len >= 512) {
        startGzip();
      } else {
        decided = true;
      }
    }
    if (gzip) {
      if (cb) res.once('finish', cb);
      if (chunk !== undefined && chunk !== null) gzip.end(chunk, encoding);
      else gzip.end();
      return res;
    }
    return origEnd(chunk, encoding, cb);
  };

  next();
});

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '10m',
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(`${path.sep}index.html`) || filePath.endsWith('/index.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

const ALLOWED_CATEGORIES = ['เสื้อยืด', 'เสื้อโปโล', 'เสื้อแขนยาว', 'กางเกง'];

/* ---------- helpers ---------- */
const tx = (fn) => {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; }
};
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const bad = (msg, status = 400) => { throw new HttpError(status, msg); };
let startupRestoreDone = false;
let resolveStartupRestoreReady = null;
const startupRestorePromise = new Promise((r) => { resolveStartupRestoreReady = r; });

app.use('/api', async (req, res, next) => {
  if (!startupRestoreDone) {
    await Promise.race([startupRestorePromise, new Promise((r) => setTimeout(r, 3500))]);
  }
  next();
});

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
      if (sqlSync.getGitHubStatus().connected) {
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
const getShopCustomerId = (user) => {
  if (!user) return null;
  if (user.role === 'customer') return user.id;
  if (user.role === 'admin') {
    const row =
      db.prepare("SELECT customer_id FROM customer WHERE LOWER(email)='demo@shop.com' ORDER BY customer_id LIMIT 1").get() ||
      db.prepare('SELECT customer_id FROM customer WHERE customer_id=1').get() ||
      db.prepare('SELECT customer_id FROM customer WHERE admin_id=? ORDER BY customer_id LIMIT 1').get(user.id) ||
      db.prepare('SELECT customer_id FROM customer ORDER BY customer_id LIMIT 1').get();
    return row ? row.customer_id : null;
  }
  return null;
};
const needCustomer = (req) => {
  if (!req.user) bad('กรุณาเข้าสู่ระบบก่อน', 401);
  if (req.user.role === 'customer') return req.user.id;
  if (req.user.role === 'admin') {
    let cid = getShopCustomerId(req.user);
    if (!cid) {
      const a = db.prepare('SELECT admin_id, phone FROM admin WHERE admin_id=?').get(req.user.id);
      cid = Number(
        db.prepare('INSERT INTO customer (first_name,last_name,phone,email,admin_id,password_hash) VALUES (?,?,?,?,?,?)')
          .run('สมชาย', 'ทดสอบ', a?.phone || '089-999-9999', 'demo@shop.com', a?.admin_id || null, bcrypt.hashSync('12345678', 10))
          .lastInsertRowid
      );
    }
    if (!db.prepare('SELECT 1 FROM address WHERE customer_id=? LIMIT 1').get(cid)) {
      const c = db.prepare('SELECT first_name, last_name, phone FROM customer WHERE customer_id=?').get(cid);
      db.prepare(`INSERT INTO address (customer_id, recipient, phone, house_no, village, road, subdistrict, district, province, postal_code, is_default)
        VALUES (?,?,?,?,?,?,?,?,?,?,1)`)
        .run(
          cid,
          `${c?.first_name || 'สมชาย'} ${c?.last_name || 'ทดสอบ'}`.trim(),
          c?.phone || '089-999-9999',
          'เลขที่ 99/148 ชั้น 19 ห้อง 1908',
          'อาคารพาโนรามา ทาวเวอร์ สุขใจแลนด์ หมู่ 7',
          'ซอยกิ่งแก้ว 25/1 ถนนบางนา-ตราด กม.12',
          'บางพลีใหญ่',
          'บางพลี',
          'สมุทรปราการ',
          '10540'
        );
      syncCustomerAddress(cid);
    }
    return cid;
  }
  bad('กรุณาเข้าสู่ระบบก่อน', 401);
};
const needAdmin = (req) => { if (!req.user || req.user.role !== 'admin') bad('ต้องเป็นผู้ดูแลระบบ', 403); return req.user.id; };

const publicUser = (role, id) => {
  if (role === 'admin') {
    const a = db.prepare('SELECT admin_id id,name,email,phone FROM admin WHERE admin_id=?').get(id);
    if (!a) return null;
    const scid = getShopCustomerId({ role: 'admin', id: a.id });
    const sc = scid ? db.prepare('SELECT customer_id,first_name,last_name FROM customer WHERE customer_id=?').get(scid) : null;
    return {
      role,
      id: a.id,
      name: a.name,
      email: a.email,
      phone: a.phone,
      shop_customer_id: sc?.customer_id || null,
      shop_customer_name: sc ? `${sc.first_name} ${sc.last_name}`.trim() : 'สมชาย ทดสอบ'
    };
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
  const colorMap = new Map();
  if (rows.length) {
    const ids = rows.map((r) => r.product_id);
    const ph = ids.map(() => '?').join(',');
    const vrows = db.prepare(`
      SELECT product_id, color, MAX(color_hex) color_hex, MAX(NULLIF(TRIM(image_url), '')) image_url
      FROM product_variant
      WHERE product_id IN (${ph})
      GROUP BY product_id, color
      ORDER BY MIN(rowid)
    `).all(...ids);
    for (const vr of vrows) {
      if (!colorMap.has(vr.product_id)) colorMap.set(vr.product_id, []);
      colorMap.get(vr.product_id).push({
        color: vr.color,
        color_hex: vr.color_hex,
        image_url: vr.image_url || null
      });
    }
  }
  return rows.map((r) => ({ ...r, wished: wl.has(r.product_id), colors: colorMap.get(r.product_id) || [] }));
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
  return { products: productList(where.join(' AND '), params, orders[sort] || 'ORDER BY p.product_id', getShopCustomerId(req.user)) };
}));

app.get('/api/products/:id', wrap((req) => {
  const uid = getShopCustomerId(req.user);
  const [p] = productList("p.product_id=? AND p.status='active'", [int(req.params.id)], '', uid);
  if (!p) bad('ไม่พบสินค้า', 404);
  p.variants = db.prepare('SELECT variant_id,size,color,color_hex,image_url,price,stock,stock_quantity FROM product_variant WHERE product_id=? ORDER BY color,rowid').all(p.product_id);
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
           p.product_id, p.name, COALESCE(NULLIF(TRIM(v.image_url), ''), p.image_url) image_url
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
app.put('/api/addresses/:id', wrap((req) => {
  const uid = needCustomer(req), id = int(req.params.id);
  const existing = db.prepare('SELECT is_default FROM address WHERE address_id=? AND customer_id=?').get(id, uid);
  if (!existing) bad('ไม่พบที่อยู่นี้', 404);
  const a = readAddr(req.body);
  const makeDefault = !!req.body?.is_default;
  tx(() => {
    if (makeDefault) db.prepare('UPDATE address SET is_default=0 WHERE customer_id=?').run(uid);
    const nextDefault = makeDefault ? 1 : existing.is_default;
    db.prepare(`UPDATE address SET ${addrFields.map((f) => `${f}=?`).join(',')}, is_default=? WHERE address_id=? AND customer_id=?`)
      .run(...addrFields.map((f) => a[f]), nextDefault, id, uid);
    syncCustomerAddress(uid);
  });
  return { ok: true };
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
  o.items = db.prepare(`SELECT oi.order_item_id, oi.variant_id, oi.quantity, oi.unit_price, oi.total_price, v.size, v.color, p.product_id, p.name, COALESCE(NULLIF(TRIM(v.image_url), ''), p.image_url) image_url, v.color_hex
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
  if (!o || (req.user?.role !== 'admin' && o.customer_id !== uid)) bad('ไม่พบคำสั่งซื้อ', 404);
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
const resolveOrderShipping = (b, customerId) => {
  if (b?.address_id) {
    const addr = db.prepare('SELECT * FROM address WHERE address_id=? AND customer_id=?').get(int(b.address_id), customerId);
    if (!addr) bad('ไม่พบที่อยู่นี้ในสมุดที่อยู่', 404);
    const full = [addr.house_no, addr.village, addr.road, addr.subdistrict, addr.district, addr.province, addr.postal_code].filter(Boolean).join(' ');
    return { ship_name: addr.recipient, ship_phone: addr.phone, ship_address: full };
  }
  const ship_name = str(b?.ship_name, 150);
  const ship_phone = str(b?.ship_phone, 40);
  if (!ship_name) bad('กรุณากรอกชื่อผู้รับ');
  if (!/^[0-9+\-\s]{9,20}$/.test(ship_phone)) bad('เบอร์โทรศัพท์ผู้รับไม่ถูกต้อง');
  if (b?.house_no !== undefined || b?.subdistrict !== undefined || b?.postal_code !== undefined) {
    const house_no = str(b?.house_no, 120);
    const village = str(b?.village, 120);
    const road = str(b?.road, 120);
    const subdistrict = str(b?.subdistrict, 120);
    const district = str(b?.district, 120);
    const province = str(b?.province, 120);
    const postal_code = str(b?.postal_code, 10);
    if (!house_no || !subdistrict || !district || !province) {
      bad('กรุณากรอกบ้านเลขที่ ตำบล/แขวง อำเภอ/เขต และจังหวัด ให้ครบถ้วน');
    }
    if (!/^\d{5}$/.test(postal_code)) bad('รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก');
    const ship_address = [house_no, village, road, subdistrict, district, province, postal_code].filter(Boolean).join(' ').slice(0, 600);
    return { ship_name, ship_phone, ship_address };
  }
  const ship_address = str(b?.ship_address, 600);
  if (!ship_address || ship_address.length < 5) bad('กรุณากรอกที่อยู่จัดส่งให้ครบถ้วน');
  return { ship_name, ship_phone, ship_address };
};

app.put('/api/orders/:id/address', wrap((req) => {
  const o = ownOrder(req);
  if (!['pending', 'paid'].includes(o.status)) {
    bad('เปลี่ยนที่อยู่ได้เฉพาะคำสั่งซื้อที่ยังไม่จัดส่ง (รอชำระเงิน หรือ ชำระเงินแล้ว)');
  }
  const { ship_name, ship_phone, ship_address } = resolveOrderShipping(req.body, o.customer_id);
  tx(() => {
    db.prepare('UPDATE "order" SET ship_name=?, ship_phone=?, ship_address=? WHERE order_id=?')
      .run(ship_name, ship_phone, ship_address, o.order_id);
    db.prepare('UPDATE shipment SET shipping_address=? WHERE order_id=?')
      .run(ship_address, o.order_id);
  });
  return { ok: true, order: orderDetail(o.order_id) };
}));

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

const readVariantImage = (val) => {
  const img = str(val, 2000);
  if (!img) return null;
  if (!/^(shape:[a-z]+|https?:\/\/\S+|data:image\/\S+)$/i.test(img)) {
    bad('ลิงก์รูปภาพของสีต้องขึ้นต้นด้วย http:// หรือ https:// หรือ shape:');
  }
  return img;
};

const readProduct = (b) => {
  const name = str(b?.name, 250);
  let category = str(b?.category, 60);
  if (!ALLOWED_CATEGORIES.includes(category)) {
    category = ALLOWED_CATEGORIES[0];
  }
  if (!name) bad('กรุณากรอกชื่อสินค้า');
  const image = str(b?.image_url, 2000);
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
      const insV = db.prepare('INSERT INTO product_variant (product_id,size,color,color_hex,image_url,price,stock,stock_quantity,sku) VALUES (?,?,?,?,?,?,?,?,?)');
      for (const v of b.variants) {
        const size = str(v.size, 20);
        const color = str(v.color, 30);
        const price = Number(v.price);
        const stock = Math.max(0, int(v.stock, 0));
        if (size && color && price > 0) {
          const hex = /^#[0-9a-f]{6}$/i.test(v.color_hex || '') ? v.color_hex : '#EADFC8';
          const vImg = readVariantImage(v.image_url);
          const sku = `SKU-${pid}-${size}-${color}`.replace(/\s/g, '');
          insV.run(pid, size, color, hex, vImg, price, stock, stock, sku);
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
      const insV = db.prepare('INSERT INTO product_variant (product_id,size,color,color_hex,image_url,price,stock,stock_quantity,sku) VALUES (?,?,?,?,?,?,?,?,?)');
      let added = 0;
      for (const v of b.variants) {
        const size = str(v.size, 20), color = str(v.color, 30);
        const price = Number(v.price), stock = Math.max(0, int(v.stock, 0));
        const hex = /^#[0-9a-f]{6}$/i.test(v.color_hex || '') ? v.color_hex : '#EADFC8';
        const vImg = readVariantImage(v.image_url);
        if (size && color && price > 0) {
          const sku = `SKU-${pid}-${size}-${color}`.replace(/\s/g, '');
          try {
            insV.run(pid, size, color, hex, vImg, price, stock, stock, sku);
            added++;
          } catch {
            db.prepare('UPDATE product_variant SET price=?, stock=stock+?, stock_quantity=stock+?, image_url=COALESCE(?, image_url) WHERE product_id=? AND size=? AND color=?')
              .run(price, stock, stock, vImg, pid, size, color);
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
  const vImg = readVariantImage(b.image_url);
  const sku = `SKU-${pid}-${size}-${color}`.replace(/\s/g, '');
  try { db.prepare('INSERT INTO product_variant (product_id,size,color,color_hex,image_url,price,stock,stock_quantity,sku) VALUES (?,?,?,?,?,?,?,?,?)').run(pid, size, color, hex, vImg, price, stock, stock, sku); }
  catch { bad('มีไซซ์และสีนี้อยู่แล้ว', 409); }
  syncStock(pid);
  return { ok: true };
}));
app.put('/api/admin/variants/:id', wrap((req) => {
  needAdmin(req);
  const id = int(req.params.id), price = Number(req.body?.price), stock = int(req.body?.stock);
  if (!(price > 0) || stock < 0) bad('ราคา/สต็อกไม่ถูกต้อง');
  const v = db.prepare('SELECT product_id, image_url FROM product_variant WHERE variant_id=?').get(id);
  if (!v) bad('ไม่พบรายการ', 404);
  const vImg = req.body?.image_url !== undefined ? readVariantImage(req.body.image_url) : v.image_url;
  db.prepare('UPDATE product_variant SET price=?,stock=?,stock_quantity=?,image_url=? WHERE variant_id=?').run(price, stock, stock, vImg, id);
  syncStock(v.product_id);
}));
app.put('/api/admin/products/:id/color-image', wrap((req) => {
  needAdmin(req);
  const pid = int(req.params.id);
  const color = str(req.body?.color, 40);
  if (!color) bad('กรุณาระบุชื่อสี');
  const vImg = readVariantImage(req.body?.image_url);
  const r = db.prepare('UPDATE product_variant SET image_url=? WHERE product_id=? AND color=?').run(vImg, pid, color);
  if (!r.changes) bad('ไม่พบสีนี้ในสินค้าดังกล่าว', 404);
  return { ok: true, updated: r.changes };
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
const generateTrackingNo = (carrier, orderId) => {
  const c = String(carrier || '').toLowerCase();
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const oid = String(orderId || 0).padStart(3, '0');
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  if (c.includes('kerry')) return `KEX${ymd}${oid}${rand.slice(0, 4)}`;
  if (c.includes('j&t') || c.includes('jt')) return `JT${ymd}${oid}${rand.slice(0, 4)}`;
  if (c.includes('ไปรษณีย์') || c.includes('ems') || c.includes('thailand post')) {
    const digits = String(Math.floor(100000000 + Math.random() * 900000000));
    return `EF${digits}TH`;
  }
  if (c.includes('flash')) return `TH${ymd}${oid}${rand}`;
  return `NC${ymd}${oid}${rand.slice(0, 4)}`;
};

app.post('/api/admin/orders/:id/ship', wrap((req) => {
  needAdmin(req);
  const o = orderDetail(int(req.params.id));
  if (!o) bad('ไม่พบคำสั่งซื้อ', 404);
  const cod = o.payment.method === 'เก็บเงินปลายทาง';
  if (!(o.status === 'paid' || (o.status === 'pending' && cod))) bad('คำสั่งซื้อยังไม่พร้อมจัดส่ง (ต้องชำระเงินก่อน)');
  const carrier = str(req.body?.carrier, 60) || 'Flash Express';
  let tracking = str(req.body?.tracking_no, 60);
  const autoGenerated = !tracking;
  if (!tracking) tracking = generateTrackingNo(carrier, o.order_id);
  const primaryPid = o.product_id || o.items?.[0]?.product_id || null;
  tx(() => {
    const existing = db.prepare('SELECT shipment_id FROM shipment WHERE order_id=?').get(o.order_id);
    if (existing) {
      db.prepare(`UPDATE shipment SET carrier=?, tracking_no=?, status='shipped', shipping_address=?, shipped_at=datetime('now','localtime') WHERE shipment_id=?`)
        .run(carrier, tracking, o.ship_address || '', existing.shipment_id);
    } else {
      db.prepare(`INSERT INTO shipment (payment_id,order_id,product_id,carrier,tracking_no,status,shipping_address,shipped_at)
        VALUES (?,?,?,?,?,'shipped',?,datetime('now','localtime'))`)
        .run(o.payment.payment_id, o.order_id, primaryPid, carrier, tracking, o.ship_address || '');
    }
    db.prepare("UPDATE \"order\" SET status='shipped' WHERE order_id=?").run(o.order_id);
  });
  return { ok: true, carrier, tracking_no: tracking, auto_generated: autoGenerated };
}));

app.put('/api/admin/orders/:id/shipment', wrap((req) => {
  needAdmin(req);
  const o = orderDetail(int(req.params.id));
  if (!o || !o.shipment) bad('ยังไม่มีข้อมูลการจัดส่งสำหรับคำสั่งซื้อนี้', 404);
  const carrier = str(req.body?.carrier, 60) || o.shipment.carrier || 'Flash Express';
  let tracking = str(req.body?.tracking_no, 60);
  const autoGenerated = !tracking;
  if (!tracking) tracking = generateTrackingNo(carrier, o.order_id);
  db.prepare('UPDATE shipment SET carrier=?, tracking_no=? WHERE shipment_id=?')
    .run(carrier, tracking, o.shipment.shipment_id);
  return { ok: true, carrier, tracking_no: tracking, auto_generated: autoGenerated };
}));
app.get('/api/admin/orders/:id/addresses', wrap((req) => {
  needAdmin(req);
  const o = db.prepare('SELECT order_id, customer_id FROM "order" WHERE order_id=?').get(int(req.params.id));
  if (!o) bad('ไม่พบคำสั่งซื้อ', 404);
  const addresses = db.prepare('SELECT * FROM address WHERE customer_id=? ORDER BY is_default DESC, address_id').all(o.customer_id);
  return { addresses };
}));
app.put('/api/admin/orders/:id/address', wrap((req) => {
  needAdmin(req);
  const o = orderDetail(int(req.params.id));
  if (!o) bad('ไม่พบคำสั่งซื้อ', 404);
  if (['completed', 'cancelled'].includes(o.status)) {
    bad('ไม่สามารถแก้ไขที่อยู่ของคำสั่งซื้อที่ปิดรายการหรือยกเลิกแล้ว');
  }
  const { ship_name, ship_phone, ship_address } = resolveOrderShipping(req.body, o.customer_id);
  tx(() => {
    db.prepare('UPDATE "order" SET ship_name=?, ship_phone=?, ship_address=? WHERE order_id=?')
      .run(ship_name, ship_phone, ship_address, o.order_id);
    db.prepare('UPDATE shipment SET shipping_address=? WHERE order_id=?')
      .run(ship_address, o.order_id);
  });
  return { ok: true, order: orderDetail(o.order_id) };
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
  const addrStmt = db.prepare(`SELECT address_id, recipient, phone, house_no, village, road, subdistrict, district, province, postal_code, is_default
    FROM address WHERE customer_id=? ORDER BY is_default DESC, address_id LIMIT 1`);
  const customers = db.prepare(`SELECT c.customer_id,c.first_name,c.last_name,c.email,c.phone,c.address,c.admin_id,c.created_at,
    a.name admin_name,
    (SELECT COUNT(*) FROM "order" o WHERE o.customer_id=c.customer_id) orders,
    (SELECT COALESCE(SUM(total_price),0) FROM "order" o WHERE o.customer_id=c.customer_id AND o.status IN ('paid','shipped','completed')) spent
    FROM customer c
    LEFT JOIN admin a USING(admin_id)
    ORDER BY c.customer_id DESC`).all().map((c) => ({
    ...c,
    default_address: addrStmt.get(c.customer_id) || null
  }));
  return {
    admins: db.prepare('SELECT admin_id, name FROM admin ORDER BY admin_id').all(),
    customers
  };
}));
app.put('/api/admin/customers/:id', wrap((req) => {
  needAdmin(req);
  const cid = int(req.params.id), b = req.body || {};
  const existing = db.prepare('SELECT * FROM customer WHERE customer_id=?').get(cid);
  if (!existing) bad('ไม่พบข้อมูลลูกค้านี้', 404);
  const first = str(b.first_name, 60), last = str(b.last_name, 60);
  const email = str(b.email, 120).toLowerCase(), phone = str(b.phone, 30);
  const adminId = b.admin_id ? int(b.admin_id) : null;
  if (!first || !last) bad('กรุณากรอกชื่อและนามสกุลลูกค้า');
  if (!emailRe.test(email)) bad('รูปแบบอีเมลไม่ถูกต้อง');
  if (phone && !/^[0-9+\-\s]{9,20}$/.test(phone)) bad('เบอร์โทรศัพท์ไม่ถูกต้อง');
  if (db.prepare('SELECT 1 FROM customer WHERE LOWER(email)=? AND customer_id<>?').get(email, cid)) bad('อีเมลนี้ถูกใช้งานแล้ว', 409);
  if (adminId && !db.prepare('SELECT 1 FROM admin WHERE admin_id=?').get(adminId)) bad('ไม่พบแอดมินที่เลือก');
  const newPw = typeof b.new_password === 'string' ? b.new_password : '';
  if (newPw && newPw.length < 8) bad('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร');

  const erAddrKeys = ['house_no', 'village', 'road', 'subdistrict', 'district', 'province', 'postal_code'];
  const hasStructuredAddr = erAddrKeys.some((k) => b[k] !== undefined);
  const addrVals = Object.fromEntries(erAddrKeys.map((k) => [k, str(b[k], 120)]));
  const hasAnyAddrVal = erAddrKeys.some((k) => addrVals[k].length > 0);
  if (hasStructuredAddr && hasAnyAddrVal) {
    if (!addrVals.house_no || !addrVals.subdistrict || !addrVals.district || !addrVals.province) {
      bad('หากกรอกที่อยู่ กรุณากรอกบ้านเลขที่ ตำบล/แขวง อำเภอ/เขต และจังหวัดให้ครบ');
    }
    if (!/^\d{5}$/.test(addrVals.postal_code)) {
      bad('รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก');
    }
  }

  tx(() => {
    db.prepare('UPDATE customer SET first_name=?, last_name=?, email=?, phone=?, admin_id=? WHERE customer_id=?')
      .run(first, last, email, phone, adminId, cid);
    if (hasStructuredAddr) {
      const defAddr = db.prepare('SELECT * FROM address WHERE customer_id=? ORDER BY is_default DESC, address_id LIMIT 1').get(cid);
      if (hasAnyAddrVal) {
        if (defAddr) {
          db.prepare('UPDATE address SET house_no=?, village=?, road=?, subdistrict=?, district=?, province=?, postal_code=? WHERE address_id=?')
            .run(addrVals.house_no, addrVals.village, addrVals.road, addrVals.subdistrict, addrVals.district, addrVals.province, addrVals.postal_code, defAddr.address_id);
        } else {
          const hasAnyRow = db.prepare('SELECT 1 FROM address WHERE customer_id=?').get(cid);
          db.prepare(`INSERT INTO address (customer_id, recipient, phone, house_no, village, road, subdistrict, district, province, postal_code, is_default)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
            .run(cid, `${first} ${last}`.trim(), phone || '', addrVals.house_no, addrVals.village, addrVals.road, addrVals.subdistrict, addrVals.district, addrVals.province, addrVals.postal_code, hasAnyRow ? 0 : 1);
        }
        syncCustomerAddress(cid);
      } else if (defAddr) {
        db.prepare('DELETE FROM address WHERE address_id=?').run(defAddr.address_id);
        syncCustomerAddress(cid);
      } else if (b.clear_address) {
        db.prepare('UPDATE customer SET address=NULL WHERE customer_id=?').run(cid);
      }
    } else if (b.address !== undefined) {
      db.prepare('UPDATE customer SET address=? WHERE customer_id=?').run(str(b.address, 500) || null, cid);
    }
    if (newPw) {
      db.prepare('UPDATE customer SET password_hash=? WHERE customer_id=?').run(bcrypt.hashSync(newPw, 10), cid);
    }
    db.prepare('UPDATE review SET first_name=?, last_name=? WHERE customer_id=?').run(first, last, cid);
  });
  return { ok: true };
}));
app.delete('/api/admin/customers/:id', wrap((req) => {
  needAdmin(req);
  const cid = int(req.params.id);
  if (!db.prepare('SELECT 1 FROM customer WHERE customer_id=?').get(cid)) bad('ไม่พบข้อมูลลูกค้านี้', 404);
  if (db.prepare('SELECT 1 FROM "order" WHERE customer_id=? LIMIT 1').get(cid)) {
    bad('ลบไม่ได้ เพราะลูกค้ามีประวัติคำสั่งซื้อแล้ว');
  }
  tx(() => {
    db.prepare("DELETE FROM session WHERE role='customer' AND user_id=?").run(cid);
    db.prepare('DELETE FROM review_like WHERE customer_id=?').run(cid);
    db.prepare('DELETE FROM review WHERE customer_id=?').run(cid);
    db.prepare('DELETE FROM wishlist WHERE customer_id=?').run(cid);
    db.prepare('DELETE FROM cart_item WHERE customer_id=?').run(cid);
    db.prepare('DELETE FROM address WHERE customer_id=?').run(cid);
    db.prepare('DELETE FROM customer WHERE customer_id=?').run(cid);
  });
  return { ok: true };
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
app.post('/api/admin/admins', wrap((req) => {
  needAdmin(req);
  const b = req.body || {};
  const name = str(b.name, 100), email = str(b.email, 120).toLowerCase(), phone = str(b.phone, 30);
  const pw = typeof b.password === 'string' ? b.password : '';
  if (!name) bad('กรุณากรอกชื่อผู้ดูแลระบบ');
  if (!emailRe.test(email)) bad('รูปแบบอีเมลไม่ถูกต้อง');
  if (pw.length < 8) bad('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
  if (db.prepare('SELECT 1 FROM admin WHERE LOWER(email)=?').get(email)) bad('อีเมลแอดมินนี้ถูกใช้แล้ว', 409);
  const id = db.prepare('INSERT INTO admin (name,email,phone,password_hash) VALUES (?,?,?,?)')
    .run(name, email, phone, bcrypt.hashSync(pw, 10)).lastInsertRowid;
  return { admin_id: Number(id) };
}));
app.put('/api/admin/admins/:id', wrap((req) => {
  needAdmin(req);
  const aid = int(req.params.id), b = req.body || {};
  if (!db.prepare('SELECT 1 FROM admin WHERE admin_id=?').get(aid)) bad('ไม่พบผู้ดูแลระบบนี้', 404);
  const name = str(b.name, 100), email = str(b.email, 120).toLowerCase(), phone = str(b.phone, 30);
  if (!name) bad('กรุณากรอกชื่อผู้ดูแลระบบ');
  if (!emailRe.test(email)) bad('รูปแบบอีเมลไม่ถูกต้อง');
  if (db.prepare('SELECT 1 FROM admin WHERE LOWER(email)=? AND admin_id<>?').get(email, aid)) bad('อีเมลแอดมินนี้ถูกใช้แล้ว', 409);
  const newPw = typeof b.new_password === 'string' ? b.new_password : '';
  if (newPw && newPw.length < 8) bad('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร');
  tx(() => {
    db.prepare('UPDATE admin SET name=?, email=?, phone=? WHERE admin_id=?').run(name, email, phone, aid);
    if (newPw) {
      db.prepare('UPDATE admin SET password_hash=? WHERE admin_id=?').run(bcrypt.hashSync(newPw, 10), aid);
    }
  });
  return { ok: true };
}));
app.delete('/api/admin/admins/:id', wrap((req) => {
  const curId = needAdmin(req);
  const aid = int(req.params.id);
  if (aid === curId) bad('ไม่สามารถลบบัญชีแอดมินที่กำลังล็อกอินอยู่ได้');
  if (!db.prepare('SELECT 1 FROM admin WHERE admin_id=?').get(aid)) bad('ไม่พบผู้ดูแลระบบนี้', 404);
  if (db.prepare('SELECT COUNT(*) n FROM admin').get().n <= 1) bad('ต้องมีผู้ดูแลระบบอย่างน้อย 1 บัญชี');
  tx(() => {
    db.prepare("DELETE FROM session WHERE role='admin' AND user_id=?").run(aid);
    db.prepare('UPDATE supplier SET admin_id=NULL WHERE admin_id=?').run(aid);
    db.prepare('UPDATE customer SET admin_id=NULL WHERE admin_id=?').run(aid);
    db.prepare('DELETE FROM admin WHERE admin_id=?').run(aid);
  });
  return { ok: true };
}));

app.post('/api/admin/suppliers', wrap((req) => {
  const adminId = needAdmin(req);
  const b = req.body || {}, name = str(b.name, 120);
  if (!name) bad('กรุณากรอกชื่อซัพพลายเออร์');
  db.prepare('INSERT INTO supplier (name,contact_name,phone,email,address,employee_id,admin_id) VALUES (?,?,?,?,?,?,?)')
    .run(name, str(b.contact_name, 80), str(b.phone, 30), str(b.email, 120), str(b.address, 300), int(b.employee_id) || null, adminId);
}));
app.put('/api/admin/suppliers/:id', wrap((req) => {
  needAdmin(req);
  const sid = int(req.params.id), b = req.body || {};
  if (!db.prepare('SELECT 1 FROM supplier WHERE supplier_id=?').get(sid)) bad('ไม่พบซัพพลายเออร์นี้', 404);
  const name = str(b.name, 120);
  if (!name) bad('กรุณากรอกชื่อซัพพลายเออร์');
  const empId = b.employee_id ? int(b.employee_id) : null;
  if (empId && !db.prepare('SELECT 1 FROM employee WHERE employee_id=?').get(empId)) bad('ไม่พบพนักงานที่เลือก');
  db.prepare('UPDATE supplier SET name=?, contact_name=?, phone=?, email=?, address=?, employee_id=? WHERE supplier_id=?')
    .run(name, str(b.contact_name, 80), str(b.phone, 30), str(b.email, 120), str(b.address, 300), empId, sid);
  return { ok: true };
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
    .run(str(b.first_name, 60), str(b.last_name, 60), str(b.email, 120), str(b.phone, 30), str(b.position, 80), str(b.address, 300));
}));
app.put('/api/admin/employees/:id', wrap((req) => {
  needAdmin(req);
  const eid = int(req.params.id), b = req.body || {};
  if (!db.prepare('SELECT 1 FROM employee WHERE employee_id=?').get(eid)) bad('ไม่พบพนักงานนี้', 404);
  const first = str(b.first_name, 60), last = str(b.last_name, 60);
  if (!first || !last) bad('กรุณากรอกชื่อและนามสกุลพนักงาน');
  db.prepare('UPDATE employee SET first_name=?, last_name=?, email=?, phone=?, position=?, address=? WHERE employee_id=?')
    .run(first, last, str(b.email, 120), str(b.phone, 30), str(b.position, 80), str(b.address, 300), eid);
  return { ok: true };
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

app.get('/api/admin/coupons', wrap((req) => {
  needAdmin(req);
  return { coupons: db.prepare('SELECT * FROM coupon ORDER BY code').all() };
}));
app.post('/api/admin/coupons', wrap((req) => {
  needAdmin(req);
  const b = req.body || {};
  const code = str(b.code, 30).toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  const type = b.type === 'percent' ? 'percent' : 'fixed';
  const value = Number(b.value);
  const minTotal = Math.max(0, Number(b.min_total) || 0);
  const active = b.active === 0 || b.active === false || b.active === '0' ? 0 : 1;
  if (!code || code.length < 2) bad('กรุณากรอกรหัสคูปอง (ตัวอักษรภาษาอังกฤษ/ตัวเลขอย่างน้อย 2 ตัว)');
  if (!Number.isFinite(value) || value <= 0) bad('มูลค่าส่วนลดต้องมากกว่า 0');
  if (type === 'percent' && value > 100) bad('ส่วนลดแบบเปอร์เซ็นต์ต้องไม่เกิน 100%');
  if (db.prepare('SELECT 1 FROM coupon WHERE code=?').get(code)) bad('มีโค้ดส่วนลดนี้อยู่แล้ว', 409);
  db.prepare('INSERT INTO coupon (code,type,value,min_total,active) VALUES (?,?,?,?,?)').run(code, type, value, minTotal, active);
  return { ok: true, code };
}));
app.put('/api/admin/coupons/:code', wrap((req) => {
  needAdmin(req);
  const origCode = str(req.params.code, 30).toUpperCase();
  if (!db.prepare('SELECT 1 FROM coupon WHERE code=?').get(origCode)) bad('ไม่พบโค้ดส่วนลดนี้', 404);
  const b = req.body || {};
  const type = b.type === 'percent' ? 'percent' : 'fixed';
  const value = Number(b.value);
  const minTotal = Math.max(0, Number(b.min_total) || 0);
  const active = b.active === 0 || b.active === false || b.active === '0' ? 0 : 1;
  if (!Number.isFinite(value) || value <= 0) bad('มูลค่าส่วนลดต้องมากกว่า 0');
  if (type === 'percent' && value > 100) bad('ส่วนลดแบบเปอร์เซ็นต์ต้องไม่เกิน 100%');
  db.prepare('UPDATE coupon SET type=?, value=?, min_total=?, active=? WHERE code=?').run(type, value, minTotal, active, origCode);
  return { ok: true };
}));
app.delete('/api/admin/coupons/:code', wrap((req) => {
  needAdmin(req);
  const code = str(req.params.code, 30).toUpperCase();
  if (!db.prepare('SELECT 1 FROM coupon WHERE code=?').get(code)) bad('ไม่พบโค้ดส่วนลดนี้', 404);
  db.prepare('DELETE FROM coupon WHERE code=?').run(code);
  return { ok: true };
}));

/* ---------- Realtime SQL Server (SSMS .\SQLEXPRESS01) Integration ---------- */
app.get('/api/sql/status', (req, res) => {
  res.json({
    status: sqlSync.getStatus(),
    snapshot: sqlSync.getSnapshot()
  });
});

app.get('/api/sql/checksum', (req, res) => {
  if (req.query.instance) {
    sqlSync.registerBridgeHeartbeat({
      instance: str(req.query.instance, 120),
      database: str(req.query.database, 80) || 'NoirCreamShop'
    });
  }
  const meta = sqlSync.getMeta();
  const etag = `"${meta.checksum}"`;
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'no-cache');
  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }
  res.json(meta);
});

app.get('/api/sql/snapshot', (req, res) => {
  if (req.query.instance) {
    sqlSync.registerBridgeHeartbeat({
      instance: str(req.query.instance, 120),
      database: str(req.query.database, 80) || 'NoirCreamShop'
    });
  }
  const meta = sqlSync.getMeta();
  const etag = `"${meta.checksum}"`;
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'no-cache');
  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }
  if (req.query.meta === '1') {
    return res.json(meta);
  }
  const snap = sqlSync.getSnapshot();
  res.json({
    ...snap,
    status: sqlSync.getStatus({ includeLogs: false })
  });
});

app.get('/api/sql/script', (req, res) => {
  const meta = sqlSync.getMeta();
  const etag = `"${meta.checksum}"`;
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'no-cache');
  if (!req.query.download && req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }
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

app.post('/api/sql/push', async (req, res) => {
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
    if (sqlSync.getGitHubStatus().connected) {
      await Promise.race([
        sqlSync.syncToGitHubNow('SSMS Push (2-Way Sync)').catch(() => null),
        new Promise((r) => setTimeout(r, 4500))
      ]);
    }
    res.json({
      ok: true,
      checksum: snap?.checksum,
      counts: snap?.counts,
      status: sqlSync.getStatus({ includeLogs: false })
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'ซิงค์ข้อมูลจาก SSMS ไม่สำเร็จ' });
  }
});

app.post('/api/sql/query', async (req, res) => {
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
      for (const c of db.prepare('SELECT customer_id FROM customer').all()) {
        syncCustomerAddress(c.customer_id);
      }
      const reason = `SQL Execute: ${rawSql.slice(0, 60)}`;
      sqlSync.notifyChange(reason, 'sql-console');
      if (sqlSync.getGitHubStatus().connected) {
        await Promise.race([
          sqlSync.syncToGitHubNow(reason).catch(() => null),
          new Promise((r) => setTimeout(r, 4500))
        ]);
      }
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

  const meta = sqlSync.getMeta();
  const initPayload = {
    checksum: meta.checksum,
    timestamp: meta.timestamp,
    counts: meta.counts,
    ssmsStatus: sqlSync.getStatus({ includeLogs: false })
  };
  res.write(`event: init\ndata: ${JSON.stringify(initPayload)}\n\n`);
  sqlSync.addSseClient(res);

  const keepAlive = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { clearInterval(keepAlive); }
  }, 30000);
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
const server = app.listen(PORT, () => {
  console.log(`ร้านเปิดแล้วที่ http://localhost:${PORT} (พร้อมระบบเชื่อม SQL Server Realtime: .\\SQLEXPRESS01 และ GitHub Auto-Sync)`);
  sqlSync.restoreFromGitHub(false).then((r) => {
    if (r?.restored) {
      for (const p of db.prepare('SELECT product_id FROM product').all()) {
        syncStock(p.product_id);
      }
      for (const c of db.prepare('SELECT customer_id FROM customer').all()) {
        syncCustomerAddress(c.customer_id);
      }
      sqlSync.notifyChange('GitHub Startup Restore', 'github');
      console.log(`☁️ กู้คืนข้อมูลล่าสุดจาก GitHub สำเร็จ (Checksum: ${r.checksum})`);
    } else if (r?.hasPendingLocal) {
      console.log(`📌 พบข้อมูลในเครื่องที่ยังไม่ได้ซิงค์ขึ้น GitHub (${r.reason || 'local'}) — เก็บข้อมูลล่าสุดในเครื่องไว้เรียบร้อย`);
      if (sqlSync.getGitHubStatus().connected) {
        sqlSync.scheduleGitHubPush('Startup Pending Local Sync');
      }
    }
  }).catch(() => {}).finally(() => {
    startupRestoreDone = true;
    resolveStartupRestoreReady?.();
  });
});

let shuttingDown = false;
async function gracefulShutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    sqlSync.notifyChange('shutdown', 'system');
    await Promise.race([
      sqlSync.flushPendingSync(),
      new Promise((r) => setTimeout(r, 3500))
    ]);
  } catch {}
  try { db.close(); } catch {}
  try { server.close(() => process.exit(0)); } catch {}
  setTimeout(() => process.exit(0), 500).unref();
}

for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  try { process.on(sig, () => { gracefulShutdown(); }); } catch {}
}
