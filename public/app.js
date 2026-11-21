/* NOIR & CREAM — front-end (vanilla JS SPA, hash routing)
   Specialized in 4 Categories: เสื้อยืด, เสื้อโปโล, เสื้อแขนยาว, กางเกง
   Minimalist Cream · White · Noir Theme
*/
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const app = $('#app');
const state = {
  user: null,
  cart: { items: [], count: 0, subtotal: 0 },
  config: {
    free_shipping_min: 1000,
    shipping_fee: 50,
    pay_methods: ['โอนผ่านธนาคาร', 'PromptPay', 'บัตรเครดิต/เดบิต', 'เก็บเงินปลายทาง'],
    categories: ['เสื้อยืด', 'เสื้อโปโล', 'เสื้อแขนยาว', 'กางเกง'],
    contact: { line: '@noircream', phone: '081-234-5678', email: 'contact@noircream.example' }
  }
};

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => '฿' + Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 });
const dt = (s) => (s ? esc(s.slice(0, 16).replace('T', ' ')) : '-');
const STATUS = { pending: 'รอชำระเงิน', paid: 'ชำระแล้ว', shipped: 'กำลังจัดส่ง', completed: 'สำเร็จ', cancelled: 'ยกเลิก' };
const PAY_STATUS = { pending: 'รอชำระ', paid: 'ชำระแล้ว', cancelled: 'ยกเลิก' };
const SHIP_STATUS = { preparing: 'เตรียมจัดส่ง', shipped: 'ส่งออกแล้ว', delivered: 'ส่งถึงแล้ว' };

async function api(method, url, body) {
  const r = await fetch(url, {
    method,
    cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(j.error || 'เกิดข้อผิดพลาด');
    e.status = r.status;
    throw e;
  }
  return j;
}

let toastTimer;
function toast(msg, bad = false) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show' + (bad ? ' bad' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = 'toast'), 2800);
}

const go = (h) => { location.hash = h; };
const safe = async (fn) => {
  try { return await fn(); }
  catch (e) {
    if (e.status === 401) { go('#/login'); toast('กรุณาเข้าสู่ระบบก่อน', true); }
    else toast(e.message, true);
  }
};

/* ---------- Size Guides Data (ตารางไซส์ 4 หมวดหมู่) ---------- */
const SIZE_GUIDES = {
  'เสื้อยืด': {
    title: 'ตารางเทียบไซส์เสื้อยืด (T-Shirt Size Guide)',
    desc: 'ทรงเรกูลาร์-คอมฟอร์ท ใส่สบาย ผ้าคอตตอน 100% พรีเมียม (หน่วยวัด: นิ้ว)',
    headers: ['ไซส์', 'รอบอก (นิ้ว)', 'ความยาวเสื้อ (นิ้ว)', 'ไหล่กว้าง (นิ้ว)'],
    rows: [
      ['S', '36 – 38', '26.0', '16.5'],
      ['M', '39 – 40', '27.0', '17.5'],
      ['L', '41 – 43', '28.0', '18.5'],
      ['XL', '44 – 46', '29.0', '19.5'],
      ['2XL', '47 – 49', '30.0', '20.5']
    ]
  },
  'เสื้อโปโล': {
    title: 'ตารางเทียบไซส์เสื้อโปโล (Polo Shirt Size Guide)',
    desc: 'ทรงสมาร์ทแคชชวล คอปกทอแน่น ทรงสวยพอดีตัว (หน่วยวัด: นิ้ว)',
    headers: ['ไซส์', 'รอบอก (นิ้ว)', 'ความยาวเสื้อ (นิ้ว)', 'ไหล่กว้าง (นิ้ว)', 'ความยาวแขน (นิ้ว)'],
    rows: [
      ['S', '36 – 38', '26.5', '16.5', '8.0'],
      ['M', '39 – 41', '27.5', '17.5', '8.5'],
      ['L', '42 – 44', '28.5', '18.5', '9.0'],
      ['XL', '45 – 47', '29.5', '19.5', '9.5'],
      ['2XL', '48 – 50', '30.5', '20.5', '10.0']
    ]
  },
  'เสื้อแขนยาว': {
    title: 'ตารางเทียบไซส์เสื้อแขนยาว (Long Sleeve Size Guide)',
    desc: 'ทรงโอเวอร์ไซส์เล็กน้อย ปลายแขนกระชับ ใส่สบายในห้องแอร์และสภาพอากาศทั่วไป (หน่วยวัด: นิ้ว)',
    headers: ['ไซส์', 'รอบอก (นิ้ว)', 'ความยาวเสื้อ (นิ้ว)', 'ไหล่กว้าง (นิ้ว)', 'ความยาวแขน (นิ้ว)'],
    rows: [
      ['S', '38 – 40', '27.0', '17.0', '23.5'],
      ['M', '40 – 42', '28.0', '18.0', '24.5'],
      ['L', '43 – 45', '29.0', '19.0', '25.5'],
      ['XL', '46 – 48', '30.0', '20.0', '26.5'],
      ['2XL', '49 – 51', '31.0', '21.0', '27.5']
    ]
  },
  'กางเกง': {
    title: 'ตารางเทียบไซส์กางเกง (Pants & Trousers Size Guide)',
    desc: 'ทรงกระบอกตรง/ชิโน เอวระดับมาตรฐาน ผ้ายืดหยุ่นเล็กน้อย (หน่วยวัด: นิ้ว)',
    headers: ['ไซส์ (เอว)', 'รอบสะโพก (นิ้ว)', 'ความยาวกางเกง (นิ้ว)', 'รอบต้นขา (นิ้ว)', 'ปลายขา (นิ้ว)'],
    rows: [
      ['28 / S', '36', '38.0', '21.0', '13.0'],
      ['30 / M', '38', '39.0', '22.0', '14.0'],
      ['32 / L', '40', '40.0', '23.0', '14.5'],
      ['34 / XL', '42', '40.5', '24.0', '15.0'],
      ['36 / 2XL', '44', '41.0', '25.0', '15.5']
    ]
  }
};

/* ---------- Product Illustration (SVG Vector เฉพาะ 4 หมวดหมู่) ---------- */
function art(img, color) {
  if (img && /^https?:\/\//i.test(img)) {
    return `<img src="${esc(img)}" alt="" loading="lazy">`;
  }
  const key = (img || '').replace('shape:', '').toLowerCase();
  const fill = color || '#FAF7F2';
  const dark = ['#1A1A1A', '#141414', '#161616', '#2B3447', '#7A5C45', '#000000'].includes(fill.toUpperCase()) || fill.startsWith('#1') || fill.startsWith('#2');
  const stroke = dark ? '#000000' : '#141414';
  const detailStroke = dark ? '#FFFFFF' : '#141414';
  const detailOpacity = dark ? '0.45' : '0.35';

  if (key === 'polo') {
    return `<svg viewBox="0 0 120 120" aria-hidden="true">
      <path d="M32 18 L44 12 L60 16 L76 12 L88 18 L106 38 L92 48 L84 40 L84 108 L36 108 L36 40 L28 48 L14 38 Z" fill="${esc(fill)}" stroke="${stroke}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="M44 12 L56 26 L60 16 L64 26 L76 12" fill="none" stroke="${detailStroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M60 26 L60 52" fill="none" stroke="${detailStroke}" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="60" cy="34" r="1.3" fill="${detailStroke}"/>
      <circle cx="60" cy="44" r="1.3" fill="${detailStroke}"/>
    </svg>`;
  }
  if (key === 'longsleeve' || key === 'sweater' || key === 'shirt') {
    return `<svg viewBox="0 0 120 120" aria-hidden="true">
      <path d="M32 18 L46 12 Q60 22 74 12 L88 18 L108 82 L94 86 L84 56 L84 108 L36 108 L36 56 L26 86 L12 82 Z" fill="${esc(fill)}" stroke="${stroke}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="M46 12 Q60 22 74 12" fill="none" stroke="${detailStroke}" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M14 78 L26 82 M94 82 L106 78" fill="none" stroke="${detailStroke}" stroke-width="1.4" stroke-opacity="${detailOpacity}"/>
    </svg>`;
  }
  if (key === 'pants') {
    return `<svg viewBox="0 0 120 120" aria-hidden="true">
      <path d="M34 14 L86 14 L90 108 L66 108 L60 46 L54 108 L30 108 Z" fill="${esc(fill)}" stroke="${stroke}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="M34 22 L86 22" fill="none" stroke="${detailStroke}" stroke-width="1.4" stroke-opacity="${detailOpacity}"/>
      <path d="M60 22 L60 42" fill="none" stroke="${detailStroke}" stroke-width="1.4" stroke-opacity="${detailOpacity}"/>
      <path d="M38 28 Q44 34 50 28 M82 28 Q76 34 70 28" fill="none" stroke="${detailStroke}" stroke-width="1.2" stroke-opacity="${detailOpacity}"/>
    </svg>`;
  }
  // Default tee (เสื้อยืด)
  return `<svg viewBox="0 0 120 120" aria-hidden="true">
    <path d="M30 16 L44 10 Q60 22 76 10 L90 16 L108 38 L94 48 L86 40 L86 108 L34 108 L34 40 L26 48 L12 38 Z" fill="${esc(fill)}" stroke="${stroke}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M44 10 Q60 22 76 10" fill="none" stroke="${detailStroke}" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M15 35 L25 43 M95 43 L105 35" fill="none" stroke="${detailStroke}" stroke-width="1.3" stroke-opacity="${detailOpacity}"/>
  </svg>`;
}

const stars = (r, n) => (n ? `<span class="stars">★ ${r} <span class="muted">(${n})</span></span>` : '<span class="stars muted">ยังไม่มีรีวิว</span>');
const heartSvg = '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.8 5 6.2 5c2 0 3.4 1 4.3 2.4h3C14.4 6 15.8 5 17.8 5c3.4 0 5.3 3.4 3.8 6.8C19.5 16.4 12 21 12 21z"/></svg>';

function card(p) {
  const out = p.stock === 0;
  const price = p.min_price === p.max_price ? money(p.min_price) : `${money(p.min_price)} – ${money(p.max_price)}`;
  return `<article class="card">
    <button class="heart ${p.wished ? 'on' : ''}" aria-label="เพิ่มในรายการโปรด" onclick="A.wish(${p.product_id}, this)">${heartSvg}</button>
    <a href="#/product/${p.product_id}">
      <div class="img">${p.is_featured ? '<span class="tag">แนะนำ</span>' : ''}${out ? '<span class="tag out">สินค้าหมด</span>' : ''}${art(p.image_url)}</div>
      <h3>${esc(p.name)}</h3>
      <div class="cat-name">${esc(p.category)}</div>
      <div class="price">${price}</div>
      ${stars(p.rating, p.review_count)}
    </a></article>`;
}

/* ---------- Chrome (Header, Nav, Topbar) ---------- */
function renderChrome() {
  const top = $('#topbar');
  if (top) {
    top.innerHTML = `<span>ส่งฟรีเมื่อซื้อครบ ${money(state.config.free_shipping_min)} · เปลี่ยนไซส์ได้ภายใน 7 วัน · โค้ด <b>WELCOME10</b> ลด 10%</span>`;
  }
  const u = state.user;
  let h = `<a class="icon-btn" href="#/shop" aria-label="ค้นหาสินค้า"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg></a>`;
  if (u?.role === 'customer') {
    h += `<a class="icon-btn hide-mobile" href="#/wishlist" aria-label="รายการโปรด">♡ <span class="lbl">โปรด</span></a>
      <a class="icon-btn hide-mobile" href="#/orders">📦 <span class="lbl">คำสั่งซื้อ</span></a>
      <a class="icon-btn" href="#/account" aria-label="บัญชีของฉัน">👤 <span class="lbl">${esc(u.first_name)}</span></a>`;
  } else if (u?.role === 'admin') {
    const shortName = String(u.name || '').trim().split(/\s+/)[0] || u.name;
    h += `<a class="icon-btn" href="#/admin" style="font-weight:500;background:var(--cream-2)">⚙️ <span class="lbl">จัดการร้าน</span></a>
      <a class="icon-btn hide-mobile" href="#/wishlist" aria-label="รายการโปรด" title="รายการโปรด (ทดลองซื้อ)">♡</a>
      <a class="icon-btn hide-mobile" href="#/orders" aria-label="คำสั่งซื้อ" title="คำสั่งซื้อ (โหมดทดลองซื้อ)">📦 <span class="lbl">ออเดอร์</span></a>
      <a class="icon-btn hide-mobile" href="#/account" title="${esc(u.name)}">👤 <span class="lbl">${esc(shortName)}</span></a>`;
  } else {
    h += `<a class="icon-btn" href="#/login">👤 <span class="lbl">เข้าสู่ระบบ</span></a><a class="btn sm hide-mobile" href="#/register">สมัครสมาชิก</a>`;
  }
  h += `<a class="icon-btn" href="#/cart" aria-label="ตะกร้า">🛍️ <span class="lbl">ตะกร้า</span>${state.cart.count ? `<span class="badge">${state.cart.count}</span>` : ''}</a>`;
  if (u) {
    h += `<button class="icon-btn hide-mobile" onclick="A.logout()" title="ออกจากระบบ">ออก</button>`;
  }
  $('#actions').innerHTML = h;

  const mobUser = $('#mobileUserActions');
  if (mobUser) {
    if (u?.role === 'customer') {
      mobUser.innerHTML = `
        <a href="#/account" onclick="A.toggleMobileMenu()">👤 บัญชีของฉัน (${esc(u.first_name)})</a>
        <a href="#/orders" onclick="A.toggleMobileMenu()">📦 คำสั่งซื้อของฉัน</a>
        <a href="#/wishlist" onclick="A.toggleMobileMenu()">♡ รายการโปรด</a>
        <a href="#/cart" onclick="A.toggleMobileMenu()">🛍️ ตะกร้าสินค้า (${state.cart.count} ชิ้น)</a>
        <button class="btn ghost sm block" style="margin-top:8px" onclick="A.toggleMobileMenu(); A.logout()">ออกจากระบบ</button>
      `;
    } else if (u?.role === 'admin') {
      mobUser.innerHTML = `
        <a href="#/admin" onclick="A.toggleMobileMenu()">⚙️ ระบบจัดการร้านค้า (Admin)</a>
        <a href="#/account" onclick="A.toggleMobileMenu()">👤 บัญชีผู้ดูแล (${esc(u.name)})</a>
        <a href="#/orders" onclick="A.toggleMobileMenu()">📦 คำสั่งซื้อ (ทดลองซื้อ)</a>
        <a href="#/wishlist" onclick="A.toggleMobileMenu()">♡ รายการโปรด</a>
        <a href="#/cart" onclick="A.toggleMobileMenu()">🛍️ ตะกร้าสินค้า (${state.cart.count} ชิ้น)</a>
        <button class="btn ghost sm block" style="margin-top:8px" onclick="A.toggleMobileMenu(); A.logout()">ออกจากระบบ</button>
      `;
    } else {
      mobUser.innerHTML = `
        <a href="#/cart" onclick="A.toggleMobileMenu()">🛍️ ตะกร้าสินค้า</a>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
          <a class="btn ghost sm" href="#/login" onclick="A.toggleMobileMenu()">เข้าสู่ระบบ</a>
          <a class="btn sm" href="#/register" onclick="A.toggleMobileMenu()">สมัครสมาชิก</a>
        </div>
      `;
    }
  }

  // Active nav highlighting
  const curHash = location.hash || '#/';
  const navLinks = $$('#nav a');
  // First pass: find the most specific match
  let bestMatch = null;
  let bestLen = 0;
  navLinks.forEach((a) => {
    const href = a.getAttribute('href');
    if (href === curHash) {
      // Exact match always wins
      bestMatch = a;
      bestLen = Infinity;
    } else if (href !== '#/' && curHash.startsWith(href.split('?')[0]) && href.length > bestLen && bestLen < Infinity) {
      // Check if the full href (including query) matches
      if (curHash === href || curHash.startsWith(href + '&')) {
        bestMatch = a;
        bestLen = href.length;
      }
    }
  });
  // If navigating to #/shop?category=X, match the specific category link, not the generic #/shop
  if (!bestMatch && curHash.startsWith('#/shop')) {
    const curParams = new URLSearchParams(curHash.split('?')[1] || '');
    const curCat = curParams.get('category') || '';
    navLinks.forEach((a) => {
      const href = a.getAttribute('href');
      if (!href.includes('?')) return;
      const hrefParams = new URLSearchParams(href.split('?')[1] || '');
      const hrefCat = hrefParams.get('category') || '';
      if (curCat && hrefCat === curCat) { bestMatch = a; }
    });
    // If no category selected, match generic "สินค้าทั้งหมด" (#/shop)
    if (!bestMatch && !curCat) {
      navLinks.forEach((a) => {
        if (a.getAttribute('href') === '#/shop') bestMatch = a;
      });
    }
  }
  navLinks.forEach((a) => a.classList.toggle('active', a === bestMatch));
}

async function loadCart() {
  if (state.user) {
    try { state.cart = await api('GET', '/api/cart'); } catch { /* ignore */ }
  } else {
    state.cart = { items: [], count: 0, subtotal: 0 };
  }
  renderChrome();
  const badge = $('#actions .badge');
  if (badge && state.cart.count > 0) {
    badge.classList.remove('bump');
    void badge.offsetWidth;
    badge.classList.add('bump');
  }
}

/* ---------- Pages ---------- */
const pages = {};

pages.home = async () => {
  const [{ products }, { categories }] = await Promise.all([
    api('GET', '/api/products?featured=1'),
    api('GET', '/api/categories')
  ]);

  const catIcons = {
    'เสื้อยืด': 'shape:tee',
    'เสื้อโปโล': 'shape:polo',
    'เสื้อแขนยาว': 'shape:longsleeve',
    'กางเกง': 'shape:pants'
  };

  app.innerHTML = `
    <section class="hero">
      <div class="hero-text">
        <span class="eyebrow">Collection 2026 · Noir &amp; Cream</span>
        <h1>เสื้อยืด · เสื้อโปโล<br>เสื้อแขนยาว · กางเกง</h1>
        <p>โทนครีม ขาว ดำ เรียบนิ่งเหนือกาลเวลา คัดสรรเฉพาะ 4 ชิ้นหลักที่คุณต้องมี ตัดเย็บประณีต ใส่สบายได้ทุกวัน</p>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <a class="btn light" href="#/shop">เลือกชมสินค้า</a>
          <button class="btn ghost" style="color:var(--cream);border-color:var(--cream-3)" onclick="A.openSizeModal('เสื้อยืด')">ตารางเทียบไซส์ 📏</button>
        </div>
      </div>
      <div class="hero-art">${art('shape:polo', '#141414')}</div>
    </section>

    <div class="perks">
      <div class="perk"><div class="perk-icon">🚚</div><b>ส่งฟรีทั่วประเทศ</b><span>เมื่อซื้อครบ ${money(state.config.free_shipping_min)}</span></div>
      <div class="perk"><div class="perk-icon">🔄</div><b>เปลี่ยนไซส์ได้ใน 7 วัน</b><span>หากใส่ไม่พอดี ป้ายครบไม่ตัด</span></div>
      <div class="perk"><div class="perk-icon">💳</div><b>ชำระเงินสะดวก</b><span>PromptPay · โอน · บัตร · COD</span></div>
      <div class="perk"><div class="perk-icon">🧵</div><b>ผ้าพรีเมียมคอตตอน</b><span>เนื้อนุ่ม อยู่ทรง โทนครีม ขาว ดำ</span></div>
    </div>

    <div class="section-head">
      <div>
        <h2>หมวดหมู่สินค้าหลัก</h2>
        <p class="muted" style="margin:4px 0 0">ร้านจำหน่ายเฉพาะ 4 ไอเทมคลาสสิกที่แมตช์เข้ากันได้ทุกลุค</p>
      </div>
    </div>
    <div class="cats">
      ${categories.map((c) => `
        <a class="cat" href="#/shop?category=${encodeURIComponent(c.category)}">
          <div class="cat-preview">${art(catIcons[c.category] || 'shape:tee', '#141414')}</div>
          <b>${esc(c.category)}</b>
          <small>${c.n > 0 ? `${c.n} รายการพร้อมส่ง` : 'เปิดรับสต็อก'}</small>
        </a>
      `).join('')}
    </div>

    <div class="section-head">
      <div>
        <h2>สินค้าแนะนำ (Featured)</h2>
        <p class="muted" style="margin:4px 0 0">ชิ้นยอดนิยมประจำสัปดาห์</p>
      </div>
      <a class="link" href="#/shop">ดูสินค้าทั้งหมด →</a>
    </div>

    ${products.length ? `
      <div class="grid">${products.map(card).join('')}</div>
    ` : `
      <div class="empty">
        <div style="font-size:36px;margin-bottom:8px">🧺</div>
        <h3>ร้านกำลังเตรียมสต็อกสินค้าใหม่</h3>
        <p class="muted">เราจำหน่ายเฉพาะ: <b>เสื้อยืด, เสื้อโปโล, เสื้อแขนยาว และกางเกง</b> โทนครีม ขาว ดำ</p>
        ${state.user?.role === 'admin' ? `
          <div style="margin-top:16px">
            <a class="btn" href="#/admin">+ เพิ่มสินค้าใหม่และสต็อกลงร้าน</a>
          </div>
        ` : `
          <p style="font-size:13.5px;color:var(--ink-3);margin-top:8px">กำลังนำเข้าสินค้าล็อตใหม่ เร็วๆ นี้</p>
        `}
      </div>
    `}

    <section class="panel" style="margin-top:56px;background:var(--cream);border-color:var(--cream-3)">
      <div class="hero-teaser">
        <div>
          <span style="letter-spacing:.2em;text-transform:uppercase;font-size:12px;color:var(--ink-3)">Size &amp; Fit Guide</span>
          <h2 style="margin:8px 0 12px">ไม่แน่ใจเรื่องขนาดไซส์?</h2>
          <p style="margin:0 0 18px;color:var(--ink-2)">เรามีตารางเทียบไซส์มาตรฐานครบทั้ง เสื้อยืด, เสื้อโปโล, เสื้อแขนยาว และกางเกง พร้อมคำแนะนำวิธีวัดขนาดร่างกาย เพื่อให้คุณได้ชิ้นที่ใส่พอดีที่สุด</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn sm" onclick="A.openSizeModal('เสื้อยืด')">ดูตารางไซส์เสื้อยืด</button>
            <button class="btn sm" onclick="A.openSizeModal('เสื้อโปโล')">ดูตารางไซส์โปโล</button>
            <button class="btn sm" onclick="A.openSizeModal('เสื้อแขนยาว')">ดูตารางไซส์แขนยาว</button>
            <button class="btn sm" onclick="A.openSizeModal('กางเกง')">ดูตารางไซส์กางเกง</button>
          </div>
        </div>
        <div style="text-align:center;background:var(--white);padding:24px;border-radius:var(--radius);border:1px solid var(--line)">
          <div style="font-size:32px;margin-bottom:6px">🔄</div>
          <b style="display:block;font-size:16px;margin-bottom:4px">รับประกันเปลี่ยนไซส์ใน 7 วัน</b>
          <p class="muted" style="font-size:13px;margin:0">หากสั่งไปแล้วใส่ไม่พอดี สามารถติดต่อขอเปลี่ยนไซส์ได้ทันที สินค้าต้องอยู่ในสภาพเดิมและยังไม่ผ่านการซัก</p>
        </div>
      </div>
    </section>
  `;
};

pages.shop = async (params) => {
  const q = params.get('q') || '', category = params.get('category') || '', sort = params.get('sort') || '';
  const qs = new URLSearchParams({ q, category, sort }).toString();
  const [{ products }, { categories }] = await Promise.all([
    api('GET', '/api/products?' + qs),
    api('GET', '/api/categories')
  ]);

  const chip = (c, label) => `<a class="chip ${category === c ? 'on' : ''}" href="#/shop?${new URLSearchParams({ q, category: c, sort })}">${esc(label)}</a>`;

  app.innerHTML = `
    <div class="crumbs"><a href="#/">หน้าแรก</a> / สินค้าทั้งหมด ${category ? `/ ${esc(category)}` : ''}</div>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:16px;flex-wrap:wrap;gap:12px">
      <div>
        <h2 style="margin:0">${category ? esc(category) : 'สินค้าทั้งหมด'}</h2>
        <span class="muted" style="font-size:13.5px">จำหน่ายเฉพาะ: เสื้อยืด · เสื้อโปโล · เสื้อแขนยาว · กางเกง</span>
      </div>
      <button class="btn ghost sm" onclick="A.openSizeModal('${category || 'เสื้อยืด'}')">📏 ตารางเทียบไซส์</button>
    </div>

    <div class="shop-head">
      <div class="chips">
        ${chip('', 'ทั้งหมด')}
        ${categories.map((c) => chip(c.category, `${c.category}${c.n > 0 ? ` (${c.n})` : ''}`)).join('')}
      </div>
      <form class="tools" onsubmit="return A.search(event)">
        <input name="q" value="${esc(q)}" placeholder="ค้นหาสินค้า..." aria-label="ค้นหาสินค้า">
        <select name="sort" onchange="this.form.requestSubmit()" aria-label="เรียงลำดับ">
          ${[
            ['', 'เรียงตามปกติ'],
            ['new', 'มาใหม่'],
            ['price_asc', 'ราคา ต่ำ → สูง'],
            ['price_desc', 'ราคา สูง → ต่ำ'],
            ['rating', 'คะแนนรีวิว']
          ].map(([v, l]) => `<option value="${v}" ${v === sort ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
        <input type="hidden" name="category" value="${esc(category)}">
      </form>
    </div>

    ${products.length ? `
      <div class="grid">${products.map(card).join('')}</div>
    ` : `
      <div class="empty">
        <div style="font-size:36px;margin-bottom:8px">🔍</div>
        <h3>ไม่พบสินค้าในหมวดหมู่นี้</h3>
        <p class="muted">${q ? `ไม่พบสินค้าที่ตรงกับคำค้นหา "${esc(q)}"` : 'ร้านยังไม่ได้เพิ่มสินค้าในหมวดหมู่นี้ หรือสินค้ากำลังอยู่ระหว่างเตรียมสต็อก'}</p>
        <div style="display:flex;gap:10px;justify-content:center;margin-top:16px;flex-wrap:wrap">
          <a class="btn sm ghost" href="#/shop">ดูสินค้าหมวดหมู่อื่น</a>
          ${state.user?.role === 'admin' ? `<a class="btn sm" href="#/admin">+ ไปเพิ่มสินค้าในระบบจัดการร้าน</a>` : ''}
        </div>
      </div>
    `}
  `;
};

pages.product = async (params, id) => {
  const { product: p } = await api('GET', '/api/products/' + id);
  if (!p.variants || !p.variants.length) {
    app.innerHTML = `<div class="empty"><h3>สินค้านี้ยังไม่มีรูปแบบหรือไซส์ที่พร้อมจำหน่าย</h3><a class="btn" href="#/shop">กลับหน้าร้าน</a></div>`;
    return;
  }
  const colors = [...new Map(p.variants.map((v) => [v.color, v.color_hex])).entries()];
  const sizes = [...new Set(p.variants.map((v) => v.size))];
  const sel = {
    color: (p.variants.find((v) => v.stock > 0) || p.variants[0]).color,
    size: (p.variants.find((v) => v.stock > 0) || p.variants[0]).size,
    qty: 1
  };
  const find = () => p.variants.find((v) => v.color === sel.color && v.size === sel.size);
  const price = p.min_price === p.max_price ? money(p.min_price) : `${money(p.min_price)} – ${money(p.max_price)}`;

  const draw = (animColor = false) => {
    const v = find();
    const hex = colors.find((c) => c[0] === sel.color)?.[1] || '#FAF7F2';
    const pdImg = $('#pd-img');
    if (pdImg) {
      pdImg.innerHTML = art(p.image_url, hex);
      if (animColor) {
        pdImg.classList.remove('switching');
        void pdImg.offsetWidth;
        pdImg.classList.add('switching');
      }
    }
    const pdPrice = $('#pd-price');
    if (pdPrice) {
      pdPrice.textContent = v ? money(v.price) : price;
      if (animColor) {
        pdPrice.classList.remove('pop');
        void pdPrice.offsetWidth;
        pdPrice.classList.add('pop');
      }
    }
    $('#pd-colorname').textContent = sel.color;
    $('#pd-swatches').innerHTML = colors.map(([c, h]) => `
      <button class="swatch ${c === sel.color ? 'on' : ''}" style="background:${esc(h)}" title="${esc(c)}" aria-label="สี ${esc(c)}" onclick="A.pick('color', ${JSON.stringify(c).replace(/"/g, '&quot;')})"></button>
    `).join('');

    $('#pd-sizes').innerHTML = sizes.map((s) => {
      const vv = p.variants.find((x) => x.color === sel.color && x.size === s);
      const dis = !vv || vv.stock === 0;
      return `<button class="size ${s === sel.size ? 'on' : ''}" ${dis ? 'disabled title="หมด"' : ''} onclick="A.pick('size', ${JSON.stringify(s).replace(/"/g, '&quot;')})">${esc(s)}</button>`;
    }).join('');

    if (v) {
      const vidTag = ` <span class="muted" style="font-size:12px">· Variant_ID: #${v.variant_id}</span>`;
      if (v.stock === 0) {
        $('#pd-stock').innerHTML = '<span style="color:var(--danger)">สินค้าหมดชั่วคราว</span>' + vidTag;
      } else if (v.stock <= 3) {
        $('#pd-stock').innerHTML = `<span style="color:var(--danger)">เหลือเพียง ${v.stock} ชิ้นสุดท้าย!</span>` + vidTag;
      } else {
        $('#pd-stock').innerHTML = `มีสินค้าพร้อมส่ง (${v.stock} ชิ้น)` + vidTag;
      }
    } else {
      $('#pd-stock').textContent = 'กรุณาเลือกไซส์และสี';
    }

    const qEl = $('#pd-qty');
    if (qEl) qEl.textContent = sel.qty;
    const addBtn = $('#pd-add');
    if (addBtn) addBtn.disabled = !v || v.stock === 0;
  };

  A.pick = (k, val) => {
    const changed = sel[k] !== val;
    sel[k] = val;
    if (k === 'color') {
      const v = find();
      if (!v || v.stock === 0) {
        const firstAvail = p.variants.find((x) => x.color === sel.color && x.stock > 0);
        if (firstAvail) sel.size = firstAvail.size;
      }
    }
    sel.qty = 1;
    draw(changed);
  };

  A.qty = (d) => {
    const v = find();
    const max = v ? v.stock : 1;
    sel.qty = Math.min(max, Math.max(1, sel.qty + d));
    draw(false);
    const qEl = $('#pd-qty');
    if (qEl) {
      qEl.classList.remove('pop');
      void qEl.offsetWidth;
      qEl.classList.add('pop');
    }
  };

  A.addToCart = () => safe(async () => {
    if (!state.user) { go('#/login'); return toast('กรุณาเข้าสู่ระบบก่อนเพิ่มสินค้าลงตะกร้า', true); }
    const v = find();
    if (!v || v.stock === 0) return toast('กรุณาเลือกไซส์ที่มีสินค้าพร้อมส่ง', true);
    const addBtn = $('#pd-add');
    if (addBtn) spawnParticles(addBtn, ['✦', '🛍️', '•', '✧']);
    flyToCart($('#pd-img'));
    state.cart = await api('POST', '/api/cart', { variant_id: v.variant_id, quantity: sel.qty });
    renderChrome();
    const badge = $('#actions .badge');
    if (badge) {
      badge.classList.remove('bump');
      void badge.offsetWidth;
      badge.classList.add('bump');
    }
    toast(`เพิ่ม "${p.name} (${sel.color}/${sel.size})" ลงในตะกร้าแล้ว`);
  });

  app.innerHTML = `
    <div class="crumbs"><a href="#/">หน้าแรก</a> / <a href="#/shop?category=${encodeURIComponent(p.category)}">${esc(p.category)}</a> / ${esc(p.name)}</div>
    <div class="pd">
      <div class="pd-img" id="pd-img"></div>
      <div>
        <div class="muted" style="text-transform:uppercase;letter-spacing:.08em;font-size:12.5px">${esc(p.category)} · <span style="text-transform:none">Product_id: #${p.product_id}</span></div>
        <h1 style="font-size:clamp(28px,3.4vw,40px);margin:4px 0 8px">${esc(p.name)}</h1>
        ${stars(p.rating, p.review_count)}
        <div class="pd-price" id="pd-price"></div>
        <p style="color:var(--ink-2);line-height:1.7">${esc(p.description || 'เสื้อผ้าโทนครีม ขาว ดำ ทรงเรียบ สวมใส่สบาย ออกแบบให้แมตช์ง่ายได้ทุกวัน')}</p>

        <div class="label"><span>สี: <b id="pd-colorname" style="font-weight:500"></b></span></div>
        <div class="swatches" id="pd-swatches"></div>

        <div class="label">
          <span>ไซส์</span>
          <button class="link" style="font-size:13px" onclick="A.openSizeModal('${esc(p.category)}')">📏 ตารางเทียบไซส์</button>
        </div>
        <div class="sizes" id="pd-sizes"></div>
        <div id="pd-stock" style="font-size:13px;margin-top:6px;color:var(--ink-3)"></div>

        <div class="label"><span>จำนวน</span></div>
        <div class="qty">
          <button onclick="A.qty(-1)" aria-label="ลด">−</button>
          <span id="pd-qty">1</span>
          <button onclick="A.qty(1)" aria-label="เพิ่ม">+</button>
        </div>

        <div class="buy-row">
          <button class="btn" id="pd-add" onclick="A.addToCart()">เพิ่มลงตะกร้า</button>
          <button class="btn ghost" onclick="A.wish(${p.product_id}, this)">♡ รายการโปรด</button>
        </div>

        <div class="info-list">
          <div>🚚 <b>ส่งฟรี</b> เมื่อซื้อครบ ${money(state.config.free_shipping_min)} (จัดส่งภายใน 1-3 วัน)</div>
          <div>🔄 <b>เปลี่ยนไซส์ได้</b> ภายใน 7 วัน หากใส่ไม่พอดี</div>
          <div>🧵 <b>การดูแลรักษา</b> ซักน้ำเย็น ถนอมผ้า รีดไฟปานกลาง</div>
        </div>
      </div>
    </div>

    <section class="reviews">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <h2 style="margin:0">รีวิวจากลูกค้า (${p.reviews ? p.reviews.length : 0})</h2>
        <span class="muted" style="font-size:13.5px">${stars(p.rating, p.review_count)}</span>
      </div>
      ${reviewForm(p)}
      ${p.reviews && p.reviews.length ? p.reviews.map((r) => {
        const myCid = state.user?.shop_customer_id || state.user?.id;
        const isMyReview = myCid === r.customer_id;
        const isAdmin = state.user?.role === 'admin';
        return `
        <div class="review" id="review-${r.review_id}">
          <div class="review-top">
            <div class="review-author">
              <b>${esc(r.customer_name || r.name || 'ลูกค้า')}</b>
              <span class="muted" style="font-size:12px;margin-left:4px">(Customer #${r.customer_id})</span>
              ${isMyReview ? '<span class="review-tag">รีวิวของคุณ</span>' : ''}
              <div style="margin-left:8px">${'★'.repeat(r.rating)}<span class="muted">${'★'.repeat(5 - r.rating)}</span></div>
            </div>
            <div class="meta">Review #${r.review_id} · ${dt(r.created_at)}</div>
          </div>
          <div class="review-text">${esc(r.comment) || '<span class="muted">(ไม่มีข้อความรีวิว)</span>'}</div>
          <div class="review-foot">
            <button class="like-btn ${r.liked_by_me ? 'liked' : ''}" onclick="A.likeReview(${r.review_id}, ${p.product_id}, this)" title="กดไลค์รีวิวนี้">
              ${r.liked_by_me ? '❤️' : '🤍'} ถูกใจ (${r.like_count || 0})
            </button>
            <div class="review-actions">
              ${isMyReview ? `
                <button class="btn ghost sm" onclick="A.startEditReview(${p.product_id}, ${r.rating}, ${JSON.stringify(r.comment || '').replace(/"/g, '&quot;')})">✏️ แก้ไข</button>
                <button class="btn danger sm" onclick="A.deleteReview(${r.review_id}, ${p.product_id})">ลบ</button>
              ` : ''}
              ${isAdmin && !isMyReview ? `
                <button class="btn danger sm" onclick="A.deleteReview(${r.review_id}, ${p.product_id})">🗑️ ลบรีวิว (Admin)</button>
              ` : ''}
            </div>
          </div>
        </div>
      `; }).join('') : '<p class="muted">ยังไม่มีรีวิวสำหรับสินค้านี้ สั่งซื้อแล้วมาร่วมแบ่งปันความประทับใจได้เลย</p>'}
    </section>
  `;
  draw();
};

function reviewForm(p) {
  if (!state.user) {
    return '<p class="muted" style="font-size:13.5px">เข้าสู่ระบบเพื่อเขียนรีวิว (เฉพาะผู้ที่เคยสั่งซื้อสินค้านี้)</p>';
  }
  if (!p.can_review) {
    return '<p class="muted" style="font-size:13.5px">รีวิวได้เฉพาะสินค้าที่คุณเคยสั่งซื้อและชำระเงินแล้ว</p>';
  }
  const r = p.my_review || { rating: 5, comment: '' };
  A._rate = r.rating || 5;
  return `
    <form class="panel" id="review-form-${p.product_id}" style="margin:16px 0 16px" onsubmit="return A.review(event, ${p.product_id})">
      <div class="review-form-title" style="margin-bottom:8px">
        <b>${p.my_review ? '✏️ แก้ไขรีวิวของคุณ' : '✍️ เขียนรีวิวสินค้านี้'}</b>
      </div>
      <div class="starpick" id="stars">
        ${[1, 2, 3, 4, 5].map((n) => `
          <button type="button" class="${n <= A._rate ? 'on' : ''}" aria-label="${n} ดาว" onclick="A.rate(${n})">★</button>
        `).join('')}
      </div>
      <div class="field" style="margin-top:10px">
        <textarea name="comment" rows="3" maxlength="1000" placeholder="บอกเล่าประสบการณ์การสวมใส่ เช่น เนื้อผ้า ความพอดีไซส์...">${esc(r.comment)}</textarea>
      </div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <button class="btn sm">${p.my_review ? 'บันทึกการแก้ไขรีวิว' : 'ส่งรีวิว'}</button>
        ${p.my_review ? `<button type="button" class="btn danger sm" onclick="A.deleteReview(${p.my_review.review_id}, ${p.product_id})">ลบรีวิวนี้</button>` : ''}
      </div>
    </form>
  `;
}

/* ---------- Dedicated Size Guide Page ---------- */
pages['size-guide'] = async (params) => {
  const cat = params.get('cat') || 'เสื้อยืด';
  const renderTable = (cName) => {
    const g = SIZE_GUIDES[cName];
    if (!g) return '';
    return `
      <div class="policy-card" id="guide-${esc(cName)}">
        <h3 style="margin-bottom:6px">${esc(g.title)}</h3>
        <p class="muted" style="font-size:13.5px;margin:0 0 14px">${esc(g.desc)}</p>
        <div class="table-wrap">
          <table class="size-table">
            <thead>
              <tr>${g.headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${g.rows.map((row) => `
                <tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  };

  app.innerHTML = `
    <div class="crumbs"><a href="#/">หน้าแรก</a> / ตารางเทียบไซส์มาตรฐาน</div>
    <div style="margin-bottom:28px">
      <h2>ตารางเทียบไซส์เสื้อผ้า (Size Guide)</h2>
      <p class="muted" style="margin:4px 0 0">ข้อมูลขนาดและวิธีวัดตัวสำหรับ เสื้อยืด, เสื้อโปโล, เสื้อแขนยาว และกางเกง</p>
    </div>

    <div class="chips" style="margin-bottom:24px">
      ${Object.keys(SIZE_GUIDES).map((k) => `
        <a class="chip ${k === cat ? 'on' : ''}" href="#/size-guide?cat=${encodeURIComponent(k)}">${esc(k)}</a>
      `).join('')}
    </div>

    ${renderTable(cat)}

    <div class="measure-tips">
      <h4>📐 วิธีการวัดขนาดร่างกายที่ถูกต้อง (How to Measure)</h4>
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:16px;margin-top:12px">
        <div>
          <b>1. รอบอก (Chest):</b>
          <p class="muted" style="margin:4px 0 0">ใช้สายวัดทาบผ่านจุดกึ่งกลางหน้าอกและสะบักหลัง ให้สายวัดขนานกับพื้น แนบพอดีไม่รัดแน่น</p>
        </div>
        <div>
          <b>2. ความยาวเสื้อ (Length):</b>
          <p class="muted" style="margin:4px 0 0">วัดจากจุดรอยต่อคอเสื้อด้านบนสุด ตรงลงมาถึงชายเสื้อด้านล่าง</p>
        </div>
        <div>
          <b>3. รอบเอว (Waist):</b>
          <p class="muted" style="margin:4px 0 0">วัดรอบเอวจริงบริเวณเหนือสะดือประมาณ 1 นิ้ว (จุดที่คอดที่สุดของลำตัว)</p>
        </div>
        <div>
          <b>4. รอบสะโพก (Hips):</b>
          <p class="muted" style="margin:4px 0 0">วัดรอบส่วนที่กว้างที่สุดของสะโพก โดยยืนเท้าชิด</p>
        </div>
      </div>
      <p style="margin:16px 0 0;font-size:13px;color:var(--ink-2)">
        💡 <b>คำแนะนำ:</b> หากขนาดตัวอยู่ก้ำกึ่งระหว่าง 2 ไซส์ สำหรับทรงพอดีตัวแนะนำเลือกไซส์เล็ก สำหรับทรงหลวมใส่สบายหรือทรง Oversize แนะนำเลือกไซส์ใหญ่กว่า
      </p>
    </div>
  `;
};

/* ---------- Store Policies & Help Page ---------- */
pages.help = async () => {
  app.innerHTML = `
    <div class="crumbs"><a href="#/">หน้าแรก</a> / ข้อมูลบริการและนโยบาย</div>
    <h2>นโยบายการบริการ &amp; ช่วยเหลือ (Help &amp; Policies)</h2>
    <p class="muted" style="margin-top:-6px;margin-bottom:28px">ข้อมูลการจัดส่ง การเปลี่ยนสินค้า วิธีการดูแลรักษาผ้า และช่องทางติดต่อ</p>

    <div class="policy-card" id="exchange">
      <h3>🔄 นโยบายการเปลี่ยนไซส์สินค้า (Exchange Policy)</h3>
      <p>ร้าน NOIR &amp; CREAM รับประกันความพึงพอใจ หากคุณสั่งซื้อแล้วใส่ไม่พอดี สามารถขอเปลี่ยนไซส์ได้ภายใต้เงื่อนไขดังนี้:</p>
      <ul style="padding-left:20px;color:var(--ink-2);line-height:1.8">
        <li>แจ้งเปลี่ยนไซส์ได้ภายใน <b>7 วัน</b> นับจากวันที่ได้รับพัสดุ</li>
        <li>สินค้าต้องอยู่ในสภาพสมบูรณ์ <b>ยังไม่ผ่านการซัก</b> และ <b>ป้ายสินค้ายังไม่ถูกตัด</b></li>
        <li>สามารถเปลี่ยนเป็นไซส์อื่นในรุ่นเดิม หรือเปลี่ยนเป็นรุ่นอื่นในมูลค่าเท่ากัน/สูงกว่าได้</li>
        <li>ติดต่อขอเปลี่ยนสินค้าได้สะดวกรวดเร็วทาง LINE OA: <b>@noircream</b></li>
      </ul>
    </div>

    <div class="policy-card" id="shipping">
      <h3>🚚 ข้อมูลการจัดส่งพัสดุ (Shipping &amp; Delivery)</h3>
      <ul style="padding-left:20px;color:var(--ink-2);line-height:1.8">
        <li><b>จัดส่งฟรีทั่วประเทศ</b> เมื่อมียอดสั่งซื้อครบ <b>฿1,000</b> ขึ้นไป (ยอดต่ำกว่า คิดค่าจัดส่งตามจริง ฿50)</li>
        <li>จัดส่งผ่านขนส่งเอกชนมาตรฐาน (Flash Express / Kerry Express / EMS) มีเลขติดตามพัสดุเช็กได้ในระบบ</li>
        <li>ระยะเวลาจัดส่ง: กรุงเทพฯ และปริมณฑล <b>1–2 วันทำการ</b>, ต่างจังหวัด <b>2–3 วันทำการ</b></li>
        <li>รอบจัดส่งทุกวันจันทร์ – เสาร์ (ตัดรอบ 12:00 น.)</li>
      </ul>
    </div>

    <div class="policy-card" id="care">
      <h3>🧵 คำแนะนำการดูแลรักษาเนื้อผ้า (Fabric Care Guide)</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:16px;margin-top:12px">
        <div>
          <b>เสื้อยืด &amp; เสื้อแขนยาว Cotton:</b>
          <p class="muted" style="margin:4px 0 0">ซักด้วยน้ำอุณหภูมิปกติ กลับด้านเสื้อก่อนซักและตาก หลีกเลี่ยงการอบผ้าด้วยความร้อนสูงเพื่อป้องกันการหดตัว</p>
        </div>
        <div>
          <b>เสื้อโปโล Pique:</b>
          <p class="muted" style="margin:4px 0 0">จัดทรงคอปกให้ตรงก่อนตาก แขวนด้วยไม้แขวนเสื้อทรงโค้งเพื่อรักษารูปทรงไหล่</p>
        </div>
        <div>
          <b>กางเกง Chino &amp; Denim:</b>
          <p class="muted" style="margin:4px 0 0">กลับด้านซักเพื่อรักษาสีโทนครีมและดำ ตากในที่ร่มมีลมโกรก รีดด้วยไฟปานกลาง</p>
        </div>
      </div>
    </div>

    <div class="policy-card" id="faq">
      <h3>💬 คำถามที่พบบ่อย (FAQ)</h3>
      <details class="faq-item">
        <summary>ร้านจำหน่ายสินค้าประเภทใดบ้าง?</summary>
        <p>เราเน้นคัดสรรเฉพาะ 4 ชิ้นหลักที่ใส่ได้ทุกวัน: <b>เสื้อยืด, เสื้อโปโล, เสื้อแขนยาว และกางเกง</b> โดยคุมโทนสีเฉพาะ ครีม ขาว ดำ เพื่อให้หยิบจับมาแมตช์เข้ากันได้ง่ายที่สุด</p>
      </details>
      <details class="faq-item">
        <summary>มีบริการเก็บเงินปลายทาง (COD) หรือไม่?</summary>
        <p>มีบริการเก็บเงินปลายทาง ลูกค้าสามารถเลือกวิธีชำระเงิน "เก็บเงินปลายทาง" ในหน้าสั่งซื้อได้ทันที</p>
      </details>
      <details class="faq-item">
        <summary>หากต้องการยกเลิกคำสั่งซื้อ ทำได้อย่างไร?</summary>
        <p>หากคำสั่งซื้อยังอยู่ในสถานะ "รอชำระเงิน" คุณสามารถกดยกเลิกในหน้า "คำสั่งซื้อของฉัน" ได้ด้วยตนเองทันที</p>
      </details>
      <details class="faq-item">
        <summary>ติดต่อแอดมินได้อย่างไร?</summary>
        <p>ติดต่อสอบถามหรือแจ้งปัญหาได้ทาง LINE OA: <b>@noircream</b> หรือโทร <b>081-234-5678</b> เวลา 09:00 – 19:00 น.</p>
      </details>
    </div>
  `;
};

/* ---------- Auth & Cart & Checkout Pages ---------- */
pages.login = async () => {
  app.innerHTML = `<div class="auth">
    <div class="auth-head">
      <span class="auth-eyebrow">NOIR &amp; CREAM</span>
      <h2>เข้าสู่ระบบ</h2>
      <p class="muted">กรอกอีเมลและรหัสผ่านเพื่อเข้าใช้งานบัญชีของคุณ</p>
    </div>
    <div class="err" id="err"></div>
    <form onsubmit="return A.login(event)">
      <div class="field"><label for="email">อีเมล</label><input id="email" name="email" type="text" autocomplete="username" required placeholder="name@example.com"></div>
      <div class="field"><label for="pw">รหัสผ่าน</label><input id="pw" name="password" type="password" autocomplete="current-password" required placeholder="••••••••"></div>
      <button class="btn block" style="margin-top:20px">เข้าสู่ระบบ</button>
    </form>
    <div class="auth-foot">ยังไม่มีบัญชี? <a class="link" href="#/register">สมัครสมาชิก</a></div>
  </div>`;
};

pages.register = async () => {
  app.innerHTML = `<div class="auth">
    <div class="auth-head">
      <span class="auth-eyebrow">NOIR &amp; CREAM</span>
      <h2>สมัครสมาชิก</h2>
      <p class="muted">สร้างบัญชีสมาชิกเพื่อสั่งซื้อและติดตามสถานะพัสดุ</p>
    </div>
    <div class="err" id="err"></div>
    <form onsubmit="return A.register(event)">
      <div class="row2">
        <div class="field"><label for="fn">ชื่อ</label><input id="fn" name="first_name" autocomplete="given-name" required maxlength="60"></div>
        <div class="field"><label for="ln">นามสกุล</label><input id="ln" name="last_name" autocomplete="family-name" required maxlength="60"></div>
      </div>
      <div class="field"><label for="em">อีเมล</label><input id="em" name="email" type="email" autocomplete="email" required placeholder="name@example.com"></div>
      <div class="field"><label for="ph">เบอร์โทรศัพท์</label><input id="ph" name="phone" type="tel" autocomplete="tel" placeholder="08x-xxx-xxxx"></div>
      <div class="row2">
        <div class="field"><label for="p1">รหัสผ่าน (อย่างน้อย 8 ตัว)</label><input id="p1" name="password" type="password" minlength="8" autocomplete="new-password" required></div>
        <div class="field"><label for="p2">ยืนยันรหัสผ่าน</label><input id="p2" name="confirm" type="password" minlength="8" autocomplete="new-password" required></div>
      </div>
      <button class="btn block" style="margin-top:20px">สร้างบัญชี</button>
    </form>
    <div class="auth-foot">มีบัญชีแล้ว? <a class="link" href="#/login">เข้าสู่ระบบ</a></div>
  </div>`;
};

const adminTestBanner = () => {
  if (state.user?.role !== 'admin') return '';
  const cid = state.user.shop_customer_id || 1;
  const cname = state.user.shop_customer_name || 'สมชาย ทดสอบ';
  return `
    <div class="panel" style="background:#fcfaf7;border:1px dashed var(--ink-3);padding:12px 16px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
      <div style="font-size:13.5px">
        🧪 <b>โหมดทดลองซื้อสำหรับแอดมิน (Admin Test Mode)</b> · ระบบจำลองการสั่งซื้อผ่านบัญชีลูกค้าทดสอบ <b>#${cid} (${esc(cname)})</b> เพื่อทดสอบตะกร้า ชำระเงิน และตัดสต็อกจริง
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <a class="btn ghost sm" href="#/shop">🛍️ เลือกสินค้าเพิ่ม</a>
        <button type="button" class="btn sm" onclick="adminTab='orders';location.hash='#/admin'">⚙️ ไปจัดการคำสั่งซื้อ (Admin)</button>
      </div>
    </div>
  `;
};

pages.cart = async () => {
  if (!state.user) return go('#/login');
  await loadCart();
  const c = state.cart;
  if (!c.items.length) {
    app.innerHTML = `
      ${adminTestBanner()}
      <div class="empty">
        <div style="font-size:36px;margin-bottom:8px">🛒</div>
        <h3>ตะกร้าของคุณยังว่างอยู่</h3>
        <p class="muted">เลือกซื้อเสื้อยืด เสื้อโปโล เสื้อแขนยาว หรือกางเกง โทนครีม ขาว ดำ ที่คุณชอบ</p>
        <a class="btn" style="margin-top:14px" href="#/shop">ไปเลือกสินค้า</a>
      </div>
    `;
    return;
  }
  const ship = c.subtotal >= state.config.free_shipping_min ? 0 : state.config.shipping_fee;
  const pct = Math.min(100, (c.subtotal / state.config.free_shipping_min) * 100);
  app.innerHTML = `
    ${adminTestBanner()}
    <h2>ตะกร้าสินค้า (${c.count} ชิ้น)</h2>
    <div class="two-col">
      <div class="panel">
        ${c.items.map((i) => `
          <div class="line">
            <a class="thumb" href="#/product/${i.product_id}">${art(i.image_url, i.color_hex)}</a>
            <div>
              <div class="name">${esc(i.name)}</div>
              <div class="opt">สี: ${esc(i.color)} · ไซส์: ${esc(i.size)} <span class="muted" style="font-size:12px">· Cart #${i.cart_id} (PID #${i.product_id} / VID #${i.variant_id})</span></div>
              <div class="qty" style="margin-top:8px">
                <button onclick="A.setQty(${i.cart_id}, ${i.quantity - 1})" aria-label="ลด">−</button>
                <span>${i.quantity}</span>
                <button onclick="A.setQty(${i.cart_id}, ${i.quantity + 1})" aria-label="เพิ่ม">+</button>
              </div>
            </div>
            <div style="text-align:right">
              <div style="font-weight:500">${money(i.price * i.quantity)}</div>
              <button class="link muted" style="font-size:13px;margin-top:6px" onclick="A.removeItem(${i.cart_id})">ลบ</button>
            </div>
          </div>
        `).join('')}
      </div>
      <aside class="panel summary">
        <h3>สรุปคำสั่งซื้อ</h3>
        ${ship ? `
          <div class="muted" style="font-size:13px">ซื้อเพิ่มอีก <b>${money(state.config.free_shipping_min - c.subtotal)}</b> เพื่อส่งฟรี!</div>
        ` : `
          <div style="font-size:13px;color:var(--ok)">🎉 คุณได้รับสิทธิ์ส่งฟรีทั่วประเทศ</div>
        `}
        <div class="progress"><i style="width:${pct}%"></i></div>
        <div class="sum-row"><span>ราคาสินค้า</span><span>${money(c.subtotal)}</span></div>
        <div class="sum-row"><span>ค่าจัดส่ง</span><span>${ship ? money(ship) : 'ฟรี'}</span></div>
        <div class="sum-row total"><span>ยอดรวม</span><span>${money(c.subtotal + ship)}</span></div>
        <a class="btn block" style="margin-top:16px" href="#/checkout">ดำเนินการชำระเงิน</a>
      </aside>
    </div>
  `;
};

pages.checkout = async () => {
  if (!state.user) return go('#/login');
  await loadCart();
  if (!state.cart.items.length) return go('#/cart');
  const { addresses } = await api('GET', '/api/addresses');
  _addrCache = addresses;
  const co = {
    address: (addresses.find((a) => a.is_default) || addresses[0] || {}).address_id,
    method: state.config.pay_methods[0],
    coupon: '',
    discount: 0
  };
  const c = state.cart;
  const ship = c.subtotal >= state.config.free_shipping_min ? 0 : state.config.shipping_fee;

  const sum = () => {
    $('#sum').innerHTML = `
      <div class="sum-row"><span>ราคาสินค้า</span><span>${money(c.subtotal)}</span></div>
      ${co.discount ? `<div class="sum-row"><span>ส่วนลด (${esc(co.coupon)})</span><span>−${money(co.discount)}</span></div>` : ''}
      <div class="sum-row"><span>ค่าจัดส่ง</span><span>${ship ? money(ship) : 'ฟรี'}</span></div>
      <div class="sum-row total"><span>ยอดชำระ</span><span>${money(c.subtotal - co.discount + ship)}</span></div>
    `;
  };

  A.coState = co;
  A.pickAddr = (id) => {
    co.address = id;
    document.querySelectorAll('[data-addr]').forEach((e) => e.classList.toggle('on', +e.dataset.addr === id));
  };
  A.pickPay = (m) => {
    co.method = m;
    document.querySelectorAll('[data-pay]').forEach((e) => e.classList.toggle('on', e.dataset.pay === m));
  };
  A.applyCoupon = () => safe(async () => {
    const code = $('#coupon').value.trim();
    if (!code) { co.coupon = ''; co.discount = 0; return sum(); }
    const r = await api('POST', '/api/coupon/check', { code });
    co.coupon = r.code; co.discount = r.discount; sum(); toast('ใช้โค้ดส่วนลดแล้ว');
  });
  A.placeOrder = () => safe(async () => {
    if (!co.address) return toast('กรุณาเพิ่มและเลือกที่อยู่จัดส่ง', true);
    const r = await api('POST', '/api/orders', { address_id: co.address, method: co.method, coupon_code: co.coupon });
    await loadCart(); toast('สั่งซื้อสำเร็จ'); go('#/orders?new=' + r.order_id);
  });

  app.innerHTML = `
    ${adminTestBanner()}
    <h2>ชำระเงิน</h2>
    <div class="two-col">
      <div>
        <div class="panel">
          <h3>ที่อยู่จัดส่ง</h3>
          ${addresses.map((a) => `
            <label class="opt-card ${a.address_id === co.address ? 'on' : ''}" data-addr="${a.address_id}">
              <input type="radio" name="addr" ${a.address_id === co.address ? 'checked' : ''} onchange="A.pickAddr(${a.address_id})">
              <div style="flex:1"><b>${esc(a.recipient)}</b> · ${esc(a.phone)}<br><span class="muted">${esc(fmtAddr(a))}</span></div>
              <button type="button" class="btn ghost sm" style="flex:0 0 auto" onclick="event.preventDefault();event.stopPropagation();A.openEditAddress(${a.address_id})">✏️ แก้ไข</button>
            </label>
          `).join('')}
          ${addresses.length ? '' : '<p class="muted">ยังไม่มีที่อยู่จัดส่ง กรุณาเพิ่มที่อยู่ด้านล่าง</p>'}
          <details ${addresses.length ? '' : 'open'}><summary class="link">+ เพิ่มที่อยู่ใหม่</summary><div style="margin-top:14px">${addressForm('A.addAddress(event, true)')}</div></details>
        </div>

        <div class="panel">
          <h3>วิธีชำระเงิน</h3>
          ${state.config.pay_methods.map((m) => `
            <label class="opt-card ${m === co.method ? 'on' : ''}" data-pay="${esc(m)}">
              <input type="radio" name="pay" ${m === co.method ? 'checked' : ''} onchange="A.pickPay(this.parentElement.dataset.pay)">
              <div><b>${esc(m)}</b></div>
            </label>
          `).join('')}
          <p class="muted" style="font-size:13px;margin:6px 0 0">* จำลองระบบชำระเงิน (ยังไม่มีการตัดเงินจริง)</p>
        </div>
      </div>

      <aside class="panel summary">
        <h3>สรุปคำสั่งซื้อ</h3>
        ${c.items.map((i) => `
          <div class="sum-row" style="font-size:14px">
            <span>${esc(i.name)} <span class="muted">(${esc(i.color)}/${esc(i.size)}) ×${i.quantity}</span></span>
            <span>${money(i.price * i.quantity)}</span>
          </div>
        `).join('')}
        <div class="coupon">
          <input id="coupon" placeholder="โค้ดส่วนลด เช่น WELCOME10" aria-label="โค้ดส่วนลด">
          <button class="btn ghost sm" onclick="A.applyCoupon()">ใช้โค้ด</button>
        </div>
        <div id="sum"></div>
        <button class="btn block" style="margin-top:16px" onclick="A.placeOrder()">ยืนยันสั่งซื้อ</button>
      </aside>
    </div>
  `;
  sum();
};

let _addrCache = [];
const fmtAddr = (a) => [a.house_no, a.village, a.road, 'ต.' + a.subdistrict, 'อ./เขต ' + a.district, 'จ.' + a.province, a.postal_code].filter(Boolean).join(' ');
function addressForm(handler, v = {}, btnLabel = 'บันทึกที่อยู่', showCancel = false) {
  const f = (n, l, extra = '') => `<div class="field"><label>${l}</label><input name="${n}" value="${esc(v[n] || '')}" ${extra}></div>`;
  return `<form onsubmit="return ${handler}">
    <div class="row2">${f('recipient', 'ชื่อผู้รับ', 'required')}${f('phone', 'เบอร์โทรศัพท์', 'required type="tel"')}</div>
    <div class="row3">${f('house_no', 'บ้านเลขที่', 'required')}${f('village', 'หมู่บ้าน/หมู่ที่')}${f('road', 'ถนน')}</div>
    <div class="row3">${f('subdistrict', 'ตำบล/แขวง', 'required')}${f('district', 'อำเภอ/เขต', 'required')}${f('province', 'จังหวัด', 'required')}</div>
    <div class="row2">${f('postal_code', 'รหัสไปรษณีย์', 'required inputmode="numeric" maxlength="5" pattern="[0-9]{5}"')}
      <label style="display:flex;gap:8px;align-items:center;margin-top:24px"><input type="checkbox" name="is_default" style="width:auto" ${v.is_default ? 'checked' : ''}> ตั้งเป็นที่อยู่หลัก</label></div>
    <div class="actions" style="justify-content:${showCancel ? 'flex-end' : 'flex-start'};margin-top:6px">
      ${showCancel ? '<button type="button" class="btn ghost sm" onclick="A.closeModal()">ยกเลิก</button>' : ''}
      <button class="btn sm">${esc(btnLabel)}</button>
    </div>
  </form>`;
}

pages.orders = async (params) => {
  if (!state.user) return go('#/login');
  const { orders } = await api('GET', '/api/orders');
  const fresh = +params.get('new') || 0;
  app.innerHTML = `
    ${adminTestBanner()}
    <h2>${state.user.role === 'admin' ? 'คำสั่งซื้อ (โหมดทดลองซื้อ)' : 'คำสั่งซื้อของฉัน'}</h2>
    ${fresh ? `<div class="panel" style="background:var(--ink);color:var(--cream);margin-bottom:18px">🎉 ขอบคุณที่สั่งซื้อ! คำสั่งซื้อ #${fresh} ได้รับการบันทึกเรียบร้อยแล้ว</div>` : ''}
    ${orders.length ? orders.map(orderCard).join('') : '<div class="empty"><h3>ยังไม่มีคำสั่งซื้อ</h3><a class="btn" style="margin-top:12px" href="#/shop">เริ่มเลือกชมสินค้า</a></div>'}
  `;
};

function orderItems(o) {
  return o.items.map((i) => `
    <div class="line">
      <a class="thumb" href="#/product/${i.product_id}">${art(i.image_url, i.color_hex)}</a>
      <div><div class="name">${esc(i.name)}</div><div class="opt">${esc(i.color)} · ${esc(i.size)} × ${i.quantity} <span class="muted" style="font-size:12px">· Item #${i.order_item_id} (PID #${i.product_id}${i.variant_id ? ` / VID #${i.variant_id}` : ''})</span></div></div>
      <div>${money(i.unit_price * i.quantity)}</div>
    </div>
  `).join('');
}

function shipInfo(o) {
  if (!o.shipment) return '';
  return `<div class="ship-box">🚚 Shipment #${o.shipment.shipment_id} · ${esc(o.shipment.carrier)} · หมายเลขพัสดุ (PK) <b>${esc(o.shipment.tracking_no)}</b> · ${SHIP_STATUS[o.shipment.status] || esc(o.shipment.status)} · วันที่ส่ง ${dt(o.shipment.shipped_at)} <span class="muted" style="font-size:12px">(Payment #${o.shipment.payment_id})</span></div>`;
}

function orderCard(o) {
  const cod = o.payment.method === 'เก็บเงินปลายทาง';
  return `
    <div class="panel order">
      <div class="order-head">
        <div><b>คำสั่งซื้อ #${o.order_id}</b> <span class="muted">· ลูกค้า #${o.customer_id} · ${dt(o.order_date)}</span></div>
        <span class="status ${o.status}">${STATUS[o.status]}</span>
      </div>
      ${orderItems(o)}
      <div class="muted" style="font-size:13.5px">จัดส่งถึง: ${esc(o.ship_name)} · ${esc(o.ship_phone)}<br>${esc(o.ship_address)}</div>
      <div class="muted" style="font-size:13.5px;margin-top:6px">ชำระเงิน (Payment #${o.payment.payment_id}): ${esc(o.payment.method)} (${PAY_STATUS[o.payment.status] || esc(o.payment.status)}${o.payment.paid_at ? ' · ' + dt(o.payment.paid_at) : ''})</div>
      ${shipInfo(o)}
      <div class="order-foot">
        <div>ยอดรวม <b style="font-size:18px">${money(o.total_price)}</b>${o.discount ? ` <span class="muted">(ส่วนลด ${money(o.discount)})</span>` : ''}</div>
        <div class="actions">
          ${o.status === 'pending' && !cod ? `<button class="btn sm" onclick="A.payOrder(${o.order_id})">ชำระเงิน (จำลอง)</button>` : ''}
          ${o.status === 'pending' ? `<button class="btn danger sm" onclick="A.cancelOrder(${o.order_id})">ยกเลิก</button>` : ''}
          ${o.status === 'shipped' ? `<button class="btn sm" onclick="A.received(${o.order_id})">ได้รับสินค้าแล้ว</button>` : ''}
          ${['paid', 'shipped', 'completed'].includes(o.status) ? `<a class="btn ghost sm" href="#/product/${o.items[0].product_id}">เขียนรีวิว</a>` : ''}
          ${state.user?.role === 'admin' ? `<button type="button" class="btn ghost sm" onclick="adminTab='orders';location.hash='#/admin'">⚙️ จัดการใน Admin</button>` : ''}
        </div>
      </div>
    </div>
  `;
}

pages.wishlist = async () => {
  if (!state.user) return go('#/login');
  const { products } = await api('GET', '/api/wishlist');
  app.innerHTML = `${adminTestBanner()}<h2>รายการโปรด</h2>${products.length ? `<div class="grid">${products.map(card).join('')}</div>` : '<div class="empty"><h3>ยังไม่มีสินค้าที่ถูกใจ</h3><a class="btn" href="#/shop">ไปเลือกสินค้า</a></div>'}`;
};

pages.account = async () => {
  if (!state.user) return go('#/login');
  const u = state.user;
  const { addresses } = await api('GET', '/api/addresses');
  _addrCache = addresses;
  if (u.role === 'admin') {
    app.innerHTML = `
      <h2>บัญชีผู้ดูแลระบบ <span class="muted" style="font-size:16px;font-weight:400">(Admin_ID: #${u.id})</span></h2>
      <div class="panel">
        <p style="margin-top:0">
          <span class="muted">รหัสแอดมิน (admin_id): <b>#${u.id}</b></span><br>
          <b>${esc(u.name)}</b><br>
          ${esc(u.email)}<br>
          ${esc(u.phone || '')}
        </p>
        <div class="actions">
          <a class="btn sm" href="#/admin">⚙️ ไปหน้าจัดการร้าน</a>
          <a class="btn ghost sm" href="#/shop">🛍️ ทดลองเลือกซื้อสินค้า</a>
          <a class="btn ghost sm" href="#/orders">📦 ดูคำสั่งซื้อที่ทดลองสั่ง</a>
        </div>
      </div>
      <div class="panel">
        <h3>ที่อยู่จัดส่ง (สำหรับโหมดทดลองซื้อ · ลูกค้าทดสอบ #${u.shop_customer_id || 1})</h3>
        ${addresses.map((a) => `
          <div class="opt-card" style="cursor:default">
            <div style="flex:1"><span class="muted" style="font-size:12px">#${a.address_id} · </span><b>${esc(a.recipient)}</b> · ${esc(a.phone)} ${a.is_default ? '<span class="status completed" style="margin-left:6px">ที่อยู่หลัก</span>' : ''}<br><span class="muted">${esc(fmtAddr(a))}</span></div>
            <div class="actions">
              ${a.is_default ? '' : `<button type="button" class="btn ghost sm" onclick="A.defAddr(${a.address_id})">ตั้งเป็นหลัก</button>`}
              <button type="button" class="btn ghost sm" onclick="A.openEditAddress(${a.address_id})">✏️ แก้ไข</button>
              <button type="button" class="btn danger sm" onclick="A.delAddr(${a.address_id})">ลบ</button>
            </div>
          </div>
        `).join('') || '<p class="muted">ยังไม่มีที่อยู่จัดส่ง</p>'}
        <details><summary class="link">+ เพิ่มที่อยู่ใหม่</summary><div style="margin-top:14px">${addressForm('A.addAddress(event, false)')}</div></details>
      </div>
    `;
    return;
  }
  app.innerHTML = `
    <h2>บัญชีของฉัน <span class="muted" style="font-size:16px;font-weight:400">(Customer_ID: #${u.id})</span></h2>
    <div class="panel">
      <h3>ข้อมูลส่วนตัว</h3>
      <form onsubmit="return A.saveProfile(event)">
        <div class="row2">
          <div class="field"><label>ชื่อ</label><input name="first_name" value="${esc(u.first_name)}" required></div>
          <div class="field"><label>นามสกุล</label><input name="last_name" value="${esc(u.last_name)}" required></div>
        </div>
        <div class="row2">
          <div class="field"><label>อีเมล</label><input value="${esc(u.email)}" disabled></div>
          <div class="field"><label>เบอร์โทรศัพท์</label><input name="phone" value="${esc(u.phone || '')}"></div>
        </div>
        <button class="btn sm">บันทึกข้อมูล</button>
      </form>
    </div>
    <div class="panel">
      <h3>ที่อยู่จัดส่ง</h3>
      ${addresses.map((a) => `
        <div class="opt-card" style="cursor:default">
          <div style="flex:1"><span class="muted" style="font-size:12px">#${a.address_id} · </span><b>${esc(a.recipient)}</b> · ${esc(a.phone)} ${a.is_default ? '<span class="status completed" style="margin-left:6px">ที่อยู่หลัก</span>' : ''}<br><span class="muted">${esc(fmtAddr(a))}</span></div>
          <div class="actions">
            ${a.is_default ? '' : `<button type="button" class="btn ghost sm" onclick="A.defAddr(${a.address_id})">ตั้งเป็นหลัก</button>`}
            <button type="button" class="btn ghost sm" onclick="A.openEditAddress(${a.address_id})">✏️ แก้ไข</button>
            <button type="button" class="btn danger sm" onclick="A.delAddr(${a.address_id})">ลบ</button>
          </div>
        </div>
      `).join('') || '<p class="muted">ยังไม่มีที่อยู่จัดส่ง</p>'}
      <details><summary class="link">+ เพิ่มที่อยู่ใหม่</summary><div style="margin-top:14px">${addressForm('A.addAddress(event, false)')}</div></details>
    </div>
    <div class="panel">
      <h3>เปลี่ยนรหัสผ่าน</h3>
      <form onsubmit="return A.changePw(event)">
        <div class="row2">
          <div class="field"><label>รหัสผ่านเดิม</label><input name="old_password" type="password" autocomplete="current-password" required></div>
          <div class="field"><label>รหัสผ่านใหม่ (8 ตัวขึ้นไป)</label><input name="new_password" type="password" minlength="8" autocomplete="new-password" required></div>
        </div>
        <button class="btn sm">เปลี่ยนรหัสผ่าน</button>
      </form>
    </div>
  `;
};

/* ---------- Admin Panel (พร้อมระบบเพิ่มสินค้าและไซส์แบบด่วน & SQL Server Realtime) ---------- */
let adminTab = 'dash';
let activeSqlTable = 'product';
let lastSqlSnapshot = null;

pages.sql = async () => {
  if (state.user?.role !== 'admin') { go('#/login'); return; }
  adminTab = 'sql';
  go('#/admin');
};

pages.admin = async () => {
  if (state.user?.role !== 'admin') { go('#/login'); return; }
  if (adminTab === 'sql') adminTab = 'dash';
  const tabs = [
    ['dash', '📊 ภาพรวม'],
    ['products', '📦 สินค้า/สต็อก'],
    ['orders', '📑 คำสั่งซื้อ'],
    ['customers', '👥 ลูกค้า'],
    ['suppliers', '🏭 ซัพพลายเออร์/พนักงาน']
  ];
  app.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px">
      <h2 style="margin:0">ระบบจัดการร้านค้า (Admin)</h2>
    </div>
    <div class="tabs">${tabs.map(([k, l]) => `<button class="tab ${k === adminTab ? 'on' : ''}" onclick="A.tab('${k}')">${l}</button>`).join('')}</div>
    <div id="tab"></div>
  `;

  await adminTabs[adminTab]();
};

const _adminCache = { customers: [], admins: [], suppliers: [], employees: [], coupons: [] };
const adminTabs = {};

adminTabs.dash = async () => {
  const [s, couponRes] = await Promise.all([
    api('GET', '/api/admin/stats'),
    api('GET', '/api/admin/coupons').catch(() => ({ coupons: [] }))
  ]);
  const coupons = couponRes.coupons || [];
  _adminCache.coupons = coupons;
  $('#tab').innerHTML = `
    <div class="stats">
      <div class="stat"><small>รายได้ (ชำระแล้ว)</small><b data-count="${s.revenue}" data-money="1">${money(s.revenue)}</b></div>
      <div class="stat"><small>คำสั่งซื้อทั้งหมด</small><b data-count="${s.orders}">${s.orders}</b></div>
      <div class="stat"><small>รอดำเนินการ</small><b data-count="${s.pending}">${s.pending}</b></div>
      <div class="stat"><small>สมาชิกทั้งหมด</small><b data-count="${s.customers}">${s.customers}</b></div>
      <div class="stat"><small>สินค้าที่วางขาย</small><b data-count="${s.products}">${s.products}</b></div>
    </div>
    <div class="panel">
      <h3>สินค้าใกล้หมด (≤ 3 ชิ้น)</h3>
      ${s.low_stock.length ? `
        <div class="table-wrap">
          <table>
            <tr><th>สินค้า</th><th>สี</th><th>ไซซ์</th><th>คงเหลือ</th></tr>
            ${s.low_stock.map((v) => `<tr><td>${esc(v.name)}</td><td>${esc(v.color)}</td><td>${esc(v.size)}</td><td><b style="color:var(--danger)">${v.stock}</b></td></tr>`).join('')}
          </table>
        </div>
      ` : '<p class="muted">ไม่มีสินค้าใกล้หมด</p>'}
    </div>
    <div class="panel">
      <h3>🎟️ จัดการคูปองส่วนลด</h3>
      <div class="table-wrap">
        <table>
          <tr><th>โค้ดส่วนลด</th><th>ประเภท</th><th>มูลค่าส่วนลด</th><th>ยอดสั่งซื้อขั้นต่ำ</th><th>สถานะ</th><th>การจัดการ</th></tr>
          ${coupons.length ? coupons.map((c) => `
            <tr>
              <td><b><code>${esc(c.code)}</code></b></td>
              <td>${c.type === 'percent' ? 'เปอร์เซ็นต์ (%)' : 'ลดจำนวนเงิน (฿)'}</td>
              <td><b>${c.type === 'percent' ? `${Number(c.value)}%` : money(c.value)}</b></td>
              <td>${Number(c.min_total || 0) > 0 ? money(c.min_total) : 'ไม่มีขั้นต่ำ'}</td>
              <td><span class="status ${c.active ? 'paid' : 'cancelled'}">${c.active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</span></td>
              <td class="actions" style="white-space:nowrap">
                <button type="button" class="btn ghost sm" onclick="A.openEditCoupon(${JSON.stringify(c.code).replace(/"/g, '&quot;')})">✏️ แก้ไข</button>
                <button type="button" class="btn danger sm" onclick="A.deleteCoupon(${JSON.stringify(c.code).replace(/"/g, '&quot;')})">ลบ</button>
              </td>
            </tr>
          `).join('') : '<tr><td colspan="6" class="muted" style="text-align:center;padding:18px">ยังไม่มีคูปองส่วนลด</td></tr>'}
        </table>
      </div>
      <form class="inline-form" onsubmit="return A.addCoupon(event)">
        <input name="code" placeholder="รหัสคูปอง เช่น SALE20" style="text-transform:uppercase" required>
        <select name="type">
          <option value="percent">ลดเป็น %</option>
          <option value="fixed">ลดเป็นบาท (฿)</option>
        </select>
        <input name="value" type="number" min="1" step="1" placeholder="มูลค่าส่วนลด" required>
        <input name="min_total" type="number" min="0" step="1" placeholder="ยอดขั้นต่ำ (฿)" value="0">
        <select name="active">
          <option value="1">เปิดใช้งาน</option>
          <option value="0">ปิดใช้งาน</option>
        </select>
        <button class="btn sm">+ เพิ่มคูปอง</button>
      </form>
    </div>
  `;
  animateCounters();
};

adminTabs.products = async () => {
  const { products, suppliers, employees = [], allowed_categories } = await api('GET', '/api/admin/products');
  const cats = allowed_categories || ['เสื้อยืด', 'เสื้อโปโล', 'เสื้อแขนยาว', 'กางเกง'];
  const supOpts = (cur) => '<option value="">— ไม่ระบุ —</option>' + suppliers.map((s) => `<option value="${s.supplier_id}" ${s.supplier_id === cur ? 'selected' : ''}>#${s.supplier_id} ${esc(s.name)}</option>`).join('');
  const empOpts = (cur) => '<option value="">— ไม่ระบุ —</option>' + employees.map((e) => `<option value="${e.employee_id}" ${e.employee_id === cur ? 'selected' : ''}>#${e.employee_id} ${esc(e.first_name)} ${esc(e.last_name)}${e.position ? ` (${esc(e.position)})` : ''}</option>`).join('');

  $('#tab').innerHTML = `
    <details class="prod" style="margin-bottom:20px" open>
      <summary style="font-size:16px;background:var(--cream);font-weight:500">
        <span><b>+ เพิ่มสินค้าใหม่พร้อมไซส์และสต็อก</b> (จำหน่ายเฉพาะ 4 หมวดหมู่)</span>
      </summary>
      <div class="inner" style="padding-top:16px">
        <form onsubmit="return A.saveProductWithVariants(event)">
          <div class="row2">
            <div class="field">
              <label>หมวดหมู่สินค้า *</label>
              <select name="category" id="newProdCat" onchange="A.onCatChange(this.value)">
                ${cats.map((c) => `<option value="${c}">${c}</option>`).join('')}
              </select>
            </div>
            <div class="field"><label>ชื่อสินค้า *</label><input name="name" placeholder="เช่น เสื้อยืด Heavy Cotton" required></div>
          </div>
          <div class="field"><label>รายละเอียดสินค้า</label><textarea name="description" rows="2" placeholder="อธิบายเนื้อผ้า ทรงเสื้อ หรือคุณสมบัติเด่น..."></textarea></div>
          <div class="row4">
            <div class="field">
              <label>รูปภาพ (ลิงก์ URL หรือรูปวาด)</label>
              <input name="image_url" id="newProdImg" value="shape:tee" placeholder="shape:tee หรือ https://...">
            </div>
            <div class="field"><label>ซัพพลายเออร์ (จัดหาสินค้า)</label><select name="supplier_id">${supOpts(null)}</select></div>
            <div class="field"><label>พนักงานผู้ดูแลสินค้า (Employee)</label><select name="employee_id">${empOpts(employees[0]?.employee_id || null)}</select></div>
            <div class="field"><label>สถานะ</label><select name="status"><option value="active">วางขาย</option><option value="inactive">ซ่อน</option></select></div>
          </div>
          <label style="display:flex;gap:8px;align-items:center;margin:8px 0 16px"><input type="checkbox" name="is_featured" style="width:auto" checked> แสดงเป็นสินค้าแนะนำที่หน้าแรก</label>

          <!-- Quick Variant Generator -->
          <div class="batch-box">
            <b>⚡ สร้างรูปแบบ ไซส์ และสต็อกตั้งต้นพร้อมกัน:</b>
            <div class="row3" style="margin-top:10px">
              <div class="field"><label>ชื่อสี</label><input name="batch_color" value="ครีม" placeholder="เช่น ครีม, ดำ, ขาว" required></div>
              <div class="field"><label>โค้ดสี</label><input name="batch_color_hex" type="color" value="#EADFC8" style="padding:2px;height:42px" aria-label="เลือกสี"></div>
              <div class="field"><label>ราคาต่อชิ้น (บาท)</label><input name="batch_price" type="number" min="1" value="390" required></div>
            </div>
            <div class="field">
              <label>เลือกไซส์และจำนวนสต็อกต่อไซส์:</label>
              <div id="sizeCheckboxes" class="size-checks"></div>
              <div style="display:flex;gap:12px;align-items:center;margin-top:8px">
                <span class="muted" style="font-size:13px">สต็อกเริ่มต้นต่อไซส์:</span>
                <input name="batch_stock" type="number" min="0" value="10" style="width:100px;padding:6px 10px">
                <button type="button" class="btn ghost sm" onclick="A.selectAllSizes(true)">เลือกไซส์ทั้งหมด</button>
              </div>
            </div>
          </div>

          <button class="btn block" style="margin-top:14px">บันทึกและสร้างสินค้าพร้อมสต็อก</button>
        </form>
      </div>
    </details>

    <div class="section-head" style="margin:24px 0 12px">
      <h3>รายการสินค้าในร้าน (${products.length} รายการ)</h3>
    </div>

    ${products.length ? products.map((p) => `
      <details class="prod">
        <summary>
          <span><b>#${p.product_id} ${esc(p.name)}</b> <span class="muted">· ${esc(p.category)} · สต็อกรวม ${p.stock} ชิ้น${p.supplier_name ? ` · ซัพพลายเออร์: #${p.supplier_id} ${esc(p.supplier_name)}` : ''}${p.employee_name ? ` · ผู้ดูแล: #${p.employee_id} ${esc(p.employee_name)}` : ''}</span></span>
          <span class="status ${p.status === 'active' ? 'paid' : 'cancelled'}">${p.status === 'active' ? 'วางขาย' : 'ซ่อน'}</span>
        </summary>
        <div class="inner">
          <div style="display:flex;justify-content:space-between;align-items:center;margin:12px 0">
            <h4 style="margin:0">รูปแบบ ไซส์ และสต็อก (Product_ID: #${p.product_id})</h4>
            <button class="btn danger sm" onclick="A.deleteProduct(${p.product_id})">🗑️ ลบสินค้านี้</button>
          </div>
          ${p.variants && p.variants.length ? `
            <div class="table-wrap">
              <table>
                <tr><th># (Variant_ID)</th><th>สี</th><th>ไซซ์</th><th>ราคา</th><th>สต็อก</th><th>การจัดการ</th></tr>
                ${p.variants.map((v) => `
                  <tr>
                    <td><b>#${v.variant_id}</b></td>
                    <td><span class="dot" style="background:${esc(v.color_hex)}"></span>${esc(v.color)}</td>
                    <td><b>${esc(v.size)}</b></td>
                    <td><input class="mini-in" type="number" min="1" id="vp${v.variant_id}" value="${v.price}"></td>
                    <td><input class="mini-in" type="number" min="0" id="vs${v.variant_id}" value="${v.stock}"></td>
                    <td class="actions">
                      <button class="btn ghost sm" onclick="A.saveVariant(${v.variant_id})">บันทึก</button>
                      <button class="btn danger sm" onclick="A.delVariant(${v.variant_id})">ลบ</button>
                    </td>
                  </tr>
                `).join('')}
              </table>
            </div>
          ` : '<p class="muted">ยังไม่มีรูปแบบไซส์/สี (กรุณาเพิ่มด้านล่าง)</p>'}

          <!-- Batch Add Sizes for existing product -->
          <div class="batch-box" style="margin:16px 0 12px;background:var(--cream);border:1px solid var(--line);border-radius:var(--radius);padding:16px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
              <b>⚡ เพิ่มหลายไซส์พร้อมกัน (Batch Add Sizes):</b>
              <span class="muted" style="font-size:12.5px">หมวดหมู่: ${esc(p.category)}</span>
            </div>
            <form onsubmit="return A.addBatchVariants(event, ${p.product_id})">
              <div class="row4">
                <div class="field"><label>ชื่อสี *</label><input name="color" placeholder="เช่น ดำ, ขาว, ครีม" required></div>
                <div class="field"><label>โค้ดสี</label><input name="color_hex" type="color" value="#141414" style="padding:2px;height:42px" aria-label="เลือกสี"></div>
                <div class="field"><label>ราคาต่อชิ้น (฿) *</label><input name="price" type="number" min="1" placeholder="เช่น 390" required></div>
                <div class="field"><label>สต็อกต่อไซส์ *</label><input name="stock" type="number" min="0" value="10" placeholder="เช่น 10" required></div>
              </div>
              <div class="field" style="margin-top:6px">
                <label>เลือกไซส์ที่ต้องการเพิ่ม:</label>
                <div class="size-checks">
                  ${(p.category === 'กางเกง' ? ['28', '30', '32', '34', '36'] : ['S', 'M', 'L', 'XL', '2XL']).map((sz, idx) => `
                    <label class="size-check-label">
                      <input type="checkbox" name="sizes" value="${sz}" ${idx < 4 ? 'checked' : ''}>
                      <span>${sz}</span>
                    </label>
                  `).join('')}
                </div>
              </div>
              <div style="display:flex;gap:10px;align-items:center;margin-top:12px;flex-wrap:wrap">
                <button class="btn sm" style="background:var(--ink);color:var(--cream)">+ เพิ่มทุกไซส์ที่เลือกพร้อมกัน</button>
                <button type="button" class="btn ghost sm" onclick="A.toggleFormSizes(this.form, true)">เลือกทั้งหมด</button>
                <button type="button" class="btn ghost sm" onclick="A.toggleFormSizes(this.form, false)">ยกเลิกทั้งหมด</button>
              </div>
            </form>
          </div>

          <details style="margin:10px 0 16px">
            <summary class="link muted" style="font-size:13px;cursor:pointer">+ หรือเพิ่มรูปแบบเดี่ยวทีละ 1 ไซส์</summary>
            <form class="inline-form" style="margin-top:10px" onsubmit="return A.addVariant(event, ${p.product_id})">
              <input name="color" placeholder="สี เช่น ดำ" required>
              <input name="color_hex" type="color" value="#141414" style="padding:2px;height:42px;max-width:60px" aria-label="สี">
              <input name="size" placeholder="ไซซ์ เช่น L" required>
              <input name="price" type="number" min="1" placeholder="ราคา" required>
              <input name="stock" type="number" min="0" placeholder="สต็อก" required>
              <button class="btn sm">+ เพิ่มรูปแบบเดี่ยว</button>
            </form>
          </details>

          <h4 style="margin-top:22px">แก้ไขข้อมูลสินค้า</h4>
          <form onsubmit="return A.saveProduct(event, ${p.product_id})">
            <div class="row2">
              <div class="field"><label>ชื่อสินค้า</label><input name="name" value="${esc(p.name)}" required></div>
              <div class="field">
                <label>หมวดหมู่</label>
                <select name="category">
                  ${cats.map((c) => `<option value="${c}" ${c === p.category ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="field"><label>รายละเอียด</label><textarea name="description" rows="2">${esc(p.description)}</textarea></div>
            <div class="row4">
              <div class="field"><label>รูปภาพ</label><input name="image_url" value="${esc(p.image_url)}"></div>
              <div class="field"><label>ซัพพลายเออร์ (จัดหาสินค้า)</label><select name="supplier_id">${supOpts(p.supplier_id)}</select></div>
              <div class="field"><label>พนักงานผู้ดูแลสินค้า (Employee)</label><select name="employee_id">${empOpts(p.employee_id)}</select></div>
              <div class="field"><label>สถานะ</label><select name="status"><option value="active">วางขาย</option><option value="inactive" ${p.status === 'inactive' ? 'selected' : ''}>ซ่อน</option></select></div>
            </div>
            <label style="display:flex;gap:8px;align-items:center;margin-bottom:12px"><input type="checkbox" name="is_featured" style="width:auto" ${p.is_featured ? 'checked' : ''}> แสดงเป็นสินค้าแนะนำที่หน้าแรก</label>
            <button class="btn sm">บันทึกการแก้ไข</button>
          </form>
        </div>
      </details>
    `).join('') : '<div class="empty"><h3>ยังไม่มีสินค้าในสต็อก</h3><p class="muted">คุณสามารถใช้ฟอร์ม "+ เพิ่มสินค้าใหม่พร้อมไซส์และสต็อก" ด้านบนเพื่อเริ่มลงสินค้าได้เลย</p></div>'}
  `;
  A.onCatChange($('#newProdCat')?.value || 'เสื้อยืด');
};

adminTabs.orders = async () => {
  const { orders } = await api('GET', '/api/admin/orders');
  $('#tab').innerHTML = orders.length ? `
    <datalist id="carrier-presets">
      <option value="Flash Express">
      <option value="Kerry Express">
      <option value="J&T Express">
      <option value="ไปรษณีย์ไทย (EMS)">
    </datalist>
    ${orders.map((o) => {
    const cod = o.payment.method === 'เก็บเงินปลายทาง';
    const canShip = o.status === 'paid' || (o.status === 'pending' && cod);
    const defaultTrack = A.genTrackingNo('Flash Express', o.order_id);
    return `
      <div class="panel order">
        <div class="order-head">
          <div><b>Order #${o.order_id}</b> · ลูกค้า #${o.customer_id} (${esc(o.customer)}) <span class="muted">· ${dt(o.order_date)}</span></div>
          <span class="status ${o.status}">${STATUS[o.status]}</span>
        </div>
        ${o.items.map((i) => `
          <div style="display:flex;justify-content:space-between;padding:4px 0">
            <span><span class="muted" style="font-size:12px">[Item #${i.order_item_id} · PID #${i.product_id}${i.variant_id ? ` · VID #${i.variant_id}` : ''}]</span> ${esc(i.name)} <span class="muted">(${esc(i.color)}/${esc(i.size)}) ×${i.quantity}</span></span>
            <span>${money(i.unit_price * i.quantity)}</span>
          </div>
        `).join('')}
        <div class="muted" style="font-size:13.5px;margin-top:8px">
          ส่งถึง: ${esc(o.ship_name)} ${esc(o.ship_phone)} · ${esc(o.ship_address)}<br>
          ชำระ (Payment #${o.payment.payment_id}): ${esc(o.payment.method)} (${PAY_STATUS[o.payment.status] || ''}) · ยอดรวม <b>${money(o.total_price)}</b>
        </div>
        ${shipInfo(o)}
        ${canShip ? `
          <form class="inline-form" onsubmit="return A.ship(event, ${o.order_id})">
            <input name="carrier" id="ship-carrier-${o.order_id}" list="carrier-presets" value="Flash Express" placeholder="ขนส่ง เช่น Flash Express, Kerry" required>
            <input name="tracking_no" id="ship-track-${o.order_id}" value="${esc(defaultTrack)}" placeholder="เลขพัสดุ (ระบบสุ่มให้ หรือพิมพ์แก้เองได้)">
            <button type="button" class="btn ghost sm" style="flex:0 0 auto" onclick="A.fillTracking(${o.order_id})">🎲 สุ่มใหม่</button>
            <button class="btn sm" style="flex:0 0 auto">บันทึกการจัดส่ง</button>
          </form>
        ` : ''}
        ${o.status === 'shipped' && o.shipment ? `
          <form id="edit-ship-form-${o.order_id}" class="inline-form" style="display:none" onsubmit="return A.updateShipment(event, ${o.order_id})">
            <input name="carrier" id="edit-carrier-${o.order_id}" list="carrier-presets" value="${esc(o.shipment.carrier || 'Flash Express')}" placeholder="ผู้ให้บริการขนส่ง" required>
            <input name="tracking_no" id="edit-track-${o.order_id}" value="${esc(o.shipment.tracking_no || '')}" placeholder="หมายเลขพัสดุ" required>
            <button type="button" class="btn ghost sm" style="flex:0 0 auto" onclick="A.fillTracking(${o.order_id}, true)">🎲 สุ่มใหม่</button>
            <button class="btn sm" style="flex:0 0 auto">บันทึกการแก้ไข</button>
          </form>
        ` : ''}
        <div class="actions" style="margin-top:10px">
          ${o.status === 'pending' && !cod ? `<button class="btn sm" onclick="A.payOrder(${o.order_id})">💳 จำลองชำระเงิน</button>` : ''}
          ${o.status === 'shipped' ? `<button class="btn sm" onclick="A.adminComplete(${o.order_id})">ยืนยันส่งถึงแล้ว</button>` : ''}
          ${o.status === 'shipped' && o.shipment ? `<button class="btn ghost sm" onclick="A.toggleEditShip(${o.order_id})">✏️ แก้เลขพัสดุ</button>` : ''}
          ${['pending', 'paid'].includes(o.status) ? `<button class="btn danger sm" onclick="A.adminCancel(${o.order_id})">ยกเลิกออเดอร์</button>` : ''}
        </div>
      </div>
    `;
  }).join('')}` : '<div class="empty"><h3>ยังไม่มีคำสั่งซื้อ</h3></div>';
};

adminTabs.customers = async () => {
  const { customers = [], admins = [] } = await api('GET', '/api/admin/customers');
  _adminCache.customers = customers;
  _adminCache.admins = admins;
  const q = ($('#custSearch')?.value || '').trim().toLowerCase();
  const filtered = q
    ? customers.filter((c) =>
        `${c.customer_id} ${c.first_name} ${c.last_name} ${c.email} ${c.phone || ''} ${c.address || ''}`
          .toLowerCase()
          .includes(q)
      )
    : customers;
  $('#tab').innerHTML = `
    <div class="panel table-wrap">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">
        <h3 style="margin:0">👥 รายชื่อลูกค้าทั้งหมด (${customers.length} บัญชี)</h3>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <input id="custSearch" type="search" placeholder="ค้นหาชื่อ / อีเมล / เบอร์..." value="${esc(q)}" oninput="A.filterCustomers()" style="padding:7px 12px;border:1px solid #ddd;border-radius:8px;min-width:220px">
          <button type="button" class="btn ghost sm" onclick="A.tab('customers')">🔄 รีเฟรชรายชื่อ</button>
        </div>
      </div>
      <table>
        <tr><th># (Customer_ID)</th><th>ชื่อ</th><th>อีเมล</th><th>โทร</th><th>ที่อยู่</th><th>แอดมินดูแล (FK)</th><th>สมัครเมื่อ</th><th>ออเดอร์</th><th>ยอดซื้อ</th><th>การจัดการ</th></tr>
        ${filtered.length
          ? filtered.map((c) => `<tr data-cust-row="${esc((c.customer_id + ' ' + c.first_name + ' ' + c.last_name + ' ' + c.email + ' ' + (c.phone || '') + ' ' + (c.address || '')).toLowerCase())}"><td><b>#${c.customer_id}</b></td><td>${esc(c.first_name)} ${esc(c.last_name)}</td><td>${esc(c.email)}</td><td>${esc(c.phone || '-')}</td><td>${esc(c.address || '-')}</td><td>${c.admin_id ? `#${c.admin_id} ` : ''}${esc(c.admin_name || '-')}</td><td>${dt(c.created_at)}</td><td>${c.orders}</td><td>${money(c.spent)}</td><td class="actions" style="white-space:nowrap"><button type="button" class="btn ghost sm" onclick="A.openEditCustomer(${c.customer_id})">✏️ แก้ไข</button><button type="button" class="btn danger sm" onclick="A.deleteCustomer(${c.customer_id}, ${JSON.stringify(`${c.first_name} ${c.last_name}`).replace(/"/g, '&quot;')})">ลบ</button></td></tr>`).join('')
          : '<tr><td colspan="10" class="muted" style="text-align:center;padding:20px">ไม่พบข้อมูลลูกค้า</td></tr>'}
      </table>
    </div>
  `;
};

adminTabs.suppliers = async () => {
  const { admins = [], suppliers = [], employees = [] } = await api('GET', '/api/admin/suppliers');
  _adminCache.admins = admins;
  _adminCache.suppliers = suppliers;
  _adminCache.employees = employees;
  const curAdminId = state.user?.admin_id || state.user?.id;
  $('#tab').innerHTML = `
    <div class="panel">
      <h3>ผู้ดูแลระบบ (Admin)</h3>
      <div class="table-wrap">
        <table>
          <tr><th># (Admin_ID)</th><th>ชื่อ-นามสกุล</th><th>อีเมล</th><th>เบอร์โทรศัพท์</th><th>การจัดการ</th></tr>
          ${admins.map((a) => `
            <tr>
              <td><b>#${a.admin_id}</b></td>
              <td><b>${esc(a.name)}</b></td>
              <td>${esc(a.email)}</td>
              <td>${esc(a.phone || '-')}</td>
              <td class="actions" style="white-space:nowrap">
                <button type="button" class="btn ghost sm" onclick="A.openEditAdmin(${a.admin_id})">✏️ แก้ไข</button>
                ${a.admin_id === curAdminId
                  ? '<button type="button" class="btn ghost sm" disabled title="ไม่สามารถลบบัญชีที่กำลังล็อกอิน">กำลังใช้งาน</button>'
                  : `<button type="button" class="btn danger sm" onclick="A.deleteAdmin(${a.admin_id}, ${JSON.stringify(a.name).replace(/"/g, '&quot;')})">ลบ</button>`}
              </td>
            </tr>
          `).join('')}
        </table>
      </div>
      <form class="inline-form" onsubmit="return A.addAdmin(event)">
        <input name="name" placeholder="ชื่อผู้ดูแลระบบ" required>
        <input name="email" type="email" placeholder="อีเมล" required>
        <input name="phone" placeholder="เบอร์โทร">
        <input name="password" type="password" minlength="8" placeholder="รหัสผ่าน (8+ ตัว)" required>
        <button class="btn sm">+ เพิ่มแอดมิน</button>
      </form>
    </div>
    <div class="panel">
      <h3>ซัพพลายเออร์</h3>
      <div class="table-wrap">
        <table>
          <tr><th># (Supplier_ID)</th><th>ชื่อ</th><th>ผู้ติดต่อ</th><th>โทร</th><th>อีเมล</th><th>ที่อยู่</th><th>พนักงานดูแล (FK)</th><th>แอดมิน (FK)</th><th>การจัดการ</th></tr>
          ${suppliers.length ? suppliers.map((s) => `
            <tr>
              <td><b>#${s.supplier_id}</b></td>
              <td>${esc(s.name)}</td>
              <td>${esc(s.contact_name || '-')}</td>
              <td>${esc(s.phone || '-')}</td>
              <td>${esc(s.email || '-')}</td>
              <td>${esc(s.address || '-')}</td>
              <td>${s.employee_id ? `#${s.employee_id} ` : ''}${esc(s.employee_name || '-')}</td>
              <td>${s.admin_id ? `#${s.admin_id} ` : ''}${esc(s.admin_name || '-')}</td>
              <td class="actions" style="white-space:nowrap">
                <button type="button" class="btn ghost sm" onclick="A.openEditSupplier(${s.supplier_id})">✏️ แก้ไข</button>
                <button type="button" class="btn danger sm" onclick="A.deleteSupplier(${s.supplier_id}, ${JSON.stringify(s.name).replace(/"/g, '&quot;')})">ลบ</button>
              </td>
            </tr>
          `).join('') : '<tr><td colspan="9" class="muted" style="text-align:center;padding:18px">ยังไม่มีข้อมูลซัพพลายเออร์</td></tr>'}
        </table>
      </div>
      <form class="inline-form" onsubmit="return A.addSupplier(event)">
        <input name="name" placeholder="ชื่อซัพพลายเออร์" required>
        <input name="contact_name" placeholder="ผู้ติดต่อ">
        <input name="phone" placeholder="เบอร์โทร">
        <input name="email" placeholder="อีเมล">
        <input name="address" placeholder="ที่อยู่">
        <select name="employee_id"><option value="">พนักงานดูแล</option>${employees.map((e) => `<option value="${e.employee_id}">#${e.employee_id} ${esc(e.first_name)} ${esc(e.last_name)}</option>`).join('')}</select>
        <button class="btn sm">+ เพิ่ม</button>
      </form>
    </div>
    <div class="panel">
      <h3>พนักงาน</h3>
      <div class="table-wrap">
        <table>
          <tr><th># (Employee_ID)</th><th>ชื่อ</th><th>ตำแหน่ง</th><th>อีเมล</th><th>โทร</th><th>ที่อยู่</th><th>การจัดการ</th></tr>
          ${employees.length ? employees.map((e) => `
            <tr>
              <td><b>#${e.employee_id}</b></td>
              <td>${esc(e.first_name)} ${esc(e.last_name)}</td>
              <td>${esc(e.position || '-')}</td>
              <td>${esc(e.email || '-')}</td>
              <td>${esc(e.phone || '-')}</td>
              <td>${esc(e.address || '-')}</td>
              <td class="actions" style="white-space:nowrap">
                <button type="button" class="btn ghost sm" onclick="A.openEditEmployee(${e.employee_id})">✏️ แก้ไข</button>
                <button type="button" class="btn danger sm" onclick="A.deleteEmployee(${e.employee_id}, ${JSON.stringify(`${e.first_name} ${e.last_name}`).replace(/"/g, '&quot;')})">ลบ</button>
              </td>
            </tr>
          `).join('') : '<tr><td colspan="7" class="muted" style="text-align:center;padding:18px">ยังไม่มีข้อมูลพนักงาน</td></tr>'}
        </table>
      </div>
      <form class="inline-form" onsubmit="return A.addEmployee(event)">
        <input name="first_name" placeholder="ชื่อ" required>
        <input name="last_name" placeholder="นามสกุล" required>
        <input name="position" placeholder="ตำแหน่ง">
        <input name="email" placeholder="อีเมล">
        <input name="phone" placeholder="เบอร์โทร">
        <input name="address" placeholder="ที่อยู่">
        <button class="btn sm">+ เพิ่ม</button>
      </form>
    </div>
  `;
};

const SQL_TABLE_META = [
  ['product', 'dbo.product', 'สินค้า'],
  ['product_variant', 'dbo.product_variant', 'ไซส์/สี/สต็อก'],
  ['order', 'dbo.[order]', 'คำสั่งซื้อ'],
  ['order_item', 'dbo.order_item', 'รายการสั่งซื้อ'],
  ['payment', 'dbo.payment', 'การชำระเงิน'],
  ['shipment', 'dbo.shipment', 'การจัดส่งพัสดุ'],
  ['customer', 'dbo.customer', 'ลูกค้า'],
  ['address', 'dbo.address', 'ที่อยู่ลูกค้า'],
  ['admin', 'dbo.admin', 'ผู้ดูแลระบบ'],
  ['employee', 'dbo.employee', 'พนักงาน'],
  ['supplier', 'dbo.supplier', 'ซัพพลายเออร์'],
  ['coupon', 'dbo.coupon', 'คูปองส่วนลด'],
  ['cart_item', 'dbo.cart_item', 'ตะกร้าสินค้า'],
  ['review', 'dbo.review', 'รีวิวสินค้า'],
  ['wishlist', 'dbo.wishlist', 'รายการโปรด'],
  ['review_like', 'dbo.review_like', 'ถูกใจรีวิว'],
  ['VIEW:Orders', 'dbo.Orders (VIEW)', 'View: Orders'],
  ['VIEW:Order_Detail', 'dbo.Order_Detail (VIEW)', 'View: Order_Detail']
];

function renderSqlGridHtml(rows, title = '') {
  if (!rows || !rows.length) {
    return `<div class="muted" style="padding:20px;text-align:center;background:var(--cream);border-radius:var(--radius)">ไม่มีข้อมูลในตาราง ${esc(title)} (0 แถว)</div>`;
  }
  const cols = Object.keys(rows[0]);
  return `
    <div class="table-wrap sql-grid-wrap">
      <table class="sql-data-table">
        <thead>
          <tr>
            <th>#</th>
            ${cols.map((c) => `<th>${esc(c)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map((r, idx) => `
            <tr>
              <td class="muted">${idx + 1}</td>
              ${cols.map((c) => {
                const v = r[c];
                if (v === null || v === undefined) return '<td class="sql-null">NULL</td>';
                if (c === 'password_hash') return `<td><code style="font-size:11px">${esc(String(v).slice(0, 18))}…</code></td>`;
                if (c === 'image_url' && String(v).length > 36) return `<td title="${esc(String(v))}"><code style="font-size:11px">${esc(String(v).slice(0, 36))}…</code></td>`;
                return `<td>${esc(String(v))}</td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function updateLiveSqlExplorerDom(snap) {
  if (!snap) return;
  lastSqlSnapshot = snap;
  const pillBox = $('#sqlTablePills');
  const gridBox = $('#sqlTableGrid');
  const metaTitle = $('#sqlActiveTableTitle');
  const chkEl = $('#sqlLiveChecksum');
  const timeEl = $('#sqlLiveTime');

  if (chkEl) chkEl.textContent = snap.checksum || '-';
  if (timeEl) timeEl.textContent = dt(snap.timestamp);

  if (pillBox) {
    pillBox.innerHTML = SQL_TABLE_META.map(([key, sqlName, thLabel]) => {
      const isView = key.startsWith('VIEW:');
      const vName = isView ? key.slice(5) : key;
      const count = isView ? (snap.views?.[vName]?.length || 0) : (snap.counts?.[key] || 0);
      return `
        <button type="button" class="sql-obj-btn ${activeSqlTable === key ? 'on' : ''}" onclick="A.selectSqlTable('${key}')">
          <span><b>${esc(sqlName)}</b> <small class="muted">(${esc(thLabel)})</small></span>
          <span class="sql-count-badge">${count}</span>
        </button>
      `;
    }).join('');
  }

  if (gridBox) {
    const isView = activeSqlTable.startsWith('VIEW:');
    const vName = isView ? activeSqlTable.slice(5) : activeSqlTable;
    const rows = isView ? (snap.views?.[vName] || []) : (snap.tables?.[activeSqlTable] || []);
    const found = SQL_TABLE_META.find((m) => m[0] === activeSqlTable);
    const label = found ? `${found[1]} — ${found[2]}` : activeSqlTable;
    if (metaTitle) metaTitle.innerHTML = `ตารางปัจจุบัน: <b>${esc(label)}</b> <span class="muted">(${rows.length} แถว)</span>`;
    gridBox.innerHTML = renderSqlGridHtml(rows, label);
  }
}

adminTabs.sql = async () => {
  const { status, snapshot } = await api('GET', '/api/sql/status');
  lastSqlSnapshot = snapshot;
  const presets = [
    ['ดูสินค้าทั้งหมด', 'SELECT * FROM dbo.product;'],
    ['ดูไซส์และสต็อก', 'SELECT * FROM dbo.product_variant;'],
    ['ดูคำสั่งซื้อล่าสุด', 'SELECT * FROM dbo.[order] ORDER BY order_id DESC;'],
    ['ดูรายการในคำสั่งซื้อ', 'SELECT * FROM dbo.order_item;'],
    ['ดูการชำระเงิน', 'SELECT * FROM dbo.payment;'],
    ['ดูการจัดส่งพัสดุ', 'SELECT * FROM dbo.shipment;'],
    ['ดูแอดมินทั้ง 5 บัญชี', 'SELECT admin_id, name, email, phone FROM dbo.admin;'],
    ['ดูลูกค้าทั้งหมด', 'SELECT customer_id, first_name, last_name, email, phone, address, admin_id FROM dbo.customer;'],
    ['ดู View: Orders', 'SELECT * FROM dbo.Orders;'],
    ['ดู View: Order_Detail', 'SELECT * FROM dbo.Order_Detail;']
  ];

  $('#tab').innerHTML = `
    <div class="panel sql-studio-banner">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:14px">
        <div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <span class="sql-status-badge on"><span class="sql-pulse-dot"></span> LIVE REALTIME SYNC</span>
            <h3 style="margin:0">Microsoft SQL Server Management Studio (SSMS) — Realtime Connector</h3>
          </div>
          <p class="muted" style="margin:6px 0 0;font-size:13.5px">
            Instance: <b><code>${esc(snapshot.instance || '.\\SQLEXPRESS01')}</code></b> ·
            Database: <b><code>[${esc(snapshot.database || 'NoirCreamShop')}]</code></b> ·
            Checksum: <code id="sqlLiveChecksum">${esc(snapshot.checksum)}</code> ·
            อัปเดตล่าสุด: <span id="sqlLiveTime">${dt(snapshot.timestamp)}</span>
          </p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button type="button" class="btn sm" onclick="A.copyPowerShellRealtime()">⚡ คัดลอกคำสั่งเชื่อม .\\SQLEXPRESS01 อัตโนมัติ</button>
          <button type="button" class="btn ghost sm" onclick="A.copySqlScript()">📋 คัดลอกโค้ด SQL ทั้งหมด</button>
          <button type="button" class="btn ghost sm" onclick="A.downloadSqlScript()">⬇️ ดาวน์โหลดไฟล์ .sql</button>
        </div>
      </div>

      <div class="sql-connect-guide">
        <div style="margin-bottom:8px">
          <b>🚀 วิธีเชื่อมต่อเข้าโปรแกรม SSMS (<code>.\\SQLEXPRESS01</code>) ในเครื่องคอมพิวเตอร์แบบ Realtime ทันที:</b>
        </div>
        <div class="sql-guide-steps">
          <div class="sql-step">
            <b>วิธีที่ 1: เชื่อมต่อแบบ 2-Way Realtime อัตโนมัติ (แนะนำ)</b>
            <p class="muted" style="margin:4px 0 8px;font-size:12.5px">
              กดปุ่ม <b>"⚡ คัดลอกคำสั่งเชื่อม .\\SQLEXPRESS01 อัตโนมัติ"</b> ด้านบน แล้วนำไปวาง (Paste) ในโปรแกรม <b>Windows PowerShell</b> บนเครื่องของคุณ (หรือดับเบิลคลิกไฟล์ <code>Connect_SSMS_Realtime.bat</code> ในโฟลเดอร์โปรเจกต์) ระบบจะสร้างฐานข้อมูล <code>NoirCreamShop</code> พร้อมตารางทั้ง 16 ตารางเข้าสู่ <code>.\\SQLEXPRESS01</code> ทันที และซิงค์ข้อมูล Realtime ตลอดเวลา!
            </p>
          </div>
          <div class="sql-step">
            <b>วิธีที่ 2: รันในหน้าต่าง New Query ของ SSMS</b>
            <p class="muted" style="margin:4px 0 8px;font-size:12.5px">
              ในโปรแกรม SSMS ของคุณ กดปุ่ม <b>New Query</b> ด้านบน -> กดปุ่ม <b>"📋 คัดลอกโค้ด SQL ทั้งหมด"</b> จากหน้านี้ไปวาง -> กด <b>Execute (F5)</b> จากนั้นคลิกขวาที่โฟลเดอร์ <b>Databases -> Refresh</b> จะพบฐานข้อมูล <code>NoirCreamShop</code> ทันที
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Interactive SQL Query Console -->
    <div class="panel">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
        <h3 style="margin:0">💻 New Query — รันคำสั่ง SQL แบบ Realtime (รองรับ T-SQL / SSMS)</h3>
        <span class="muted" style="font-size:12.5px">เมื่อรัน INSERT / UPDATE / DELETE ข้อมูลจะอัปเดตทั้งหน้าเว็บและไฟล์ SQL Server ทันที</span>
      </div>
      <div class="chips" style="margin-bottom:10px">
        ${presets.map(([label, sql]) => `
          <button type="button" class="chip" onclick="A.setSqlQuery(${JSON.stringify(sql).replace(/"/g, '&quot;')})">${esc(label)}</button>
        `).join('')}
      </div>
      <form onsubmit="return A.runSqlQuery(event)">
        <textarea id="sqlQueryInput" class="sql-editor" rows="3" placeholder="SELECT * FROM dbo.product;">SELECT * FROM dbo.[order] ORDER BY order_id DESC;</textarea>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;flex-wrap:wrap;gap:10px">
          <button class="btn sm">▶ Execute (รันคำสั่ง SQL)</button>
          <span id="sqlQueryMeta" class="muted" style="font-size:13px">พร้อมทำงาน</span>
        </div>
      </form>
      <div id="sqlQueryResult" style="margin-top:14px"></div>
    </div>

    <!-- Live Object Explorer & Table Data Grid -->
    <div class="panel">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">
        <h3 style="margin:0">📂 Object Explorer — ตารางฐานข้อมูล <code>[NoirCreamShop]</code> แบบ Realtime (16 ตาราง + 2 Views)</h3>
        <button type="button" class="btn ghost sm" onclick="A.refreshSqlSnapshot()">🔄 รีเฟรชข้อมูลทันที</button>
      </div>
      <div class="sql-explorer-layout">
        <div id="sqlTablePills" class="sql-obj-list"></div>
        <div class="sql-obj-content">
          <div id="sqlActiveTableTitle" style="margin-bottom:10px;font-size:14px"></div>
          <div id="sqlTableGrid"></div>
        </div>
      </div>
    </div>
  `;

  updateLiveSqlExplorerDom(snapshot);
};

/* ---------- Actions & Handlers ---------- */
const formData = (e) => { e.preventDefault(); return Object.fromEntries(new FormData(e.target).entries()); };
const showErr = (m) => { const el = $('#err'); if (el) { el.textContent = m; el.className = 'err show'; } else toast(m, true); };
const refresh = () => route();

const A = window.A = {
  toggleMobileMenu() {
    const d = $('#mobileMenu'), b = $('#menuBackdrop');
    if (d && b) {
      d.classList.toggle('open');
      b.classList.toggle('open');
    }
  },

  openSizeModal(cat) {
    const c = cat || 'เสื้อยืด';
    const g = SIZE_GUIDES[c] || SIZE_GUIDES['เสื้อยืด'];
    const mb = $('#modalBox');
    if (!mb) return;
    mb.innerHTML = `
      <button class="modal-close" onclick="A.closeModal()" aria-label="ปิด">✕</button>
      <h3 style="margin:0 0 6px">${esc(g.title)}</h3>
      <p class="muted" style="margin:0 0 16px;font-size:13.5px">${esc(g.desc)}</p>
      <div class="chips" style="margin-bottom:16px">
        ${Object.keys(SIZE_GUIDES).map((k) => `
          <button type="button" class="chip ${k === c ? 'on' : ''}" onclick="A.openSizeModal('${k}')">${esc(k)}</button>
        `).join('')}
      </div>
      <div class="table-wrap">
        <table class="size-table">
          <thead>
            <tr>${g.headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${g.rows.map((row) => `
              <tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join('')}</tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="measure-tips" style="margin-top:14px">
        <b>💡 คำแนะนำ:</b> หากไม่แน่ใจ แนะนำให้วัดเทียบกับเสื้อผ้าตัวเดิมที่ใส่พอดีที่สุด
      </div>
    `;
    $('#modal').classList.add('open');
  },

  closeModal() {
    $('#modal')?.classList.remove('open');
  },

  onCatChange(cat) {
    const imgIn = $('#newProdImg');
    const shapeMap = {
      'เสื้อยืด': 'shape:tee',
      'เสื้อโปโล': 'shape:polo',
      'เสื้อแขนยาว': 'shape:longsleeve',
      'กางเกง': 'shape:pants'
    };
    if (imgIn && (!imgIn.value || imgIn.value.startsWith('shape:'))) {
      imgIn.value = shapeMap[cat] || 'shape:tee';
    }

    // Update size checkboxes based on category
    const checks = $('#sizeCheckboxes');
    if (checks) {
      const isPants = cat === 'กางเกง';
      const sizeList = isPants ? ['28', '30', '32', '34', '36'] : ['S', 'M', 'L', 'XL', '2XL'];
      checks.innerHTML = sizeList.map((s, idx) => `
        <label class="size-check-label">
          <input type="checkbox" name="sizes" value="${s}" ${idx < 4 ? 'checked' : ''}>
          <span>${s}</span>
        </label>
      `).join('');
    }
  },

  selectAllSizes(val) {
    $$('#sizeCheckboxes input[type="checkbox"]').forEach((cb) => (cb.checked = val));
  },

  search(e) {
    const d = formData(e);
    go('#/shop?' + new URLSearchParams(d));
    return false;
  },

  async login(e) {
    const d = formData(e);
    try {
      const r = await api('POST', '/api/login', d);
      state.user = r.user;
      await loadCart();
      toast('ยินดีต้อนรับ ' + (r.user.first_name || r.user.name));
      go(r.user.role === 'admin' ? '#/admin' : '#/');
    } catch (x) {
      showErr(x.message);
    }
    return false;
  },

  async register(e) {
    const d = formData(e);
    if (d.password !== d.confirm) {
      showErr('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน');
      return false;
    }
    try {
      const r = await api('POST', '/api/register', d);
      state.user = r.user;
      await loadCart();
      toast('สมัครสมาชิกสำเร็จ ยินดีต้อนรับสู่ NOIR & CREAM');
      go('#/');
    } catch (x) {
      showErr(x.message);
    }
    return false;
  },

  async logout() {
    await api('POST', '/api/logout');
    state.user = null;
    await loadCart();
    toast('ออกจากระบบเรียบร้อย');
    go('#/');
  },

  wish(id, btn) {
    safe(async () => {
      if (!state.user) {
        go('#/login');
        return toast('กรุณาเข้าสู่ระบบเพื่อบันทึกรายการโปรด', true);
      }
      const r = await api('POST', '/api/wishlist/' + id);
      if (btn) {
        btn.classList.toggle('on', r.wished);
        if (r.wished) spawnParticles(btn, ['♥', '♡', '✦']);
      }
      toast(r.wished ? 'เพิ่มในรายการโปรดแล้ว' : 'นำออกจากรายการโปรดแล้ว');
      if (location.hash.startsWith('#/wishlist')) refresh();
    });
  },

  rate(n) {
    A._rate = n;
    document.querySelectorAll('#stars button').forEach((b, i) => b.classList.toggle('on', i < n));
  },

  review(e, pid) {
    const d = formData(e);
    safe(async () => {
      await api('POST', `/api/products/${pid}/reviews`, { rating: A._rate, comment: d.comment });
      toast('บันทึกรีวิวของคุณเรียบร้อยแล้ว');
      refresh();
    });
    return false;
  },

  likeReview(rid, pid, btn) {
    safe(async () => {
      if (!state.user) {
        go('#/login');
        return toast('กรุณาเข้าสู่ระบบก่อนกดถูกใจรีวิว', true);
      }
      if (btn) spawnParticles(btn, ['❤️', '✦', '♥']);
      const r = await api('POST', `/api/reviews/${rid}/like`);
      toast(r.liked ? '❤️ กดถูกใจรีวิวแล้ว' : 'ยกเลิกการถูกใจแล้ว');
      refresh();
    });
  },

  deleteReview(rid, pid) {
    if (confirm('คุณต้องการลบรีวิวนี้หรือไม่?')) {
      safe(async () => {
        await api('DELETE', `/api/reviews/${rid}`);
        toast('ลบรีวิวเรียบร้อยแล้ว');
        refresh();
      });
    }
  },

  startEditReview(pid, rating, comment) {
    const form = $('#review-form-' + pid);
    if (form) {
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const textarea = form.querySelector('textarea[name="comment"]');
      if (textarea) {
        textarea.value = comment || '';
        textarea.focus();
      }
      A.rate(rating || 5);
      const title = form.querySelector('.review-form-title');
      if (title) title.innerHTML = '<b>✏️ กำลังแก้ไขรีวิวของคุณ (สามารถเปลี่ยนคะแนนหรือข้อความได้)</b>';
      toast('คุณกำลังแก้ไขรีวิว');
    }
  },

  setQty(id, q) {
    safe(async () => {
      if (q < 1) return A.removeItem(id);
      state.cart = await api('PUT', '/api/cart/' + id, { quantity: q });
      refresh();
    });
  },

  removeItem(id) {
    safe(async () => {
      state.cart = await api('DELETE', '/api/cart/' + id);
      refresh();
    });
  },

  addAddress(e) {
    const d = formData(e);
    d.is_default = !!d.is_default;
    safe(async () => {
      await api('POST', '/api/addresses', d);
      toast('บันทึกที่อยู่จัดส่งแล้ว');
      refresh();
    });
    return false;
  },

  openEditAddress(id) {
    const a = _addrCache.find((x) => x.address_id === id);
    const mb = $('#modalBox');
    if (!a || !mb) return;
    mb.innerHTML = `
      <button type="button" class="modal-close" onclick="A.closeModal()" aria-label="ปิด">✕</button>
      <h3 style="margin:0 0 14px">✏️ แก้ไขที่อยู่จัดส่ง #${a.address_id}</h3>
      ${addressForm(`A.saveAddressEdit(event, ${a.address_id})`, a, '💾 บันทึกการแก้ไข', true)}
    `;
    $('#modal').classList.add('open');
  },

  saveAddressEdit(e, id) {
    const d = formData(e);
    d.is_default = !!d.is_default;
    safe(async () => {
      await api('PUT', `/api/addresses/${id}`, d);
      try {
        const me = await api('GET', '/api/me');
        if (me.user) state.user = me.user;
      } catch {}
      A.closeModal();
      toast('อัปเดตที่อยู่จัดส่งเรียบร้อยแล้ว');
      refresh();
    });
    return false;
  },

  defAddr(id) { safe(async () => { await api('PUT', `/api/addresses/${id}/default`); refresh(); }); },
  delAddr(id) { if (confirm('ต้องการลบที่อยู่นี้หรือไม่?')) safe(async () => { await api('DELETE', '/api/addresses/' + id); refresh(); }); },
  saveProfile(e) { const d = formData(e); safe(async () => { const r = await api('PUT', '/api/me', d); state.user = r.user; renderChrome(); toast('บันทึกข้อมูลส่วนตัวเรียบร้อย'); }); return false; },
  changePw(e) { const d = formData(e); const f = e.target; safe(async () => { await api('PUT', '/api/me/password', d); f.reset(); toast('เปลี่ยนรหัสผ่านเรียบร้อย'); }); return false; },
  payOrder(id) { safe(async () => { await api('POST', `/api/orders/${id}/pay`); toast('ชำระเงินเรียบร้อยแล้ว (จำลอง)'); refresh(); }); },
  cancelOrder(id) { if (confirm('ยืนยันยกเลิกคำสั่งซื้อนี้?')) safe(async () => { await api('POST', `/api/orders/${id}/cancel`); toast('ยกเลิกคำสั่งซื้อแล้ว'); refresh(); }); },
  received(id) { safe(async () => { await api('POST', `/api/orders/${id}/received`); toast('ขอบคุณที่ใช้บริการกับ NOIR & CREAM'); refresh(); }); },

  /* Admin Actions */
  tab(k) { adminTab = k; refresh(); },

  saveProduct(e, id) {
    const d = formData(e);
    d.is_featured = !!d.is_featured;
    safe(async () => {
      if (id) await api('PUT', '/api/admin/products/' + id, d);
      else await api('POST', '/api/admin/products', d);
      toast('บันทึกข้อมูลสินค้าแล้ว');
      refresh();
    });
    return false;
  },

  saveProductWithVariants(e) {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const checkedSizes = fd.getAll('sizes');
    if (!checkedSizes.length) {
      return toast('กรุณาเลือกไซส์อย่างน้อย 1 ไซส์', true);
    }
    const color = String(fd.get('batch_color') || '').trim();
    const colorHex = String(fd.get('batch_color_hex') || '#EADFC8').trim();
    const price = Number(fd.get('batch_price')) || 390;
    const stock = Number(fd.get('batch_stock')) || 10;

    const variants = checkedSizes.map((sz) => ({
      size: sz,
      color: color,
      color_hex: colorHex,
      price: price,
      stock: stock
    }));

    const payload = {
      name: String(fd.get('name') || '').trim(),
      category: String(fd.get('category') || 'เสื้อยืด').trim(),
      description: String(fd.get('description') || '').trim(),
      image_url: String(fd.get('image_url') || '').trim(),
      supplier_id: fd.get('supplier_id') ? Number(fd.get('supplier_id')) : null,
      employee_id: fd.get('employee_id') ? Number(fd.get('employee_id')) : null,
      status: fd.get('status') || 'active',
      is_featured: !!fd.get('is_featured'),
      variants: variants
    };

    safe(async () => {
      await api('POST', '/api/admin/products', payload);
      toast(`สร้างสินค้า "${payload.name}" พร้อมสต็อก ${checkedSizes.length} ไซส์เรียบร้อยแล้ว!`);
      refresh();
    });
    return false;
  },

  deleteProduct(id) {
    if (confirm('ยืนยันลบสินค้านี้ออกจากร้าน?')) {
      safe(async () => {
        const r = await api('DELETE', '/api/admin/products/' + id);
        toast(r.message || 'ลบสินค้าเรียบร้อยแล้ว');
        refresh();
      });
    }
  },

  clearAllStock() {
    if (confirm('คำเตือน: คุณต้องการล้างสต็อกสินค้าทั้งหมดออกจากระบบหรือไม่? (เมื่อล้างแล้วคุณสามารถเพิ่มสินค้าใหม่เองได้ทันที)')) {
      safe(async () => {
        await api('POST', '/api/admin/stock/clear');
        toast('ล้างสต็อกและสินค้าทั้งหมดเรียบร้อยแล้ว');
        refresh();
      });
    }
  },

  saveVariant(id) {
    safe(async () => {
      await api('PUT', '/api/admin/variants/' + id, { price: $('#vp' + id).value, stock: $('#vs' + id).value });
      toast('บันทึกราคาและสต็อกแล้ว');
    });
  },

  delVariant(id) {
    if (confirm('ต้องการลบรูปแบบสินค้านี้หรือไม่?')) {
      safe(async () => {
        await api('DELETE', '/api/admin/variants/' + id);
        toast('ลบรูปแบบสินค้าเรียบร้อย');
        refresh();
      });
    }
  },

  toggleFormSizes(form, val) {
    form.querySelectorAll('input[name="sizes"]').forEach((cb) => (cb.checked = val));
  },

  addBatchVariants(e, pid) {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);
    const checkedSizes = fd.getAll('sizes');
    if (!checkedSizes.length) {
      return toast('กรุณาเลือกไซส์อย่างน้อย 1 ไซส์', true);
    }
    const color = String(fd.get('color') || '').trim();
    const colorHex = String(fd.get('color_hex') || '#141414').trim();
    const price = Number(fd.get('price'));
    const stock = Number(fd.get('stock'));

    if (!color || !(price > 0) || stock < 0) {
      return toast('กรุณากรอกข้อมูลสี ราคา และสต็อกให้ถูกต้อง', true);
    }

    const variants = checkedSizes.map((sz) => ({
      size: sz,
      color,
      color_hex: colorHex,
      price,
      stock
    }));

    safe(async () => {
      await api('POST', `/api/admin/products/${pid}/variants`, { variants });
      toast(`เพิ่มไซส์สี "${color}" (${checkedSizes.join(', ')}) เรียบร้อยแล้ว!`);
      refresh();
    });
    return false;
  },

  addVariant(e, pid) {
    const d = formData(e);
    safe(async () => {
      await api('POST', `/api/admin/products/${pid}/variants`, d);
      toast('เพิ่มรูปแบบสินค้าแล้ว');
      refresh();
    });
    return false;
  },

  genTrackingNo(carrier, orderId) {
    const c = String(carrier || '').toLowerCase();
    const d = new Date();
    const ymd = `${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const oid = String(orderId || 0).padStart(3, '0');
    const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    const rand = (n) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    if (c.includes('kerry')) return `KEX${ymd}${oid}${rand(4)}`;
    if (c.includes('j&t') || c.includes('jt')) return `JT${ymd}${oid}${rand(4)}`;
    if (c.includes('ไปรษณีย์') || c.includes('ems') || c.includes('thailand post')) {
      return `EF${Math.floor(100000000 + Math.random() * 900000000)}TH`;
    }
    if (c.includes('flash')) return `TH${ymd}${oid}${rand(5)}`;
    return `NC${ymd}${oid}${rand(4)}`;
  },

  fillTracking(id, isEdit = false) {
    const carrierEl = $(isEdit ? `#edit-carrier-${id}` : `#ship-carrier-${id}`);
    const trackEl = $(isEdit ? `#edit-track-${id}` : `#ship-track-${id}`);
    if (!trackEl) return;
    trackEl.value = A.genTrackingNo(carrierEl?.value || 'Flash Express', id);
    trackEl.focus();
  },

  toggleEditShip(id) {
    const form = $(`#edit-ship-form-${id}`);
    if (!form) return;
    form.style.display = form.style.display === 'none' ? 'flex' : 'none';
  },

  ship(e, id) {
    const d = formData(e);
    safe(async () => {
      const res = await api('POST', `/api/admin/orders/${id}/ship`, d);
      toast(`บันทึกการจัดส่งแล้ว (${res.carrier}: ${res.tracking_no})`);
      refresh();
    });
    return false;
  },

  updateShipment(e, id) {
    const d = formData(e);
    safe(async () => {
      const res = await api('PUT', `/api/admin/orders/${id}/shipment`, d);
      toast(`อัปเดตเลขพัสดุแล้ว (${res.carrier}: ${res.tracking_no})`);
      refresh();
    });
    return false;
  },

  adminComplete(id) { safe(async () => { await api('POST', `/api/admin/orders/${id}/complete`); refresh(); }); },
  adminCancel(id) { if (confirm('ยกเลิกออเดอร์นี้และคืนสต็อก?')) safe(async () => { await api('POST', `/api/admin/orders/${id}/cancel`); refresh(); }); },
  addSupplier(e) { const d = formData(e); safe(async () => { await api('POST', '/api/admin/suppliers', d); toast('เพิ่มซัพพลายเออร์แล้ว'); refresh(); }); return false; },
  deleteSupplier(id, name) {
    if (confirm(`ยืนยันการลบซัพพลายเออร์ "${name || ''}" ออกจากระบบ?`)) {
      safe(async () => {
        await api('DELETE', `/api/admin/suppliers/${id}`);
        toast('ลบซัพพลายเออร์เรียบร้อยแล้ว');
        refresh();
      });
    }
  },
  addEmployee(e) { const d = formData(e); safe(async () => { await api('POST', '/api/admin/employees', d); toast('เพิ่มพนักงานแล้ว'); refresh(); }); return false; },
  deleteEmployee(id, name) {
    if (confirm(`ยืนยันการลบพนักงาน "${name || ''}" ออกจากระบบ?`)) {
      safe(async () => {
        await api('DELETE', `/api/admin/employees/${id}`);
        toast('ลบพนักงานเรียบร้อยแล้ว');
        refresh();
      });
    }
  },

  openEditCustomer(id) {
    const c = _adminCache.customers.find((x) => x.customer_id === id);
    const mb = $('#modalBox');
    if (!c || !mb) return;
    const addr = c.default_address || {};
    const adminOpts = '<option value="">— ไม่ระบุ —</option>' +
      _adminCache.admins.map((a) => `<option value="${a.admin_id}" ${a.admin_id === c.admin_id ? 'selected' : ''}>#${a.admin_id} ${esc(a.name)}</option>`).join('');
    const legacyHint = !c.default_address && c.address
      ? `<div class="muted" style="font-size:12px;margin-bottom:10px">ข้อมูลที่อยู่เดิม (แบบรวมข้อความ): ${esc(c.address)}</div>`
      : '';
    mb.innerHTML = `
      <button type="button" class="modal-close" onclick="A.closeModal()" aria-label="ปิด">✕</button>
      <h3 style="margin:0 0 6px">✏️ แก้ไขข้อมูลลูกค้า #${c.customer_id}</h3>
      <p class="muted" style="margin:0 0 16px;font-size:13px">ออเดอร์สะสม ${c.orders || 0} รายการ · ยอดซื้อรวม ${money(c.spent || 0)}</p>
      <form onsubmit="return A.saveCustomerEdit(event, ${c.customer_id})">
        <div class="row2">
          <div class="field"><label>ชื่อ *</label><input name="first_name" value="${esc(c.first_name)}" required></div>
          <div class="field"><label>นามสกุล *</label><input name="last_name" value="${esc(c.last_name)}" required></div>
        </div>
        <div class="row2">
          <div class="field"><label>อีเมล *</label><input name="email" type="email" value="${esc(c.email)}" required></div>
          <div class="field"><label>เบอร์โทรศัพท์</label><input name="phone" value="${esc(c.phone || '')}" placeholder="08x-xxx-xxxx"></div>
        </div>
        <div style="border:1px solid var(--line);border-radius:var(--radius);padding:12px 14px;margin-bottom:14px;background:#fcfaf7">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px">
            <b style="font-size:13.5px">ที่อยู่หลัก (แยกตาม ER — ตาราง Address)</b>
            <span class="muted" style="font-size:12px">${addr.address_id ? `Address_ID #${addr.address_id} · ` : ''}ซิงค์ลงตาราง <code>customer.address</code> ให้อัตโนมัติ</span>
          </div>
          ${legacyHint}
          <div class="row3">
            <div class="field"><label>บ้านเลขที่</label><input name="house_no" value="${esc(addr.house_no || '')}" placeholder="เช่น 99/12"></div>
            <div class="field"><label>หมู่บ้าน/หมู่ที่</label><input name="village" value="${esc(addr.village || '')}" placeholder="เช่น หมู่ 4"></div>
            <div class="field"><label>ถนน</label><input name="road" value="${esc(addr.road || '')}" placeholder="เช่น สุขุมวิท"></div>
          </div>
          <div class="row3">
            <div class="field"><label>ตำบล/แขวง</label><input name="subdistrict" value="${esc(addr.subdistrict || '')}" placeholder="เช่น คลองเตย"></div>
            <div class="field"><label>อำเภอ/เขต</label><input name="district" value="${esc(addr.district || '')}" placeholder="เช่น คลองเตย"></div>
            <div class="field"><label>จังหวัด</label><input name="province" value="${esc(addr.province || '')}" placeholder="เช่น กรุงเทพฯ"></div>
          </div>
          <div class="row2">
            <div class="field" style="margin-bottom:0"><label>รหัสไปรษณีย์</label><input name="postal_code" value="${esc(addr.postal_code || '')}" inputmode="numeric" maxlength="5" pattern="[0-9]{5}" placeholder="ตัวเลข 5 หลัก"></div>
            <div style="display:flex;align-items:flex-end;font-size:12px" class="muted">เว้นว่างทั้งหมดได้หากลูกค้ายังไม่ได้ระบุที่อยู่</div>
          </div>
        </div>
        <div class="row2">
          <div class="field"><label>แอดมินดูแล (FK)</label><select name="admin_id">${adminOpts}</select></div>
          <div class="field"><label>รหัสผ่านใหม่ (ไม่บังคับ)</label><input name="new_password" type="password" minlength="8" autocomplete="new-password" placeholder="เว้นว่างหากไม่เปลี่ยน"></div>
        </div>
        <div class="actions" style="justify-content:flex-end;margin-top:8px">
          <button type="button" class="btn ghost sm" onclick="A.closeModal()">ยกเลิก</button>
          <button class="btn sm">💾 บันทึกการแก้ไข</button>
        </div>
      </form>
    `;
    $('#modal').classList.add('open');
  },
  saveCustomerEdit(e, id) {
    const d = formData(e);
    d.admin_id = d.admin_id ? Number(d.admin_id) : null;
    if (!d.new_password) delete d.new_password;
    safe(async () => {
      await api('PUT', `/api/admin/customers/${id}`, d);
      A.closeModal();
      toast('อัปเดตข้อมูลลูกค้าเรียบร้อยแล้ว');
      refresh();
    });
    return false;
  },
  deleteCustomer(id, name) {
    if (confirm(`ยืนยันการลบบัญชีลูกค้า "${name || ''}" (#${id}) ออกจากระบบ?`)) {
      safe(async () => {
        await api('DELETE', `/api/admin/customers/${id}`);
        toast('ลบข้อมูลลูกค้าเรียบร้อยแล้ว');
        refresh();
      });
    }
  },

  addAdmin(e) {
    const d = formData(e);
    safe(async () => {
      await api('POST', '/api/admin/admins', d);
      toast('เพิ่มผู้ดูแลระบบแล้ว');
      refresh();
    });
    return false;
  },
  openEditAdmin(id) {
    const a = _adminCache.admins.find((x) => x.admin_id === id);
    const mb = $('#modalBox');
    if (!a || !mb) return;
    mb.innerHTML = `
      <button type="button" class="modal-close" onclick="A.closeModal()" aria-label="ปิด">✕</button>
      <h3 style="margin:0 0 14px">✏️ แก้ไขข้อมูลผู้ดูแลระบบ #${a.admin_id}</h3>
      <form onsubmit="return A.saveAdminEdit(event, ${a.admin_id})">
        <div class="field"><label>ชื่อ-นามสกุล *</label><input name="name" value="${esc(a.name)}" required></div>
        <div class="row2">
          <div class="field"><label>อีเมล *</label><input name="email" type="email" value="${esc(a.email)}" required></div>
          <div class="field"><label>เบอร์โทรศัพท์</label><input name="phone" value="${esc(a.phone || '')}"></div>
        </div>
        <div class="field"><label>รหัสผ่านใหม่ (ไม่บังคับ)</label><input name="new_password" type="password" minlength="8" autocomplete="new-password" placeholder="เว้นว่างหากไม่ต้องการเปลี่ยน (8 ตัวขึ้นไป)"></div>
        <div class="actions" style="justify-content:flex-end;margin-top:8px">
          <button type="button" class="btn ghost sm" onclick="A.closeModal()">ยกเลิก</button>
          <button class="btn sm">💾 บันทึกการแก้ไข</button>
        </div>
      </form>
    `;
    $('#modal').classList.add('open');
  },
  saveAdminEdit(e, id) {
    const d = formData(e);
    if (!d.new_password) delete d.new_password;
    safe(async () => {
      await api('PUT', `/api/admin/admins/${id}`, d);
      if (state.user?.role === 'admin' && (state.user.admin_id === id || state.user.id === id)) {
        state.user.name = d.name;
        state.user.email = d.email;
        state.user.phone = d.phone;
      }
      A.closeModal();
      toast('อัปเดตข้อมูลผู้ดูแลระบบเรียบร้อยแล้ว');
      refresh();
    });
    return false;
  },
  deleteAdmin(id, name) {
    if (confirm(`ยืนยันการลบผู้ดูแลระบบ "${name || ''}" (#${id})?`)) {
      safe(async () => {
        await api('DELETE', `/api/admin/admins/${id}`);
        toast('ลบผู้ดูแลระบบเรียบร้อยแล้ว');
        refresh();
      });
    }
  },

  openEditSupplier(id) {
    const s = _adminCache.suppliers.find((x) => x.supplier_id === id);
    const mb = $('#modalBox');
    if (!s || !mb) return;
    const empOpts = '<option value="">— ไม่ระบุ —</option>' +
      _adminCache.employees.map((e) => `<option value="${e.employee_id}" ${e.employee_id === s.employee_id ? 'selected' : ''}>#${e.employee_id} ${esc(e.first_name)} ${esc(e.last_name)}</option>`).join('');
    mb.innerHTML = `
      <button type="button" class="modal-close" onclick="A.closeModal()" aria-label="ปิด">✕</button>
      <h3 style="margin:0 0 14px">✏️ แก้ไขข้อมูลซัพพลายเออร์ #${s.supplier_id}</h3>
      <form onsubmit="return A.saveSupplierEdit(event, ${s.supplier_id})">
        <div class="row2">
          <div class="field"><label>ชื่อซัพพลายเออร์ *</label><input name="name" value="${esc(s.name)}" required></div>
          <div class="field"><label>ผู้ติดต่อ</label><input name="contact_name" value="${esc(s.contact_name || '')}"></div>
        </div>
        <div class="row2">
          <div class="field"><label>เบอร์โทรศัพท์</label><input name="phone" value="${esc(s.phone || '')}"></div>
          <div class="field"><label>อีเมล</label><input name="email" type="email" value="${esc(s.email || '')}"></div>
        </div>
        <div class="field"><label>ที่อยู่</label><textarea name="address" rows="2">${esc(s.address || '')}</textarea></div>
        <div class="field"><label>พนักงานดูแล (FK)</label><select name="employee_id">${empOpts}</select></div>
        <div class="actions" style="justify-content:flex-end;margin-top:8px">
          <button type="button" class="btn ghost sm" onclick="A.closeModal()">ยกเลิก</button>
          <button class="btn sm">💾 บันทึกการแก้ไข</button>
        </div>
      </form>
    `;
    $('#modal').classList.add('open');
  },
  saveSupplierEdit(e, id) {
    const d = formData(e);
    d.employee_id = d.employee_id ? Number(d.employee_id) : null;
    safe(async () => {
      await api('PUT', `/api/admin/suppliers/${id}`, d);
      A.closeModal();
      toast('อัปเดตข้อมูลซัพพลายเออร์เรียบร้อยแล้ว');
      refresh();
    });
    return false;
  },

  openEditEmployee(id) {
    const emp = _adminCache.employees.find((x) => x.employee_id === id);
    const mb = $('#modalBox');
    if (!emp || !mb) return;
    mb.innerHTML = `
      <button type="button" class="modal-close" onclick="A.closeModal()" aria-label="ปิด">✕</button>
      <h3 style="margin:0 0 14px">✏️ แก้ไขข้อมูลพนักงาน #${emp.employee_id}</h3>
      <form onsubmit="return A.saveEmployeeEdit(event, ${emp.employee_id})">
        <div class="row2">
          <div class="field"><label>ชื่อ *</label><input name="first_name" value="${esc(emp.first_name)}" required></div>
          <div class="field"><label>นามสกุล *</label><input name="last_name" value="${esc(emp.last_name)}" required></div>
        </div>
        <div class="row2">
          <div class="field"><label>ตำแหน่ง</label><input name="position" value="${esc(emp.position || '')}"></div>
          <div class="field"><label>เบอร์โทรศัพท์</label><input name="phone" value="${esc(emp.phone || '')}"></div>
        </div>
        <div class="field"><label>อีเมล</label><input name="email" type="email" value="${esc(emp.email || '')}"></div>
        <div class="field"><label>ที่อยู่</label><textarea name="address" rows="2">${esc(emp.address || '')}</textarea></div>
        <div class="actions" style="justify-content:flex-end;margin-top:8px">
          <button type="button" class="btn ghost sm" onclick="A.closeModal()">ยกเลิก</button>
          <button class="btn sm">💾 บันทึกการแก้ไข</button>
        </div>
      </form>
    `;
    $('#modal').classList.add('open');
  },
  saveEmployeeEdit(e, id) {
    const d = formData(e);
    safe(async () => {
      await api('PUT', `/api/admin/employees/${id}`, d);
      A.closeModal();
      toast('อัปเดตข้อมูลพนักงานเรียบร้อยแล้ว');
      refresh();
    });
    return false;
  },

  addCoupon(e) {
    const d = formData(e);
    safe(async () => {
      const r = await api('POST', '/api/admin/coupons', d);
      toast(`เพิ่มคูปอง "${r.code}" เรียบร้อยแล้ว`);
      refresh();
    });
    return false;
  },
  openEditCoupon(code) {
    const c = _adminCache.coupons.find((x) => x.code === code);
    const mb = $('#modalBox');
    if (!c || !mb) return;
    mb.innerHTML = `
      <button type="button" class="modal-close" onclick="A.closeModal()" aria-label="ปิด">✕</button>
      <h3 style="margin:0 0 14px">✏️ แก้ไขคูปอง <code>${esc(c.code)}</code></h3>
      <form onsubmit="return A.saveCouponEdit(event, ${JSON.stringify(c.code).replace(/"/g, '&quot;')})">
        <div class="row2">
          <div class="field">
            <label>ประเภทส่วนลด</label>
            <select name="type">
              <option value="percent" ${c.type === 'percent' ? 'selected' : ''}>เปอร์เซ็นต์ (%)</option>
              <option value="fixed" ${c.type === 'fixed' ? 'selected' : ''}>ลดจำนวนเงิน (฿)</option>
            </select>
          </div>
          <div class="field"><label>มูลค่าส่วนลด *</label><input name="value" type="number" min="1" step="1" value="${Number(c.value)}" required></div>
        </div>
        <div class="row2">
          <div class="field"><label>ยอดสั่งซื้อขั้นต่ำ (฿)</label><input name="min_total" type="number" min="0" step="1" value="${Number(c.min_total || 0)}"></div>
          <div class="field">
            <label>สถานะ</label>
            <select name="active">
              <option value="1" ${c.active ? 'selected' : ''}>เปิดใช้งาน</option>
              <option value="0" ${!c.active ? 'selected' : ''}>ปิดใช้งาน</option>
            </select>
          </div>
        </div>
        <div class="actions" style="justify-content:flex-end;margin-top:8px">
          <button type="button" class="btn ghost sm" onclick="A.closeModal()">ยกเลิก</button>
          <button class="btn sm">💾 บันทึกคูปอง</button>
        </div>
      </form>
    `;
    $('#modal').classList.add('open');
  },
  saveCouponEdit(e, code) {
    const d = formData(e);
    safe(async () => {
      await api('PUT', `/api/admin/coupons/${encodeURIComponent(code)}`, d);
      A.closeModal();
      toast(`อัปเดตคูปอง "${code}" เรียบร้อยแล้ว`);
      refresh();
    });
    return false;
  },
  deleteCoupon(code) {
    if (confirm(`ยืนยันการลบคูปอง "${code}"?`)) {
      safe(async () => {
        await api('DELETE', `/api/admin/coupons/${encodeURIComponent(code)}`);
        toast(`ลบคูปอง "${code}" เรียบร้อยแล้ว`);
        refresh();
      });
    }
  },

  /* ---------- SQL Server Realtime Studio Actions ---------- */
  selectSqlTable(name) {
    activeSqlTable = name;
    if (lastSqlSnapshot) {
      updateLiveSqlExplorerDom(lastSqlSnapshot);
    } else {
      A.refreshSqlSnapshot();
    }
  },

  async refreshSqlSnapshot() {
    try {
      const { snapshot } = await api('GET', '/api/sql/status');
      updateLiveSqlExplorerDom(snapshot);
      toast('อัปเดตข้อมูลตาราง SQL Server ล่าสุดแล้ว');
    } catch (e) {
      toast(e.message || 'ไม่สามารถดึงข้อมูล SQL ได้', true);
    }
  },

  setSqlQuery(sql) {
    const el = $('#sqlQueryInput');
    if (el) {
      el.value = sql;
      el.focus();
    }
  },

  runSqlQuery(e) {
    e.preventDefault();
    const sql = $('#sqlQueryInput')?.value || '';
    const meta = $('#sqlQueryMeta');
    const out = $('#sqlQueryResult');
    if (!sql.trim()) return toast('กรุณากรอกคำสั่ง SQL', true);
    if (meta) meta.textContent = '⏳ กำลังรันคำสั่ง SQL...';

    safe(async () => {
      const r = await api('POST', '/api/sql/query', { sql });
      if (r.snapshot) updateLiveSqlExplorerDom(r.snapshot);
      if (r.isSelect) {
        if (meta) meta.innerHTML = `✅ สำเร็จ (${r.rows.length} แถว · ${r.durationMs} ms)`;
        if (out) out.innerHTML = renderSqlGridHtml(r.rows, 'ผลลัพธ์คำสั่ง SELECT');
      } else {
        if (meta) meta.innerHTML = `✅ อัปเดตสำเร็จ (${r.changes} แถวที่เปลี่ยนแปลง · ${r.durationMs} ms · ซิงค์เข้า SQL Server แล้ว)`;
        if (out) out.innerHTML = `<div class="panel" style="background:var(--cream);margin:0"><b>ดำเนินการสำเร็จ:</b> กระทบข้อมูล ${r.changes} แถว และอัปเดตสคริปต์ <code>NoirCreamShop_SQLServer.sql</code> แบบ Realtime เรียบร้อยแล้ว</div>`;
        toast(`รันคำสั่ง SQL สำเร็จ (${r.changes} แถว)`);
      }
    });
    return false;
  },

  async copyPowerShellRealtime() {
    const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; irm 'https://raw.githubusercontent.com/sahapapsir-glitch/noir-cream-shop/main/sync-ssms-realtime.ps1' | iex"`;
    try {
      await navigator.clipboard.writeText(cmd);
      toast('คัดลอกคำสั่งเชื่อมต่อ .\\SQLEXPRESS01 แบบ Realtime แล้ว! นำไปวางใน PowerShell ได้เลย');
    } catch {
      prompt('คัดลอกคำสั่งด้านล่างไปวางในโปรแกรม Windows PowerShell:', cmd);
    }
  },

  async copySqlScript() {
    try {
      const res = await fetch('/api/sql/script');
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      toast('คัดลอกโค้ด SQL Server (ข้อมูลสดล่าสุด) เรียบร้อยแล้ว! นำไปวางใน New Query ของ SSMS ได้เลย');
    } catch (e) {
      toast('ไม่สามารถคัดลอกโค้ด SQL ได้ กรุณากดปุ่มดาวน์โหลดไฟล์ .sql แทน', true);
    }
  },

  downloadSqlScript() {
    window.open('/api/sql/script?download=1', '_blank');
    toast('กำลังดาวน์โหลดไฟล์ NoirCreamShop_SQLServer.sql ข้อมูลล่าสุด');
  },

  async refreshGitHubHeader(ghData) {
    try {
      const gh = ghData || (await api('GET', '/api/github/status')).github;
      const txt = $('#githubHeaderText');
      const tokBtn = $('#githubTokenBtn');
      if (tokBtn && gh) {
        if (gh.tokenSource === 'env') {
          tokBtn.innerHTML = '✅ Token ถาวร (Render Env)';
          tokBtn.title = 'เชื่อมต่อ Token จาก Render Environment ถาวรแล้ว ไม่ต้องกรอกซ้ำ';
        } else if (gh.tokenSource === 'file') {
          tokBtn.innerHTML = '⚠️ Token ชั่วคราว (ตั้งถาวร)';
          tokBtn.title = 'ตอนนี้ใช้ Token ชั่วคราว (จะหายเมื่อรีสตาร์ท Render) คลิกเพื่อดูวิธีตั้งแบบถาวร';
        } else {
          tokBtn.innerHTML = '🔑 ตั้งค่า GitHub Token';
        }
      }
      if (!txt || !gh) return;
      if (gh.syncing) {
        txt.innerHTML = '⏳ กำลังซิงค์ขึ้น GitHub...';
      } else if (gh.lastError) {
        txt.innerHTML = '⚠️ GitHub Sync ผิดพลาด (คลิกดู)';
      } else if (gh.lastCommitSha) {
        txt.innerHTML = `☁️ GitHub Synced (<code>${esc(gh.lastCommitSha)}</code>)`;
      } else if (gh.connected) {
        txt.innerHTML = '☁️ GitHub Auto-Sync (พร้อมใช้งาน)';
      } else {
        txt.innerHTML = '☁️ GitHub Sync (รอตั้งค่า Token)';
      }
    } catch {}
  },

  async syncGitHubNow() {
    const txt = $('#githubHeaderText');
    if (txt) txt.innerHTML = '⏳ กำลังซิงค์ขึ้น GitHub...';
    safe(async () => {
      try {
        const { github } = await api('POST', '/api/github/sync');
        A.refreshGitHubHeader(github);
        toast(`ซิงค์ข้อมูล (สินค้า/สต็อก/ลูกค้า) ขึ้น GitHub สำเร็จ!${github.lastCommitSha ? ` [${github.lastCommitSha}]` : ''}`);
      } catch (err) {
        A.refreshGitHubHeader();
        const msg = String(err.message || '');
        if (msg.includes('GITHUB_TOKEN') || msg.includes('GitHub API 401') || msg.includes('GitHub API 403') || msg.includes('GitHub API 404')) {
          toast(msg, true);
          A.setupGitHubToken();
        } else {
          throw err;
        }
      }
    });
  },

  async pullGitHubNow() {
    safe(async () => {
      const { restored, github } = await api('POST', '/api/github/pull');
      A.refreshGitHubHeader(github);
      if (restored?.restored) {
        toast(`ดึงข้อมูลล่าสุดจาก GitHub สำเร็จ! (${restored.checksum})`);
        route();
      } else {
        toast('ข้อมูลบนเว็บตรงกับ GitHub ล่าสุดอยู่แล้ว');
      }
    });
  },

  async setupGitHubToken() {
    let gh = {};
    try { gh = (await api('GET', '/api/github/status')).github || {}; } catch {}
    $('#ghTokenModal')?.remove();
    const createUrl = 'https://github.com/settings/tokens/new?scopes=repo&description=NoirCreamShop+AutoSync';
    const modal = document.createElement('div');
    modal.id = 'ghTokenModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(20,20,20,.6);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';
    const statusText = gh.tokenSource === 'env'
      ? '✅ เชื่อมต่อถาวรจาก Render Environment (<code>GITHUB_TOKEN</code>) แล้ว — ไม่ต้องกรอกซ้ำเมื่อรีเว็บ'
      : gh.tokenSource === 'file'
        ? '⚠️ ใช้ Token ชั่วคราวจากหน้าเว็บ (<b>จะหายเมื่อกด Deploy/รีสตาร์ท Render</b> — แนะนำให้นำไปใส่ใน Render → Environment → <code>GITHUB_TOKEN</code> เพื่อใช้ถาวร)'
        : (gh.connected ? `✅ เชื่อมต่อแล้ว (${esc(gh.mode)})` : '⚠️ ยังไม่ได้ตั้งค่า Token บนเซิร์ฟเวอร์นี้');
    modal.innerHTML = `
      <div class="box" style="max-width:540px;width:100%;padding:24px;position:relative;max-height:90vh;overflow:auto">
        <button type="button" onclick="$('#ghTokenModal')?.remove()" style="position:absolute;top:12px;right:14px;border:none;background:none;font-size:20px;cursor:pointer">✕</button>
        <h3 style="margin:0 0 8px">☁️ ตั้งค่า GitHub Auto-Sync</h3>
        <p class="muted" style="margin:0 0 12px;font-size:13px">
          สถานะปัจจุบัน: ${statusText}
          ${gh.lastCommitSha ? ` · Commit ล่าสุด: <code>${esc(gh.lastCommitSha)}</code>` : ''}
        </p>
        ${gh.lastError ? `<div style="background:#fff5f5;border:1px solid #f5c2c7;color:#842029;padding:8px 10px;border-radius:8px;font-size:12px;margin-bottom:12px">ข้อผิดพลาดล่าสุด: ${esc(gh.lastError)}</div>` : ''}
        <div style="background:var(--cream,#FAF7F2);padding:12px;border-radius:10px;margin-bottom:14px;font-size:13px;line-height:1.6">
          <b>วิธีตั้งค่าแบบถาวร (ใส่ครั้งเดียว ไม่ต้องกรอกซ้ำหลังรีเว็บ):</b><br>
          1. เปิด <b>Render Dashboard</b> → โปรเจกต์ <code>noir-cream-shop</code> → แท็บ <b>Environment</b><br>
          2. กด <b>+ Add Environment Variable</b> ใส่ KEY: <code>GITHUB_TOKEN</code> และ VALUE เป็น Token ของคุณ<br>
          3. กด <b>Save, rebuild, and deploy</b><br>
          <span class="muted">(หากใส่ผ่านช่องด้านล่างจะเป็นแบบชั่วคราว ใช้ได้ทันทีแต่จะถูกล้างเมื่อรีสตาร์ท Render)</span>
          <div style="margin-top:8px">
            <a href="${createUrl}" target="_blank" rel="noopener" class="btn sm" style="display:inline-flex;align-items:center;gap:6px">🔗 เปิดหน้าสร้าง GitHub Token (ตั้งสิทธิ์ให้อัตโนมัติ)</a>
          </div>
        </div>
        <label style="display:block;font-size:13px;font-weight:500;margin-bottom:6px">GitHub Personal Access Token (สำหรับใช้งานทันทีรอบนี้)</label>
        <input id="ghTokenInput" type="password" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx หรือ github_pat_..." style="width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:8px;margin-bottom:14px;font-family:monospace">
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:space-between">
          <button type="button" class="btn ghost sm" onclick="A.pullGitHubNow()">⬇️ ดึงข้อมูลล่าสุดจาก GitHub</button>
          <div style="display:flex;gap:8px">
            <button type="button" class="btn ghost sm" onclick="$('#ghTokenModal')?.remove()">ปิด</button>
            <button type="button" class="btn sm" onclick="A.saveGitHubTokenFromModal()">💾 บันทึก &amp; ซิงค์ทันที</button>
          </div>
        </div>
      </div>
    `;
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
    $('#ghTokenInput')?.focus();
  },

  async saveGitHubTokenFromModal() {
    const token = ($('#ghTokenInput')?.value || '').trim();
    if (!token) {
      toast('กรุณาวาง GitHub Token ก่อนกดบันทึก', true);
      return;
    }
    safe(async () => {
      const { github } = await api('POST', '/api/github/token', { token });
      A.refreshGitHubHeader(github);
      $('#ghTokenModal')?.remove();
      toast(`ตั้งค่า GitHub Token และซิงค์ฐานข้อมูลสำเร็จ!${github.lastCommitSha ? ` [${github.lastCommitSha}]` : ''}`);
    });
  },

  filterCustomers() {
    const q = ($('#custSearch')?.value || '').trim().toLowerCase();
    $$('[data-cust-row]').forEach((tr) => {
      tr.style.display = !q || tr.dataset.custRow.includes(q) ? '' : 'none';
    });
  }
};

/* ---------- Realtime SQL Server SSE Stream ---------- */
let sqlEventSource = null;

function initRealtimeSqlStream() {
  if (typeof EventSource === 'undefined' || sqlEventSource) return;
  try {
    sqlEventSource = new EventSource('/api/sql/stream');
    sqlEventSource.addEventListener('github_status', (ev) => {
      try {
        const gh = JSON.parse(ev.data || '{}');
        A.refreshGitHubHeader(gh);
        const pill = $('#githubHeaderPill');
        if (gh.lastCommitSha && pill) {
          pill.classList.remove('flash');
          void pill.offsetWidth;
          pill.classList.add('flash');
        }
      } catch {}
    });
    sqlEventSource.addEventListener('db_change', async (ev) => {
      try {
        const data = JSON.parse(ev.data || '{}');
        const pill = $('#sqlHeaderPill');
        if (pill) {
          pill.classList.remove('flash');
          void pill.offsetWidth;
          pill.classList.add('flash');
        }
        // หากเปิดหน้า SQL Server (Realtime) อยู่ ให้ดึง Snapshot ใหม่มาแสดงผลทันทีโดยไม่ต้องรีเฟรชหน้า
        if (location.hash.startsWith('#/admin') && adminTab === 'sql') {
          const { snapshot } = await api('GET', '/api/sql/status');
          updateLiveSqlExplorerDom(snapshot);
        } else if (location.hash.startsWith('#/admin') && ['customers', 'orders', 'dash', 'suppliers'].includes(adminTab)) {
          const activeTag = document.activeElement?.tagName;
          if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag) && !$('#modal')?.classList.contains('open')) {
            await adminTabs[adminTab]?.();
          }
        } else if (data.source === 'ssms') {
          // หากเป็นการแก้ไขมาจากโปรแกรม SSMS บนเครื่อง ให้รีเฟรชหน้าเว็บอัตโนมัติ
          await loadCart();
          route();
          toast('🔄 ซิงค์ข้อมูลล่าสุดจาก SQL Server (SSMS) แบบ Realtime แล้ว');
        }
      } catch { /* ignore parse error */ }
    });
  } catch { /* ignore SSE error */ }
}

/* ---------- Smooth Animations & Visual Effects Engine ---------- */
let revealObserver = null;

function initScrollReveal() {
  if (revealObserver) revealObserver.disconnect();
  const targets = $$('.cat, .perk, .card, .policy-card, .review, .stat, .panel, .section-head', app);
  if (!('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });

  // Group siblings for smooth staggered delay
  targets.forEach((el, idx) => {
    el.classList.add('reveal-item');
    const sibIndex = [...(el.parentElement?.children || [])].indexOf(el);
    const delay = Math.min(Math.max(0, sibIndex) * 55, 330);
    el.style.setProperty('--reveal-delay', `${delay}ms`);
    revealObserver.observe(el);
  });
}

function spawnParticles(anchorEl, symbols = ['✦', '•', '✧']) {
  if (!anchorEl) return;
  const rect = anchorEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const count = 8;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = 'fx-particle';
    p.textContent = symbols[i % symbols.length];
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
    const dist = 34 + Math.random() * 34;
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist - 18;
    const rot = (Math.random() - 0.5) * 90;
    p.style.left = `${cx}px`;
    p.style.top = `${cy}px`;
    p.style.setProperty('--tx', `${tx.toFixed(1)}px`);
    p.style.setProperty('--ty', `${ty.toFixed(1)}px`);
    p.style.setProperty('--rot', `${rot.toFixed(0)}deg`);
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 780);
  }
}

function flyToCart(sourceEl) {
  const cartLink = $('#actions a[href="#/cart"]');
  if (!sourceEl || !cartLink) return;
  const sRect = sourceEl.getBoundingClientRect();
  const cRect = cartLink.getBoundingClientRect();
  const clone = document.createElement('div');
  clone.className = 'fly-clone';
  const size = 64;
  clone.style.width = `${size}px`;
  clone.style.height = `${size}px`;
  clone.style.left = `${sRect.left + sRect.width / 2 - size / 2}px`;
  clone.style.top = `${sRect.top + sRect.height / 2 - size / 2}px`;
  clone.innerHTML = sourceEl.innerHTML;
  document.body.appendChild(clone);

  requestAnimationFrame(() => {
    const dx = (cRect.left + cRect.width / 2) - (sRect.left + sRect.width / 2);
    const dy = (cRect.top + cRect.height / 2) - (sRect.top + sRect.height / 2);
    clone.style.transform = `translate(${dx}px, ${dy}px) scale(0.2) rotate(12deg)`;
    clone.style.opacity = '0.15';
  });
  setTimeout(() => clone.remove(), 700);
}

function animateCounters() {
  $$('[data-count]').forEach((el) => {
    const target = Number(el.dataset.count) || 0;
    const isMoney = el.dataset.money === '1';
    const dur = 650;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = Math.round(target * eased);
      el.textContent = isMoney ? money(val) : val.toLocaleString('th-TH');
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

// Click ripple wave on interactive buttons/chips
document.addEventListener('pointerdown', (e) => {
  const btn = e.target.closest('.btn, .chip, .size, .like-btn');
  if (!btn || btn.disabled) return;
  const rect = btn.getBoundingClientRect();
  const wave = document.createElement('span');
  wave.className = 'ripple-wave';
  const d = Math.max(rect.width, rect.height);
  wave.style.width = wave.style.height = `${d}px`;
  wave.style.left = `${e.clientX - rect.left - d / 2}px`;
  wave.style.top = `${e.clientY - rect.top - d / 2}px`;
  btn.appendChild(wave);
  setTimeout(() => wave.remove(), 680);
});

// Interactive spotlight cursor tracking on cards, categories, and hero
document.addEventListener('pointermove', (e) => {
  const box = e.target.closest('.card, .cat, .hero');
  if (!box) return;
  const r = box.getBoundingClientRect();
  box.style.setProperty('--mouse-x', `${e.clientX - r.left}px`);
  box.style.setProperty('--mouse-y', `${e.clientY - r.top}px`);
}, { passive: true });

// Scroll progress bar & sticky header elevation
window.addEventListener('scroll', () => {
  const doc = document.documentElement;
  const scrollTop = doc.scrollTop || document.body.scrollTop;
  const scrollHeight = doc.scrollHeight - doc.clientHeight;
  const bar = $('#scrollProgress');
  if (bar) {
    bar.style.width = scrollHeight > 0 ? `${(scrollTop / scrollHeight) * 100}%` : '0%';
  }
  const hdr = $('.site-header');
  if (hdr) hdr.classList.toggle('scrolled', scrollTop > 12);
}, { passive: true });

/* ---------- Router ---------- */
async function route() {
  const raw = location.hash.slice(1) || '/';
  const [path, qs] = raw.split('?');
  const params = new URLSearchParams(qs || '');
  const parts = path.split('/').filter(Boolean);
  const name = parts[0] || 'home';
  const page = pages[name];
  window.scrollTo(0, 0);

  if (!page) {
    app.innerHTML = '<div class="empty"><h3>ไม่พบหน้านี้</h3><a class="btn" style="margin-top:12px" href="#/">กลับหน้าแรก</a></div>';
    renderChrome();
    return;
  }
  try {
    await page(params, parts[1]);
    app.classList.remove('page-enter');
    void app.offsetWidth;
    app.classList.add('page-enter');
    renderChrome();
    initScrollReveal();
  } catch (e) {
    if (e.status === 401) return go('#/login');
    app.innerHTML = `<div class="empty"><h3>เกิดข้อผิดพลาด</h3><p class="muted">${esc(e.message)}</p><a class="btn" style="margin-top:12px" href="#/">กลับหน้าแรก</a></div>`;
    renderChrome();
  }
}

window.addEventListener('hashchange', route);

/* ---------- App Initialization ---------- */
(async function init() {
  try { state.config = await api('GET', '/api/config'); } catch { /* defaults */ }
  try { state.user = (await api('GET', '/api/me')).user; } catch { /* guest */ }
  await loadCart();
  initRealtimeSqlStream();
  route();
})();
