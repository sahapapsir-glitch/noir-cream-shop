const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const SQL_FILE_PATH = path.join(__dirname, 'NoirCreamShop_SQLServer.sql');
const DEFAULT_INSTANCE = process.env.MSSQL_SERVER || '.\\SQLEXPRESS01';
const DATABASE_NAME = process.env.MSSQL_DATABASE || 'NoirCreamShop';

// ลำดับตารางเรียงตาม Foreign Key Dependency (Parent -> Child)
const TABLE_SCHEMAS = [
  {
    name: 'admin',
    sqlName: 'dbo.admin',
    identity: 'admin_id',
    columns: ['admin_id', 'name', 'email', 'phone', 'password_hash'],
    types: { admin_id: 'int', name: 'nvarchar', email: 'nvarchar', phone: 'nvarchar', password_hash: 'nvarchar' }
  },
  {
    name: 'employee',
    sqlName: 'dbo.employee',
    identity: 'employee_id',
    columns: ['employee_id', 'first_name', 'last_name', 'email', 'phone', 'position', 'address'],
    types: { employee_id: 'int', first_name: 'nvarchar', last_name: 'nvarchar', email: 'nvarchar', phone: 'nvarchar', position: 'nvarchar', address: 'nvarchar' }
  },
  {
    name: 'coupon',
    sqlName: 'dbo.coupon',
    identity: null,
    columns: ['code', 'type', 'value', 'min_total', 'active'],
    types: { code: 'nvarchar', type: 'nvarchar', value: 'decimal', min_total: 'decimal', active: 'bit' }
  },
  {
    name: 'supplier',
    sqlName: 'dbo.supplier',
    identity: 'supplier_id',
    columns: ['supplier_id', 'name', 'contact_name', 'phone', 'email', 'address', 'employee_id', 'admin_id'],
    types: { supplier_id: 'int', name: 'nvarchar', contact_name: 'nvarchar', phone: 'nvarchar', email: 'nvarchar', address: 'nvarchar', employee_id: 'int', admin_id: 'int' }
  },
  {
    name: 'customer',
    sqlName: 'dbo.customer',
    identity: 'customer_id',
    columns: ['customer_id', 'first_name', 'last_name', 'phone', 'email', 'address', 'admin_id', 'password_hash', 'created_at'],
    types: { customer_id: 'int', first_name: 'nvarchar', last_name: 'nvarchar', phone: 'nvarchar', email: 'nvarchar', address: 'nvarchar', admin_id: 'int', password_hash: 'nvarchar', created_at: 'datetime' }
  },
  {
    name: 'address',
    sqlName: 'dbo.address',
    identity: 'address_id',
    columns: ['address_id', 'customer_id', 'recipient', 'phone', 'house_no', 'village', 'road', 'subdistrict', 'district', 'province', 'postal_code', 'is_default'],
    types: { address_id: 'int', customer_id: 'int', recipient: 'nvarchar', phone: 'nvarchar', house_no: 'nvarchar', village: 'nvarchar', road: 'nvarchar', subdistrict: 'nvarchar', district: 'nvarchar', province: 'nvarchar', postal_code: 'nvarchar', is_default: 'bit' }
  },
  {
    name: 'product',
    sqlName: 'dbo.product',
    identity: 'product_id',
    columns: ['product_id', 'name', 'category', 'description', 'status', 'stock', 'quantity', 'price', 'supplier_id', 'employee_id', 'image_url', 'is_featured', 'created_at'],
    types: { product_id: 'int', name: 'nvarchar', category: 'nvarchar', description: 'nvarchar', status: 'nvarchar', stock: 'int', quantity: 'int', price: 'decimal', supplier_id: 'int', employee_id: 'int', image_url: 'nvarchar', is_featured: 'bit', created_at: 'datetime' }
  },
  {
    name: 'product_variant',
    sqlName: 'dbo.product_variant',
    identity: 'variant_id',
    columns: ['variant_id', 'product_id', 'size', 'color', 'color_hex', 'price', 'stock', 'stock_quantity', 'sku'],
    types: { variant_id: 'int', product_id: 'int', size: 'nvarchar', color: 'nvarchar', color_hex: 'nvarchar', price: 'decimal', stock: 'int', stock_quantity: 'int', sku: 'nvarchar' }
  },
  {
    name: 'cart_item',
    sqlName: 'dbo.cart_item',
    identity: 'cart_id',
    columns: ['cart_id', 'customer_id', 'variant_id', 'product_id', 'quantity', 'total_price'],
    types: { cart_id: 'int', customer_id: 'int', variant_id: 'int', product_id: 'int', quantity: 'int', total_price: 'decimal' }
  },
  {
    name: 'order',
    sqlName: 'dbo.[order]',
    identity: 'order_id',
    columns: ['order_id', 'customer_id', 'product_id', 'order_date', 'status', 'subtotal', 'discount', 'shipping_fee', 'total_price', 'coupon_code', 'ship_name', 'ship_phone', 'ship_address'],
    types: { order_id: 'int', customer_id: 'int', product_id: 'int', order_date: 'datetime', status: 'nvarchar', subtotal: 'decimal', discount: 'decimal', shipping_fee: 'decimal', total_price: 'decimal', coupon_code: 'nvarchar', ship_name: 'nvarchar', ship_phone: 'nvarchar', ship_address: 'nvarchar' }
  },
  {
    name: 'order_item',
    sqlName: 'dbo.order_item',
    identity: 'order_item_id',
    columns: ['order_item_id', 'order_id', 'variant_id', 'product_id', 'quantity', 'unit_price', 'total_price'],
    types: { order_item_id: 'int', order_id: 'int', variant_id: 'int', product_id: 'int', quantity: 'int', unit_price: 'decimal', total_price: 'decimal' }
  },
  {
    name: 'payment',
    sqlName: 'dbo.payment',
    identity: 'payment_id',
    columns: ['payment_id', 'order_id', 'method', 'status', 'amount', 'paid_at'],
    types: { payment_id: 'int', order_id: 'int', method: 'nvarchar', status: 'nvarchar', amount: 'decimal', paid_at: 'datetime' }
  },
  {
    name: 'shipment',
    sqlName: 'dbo.shipment',
    identity: 'shipment_id',
    columns: ['shipment_id', 'tracking_no', 'payment_id', 'order_id', 'product_id', 'carrier', 'status', 'shipping_address', 'shipped_at'],
    types: { shipment_id: 'int', tracking_no: 'nvarchar', payment_id: 'int', order_id: 'int', product_id: 'int', carrier: 'nvarchar', status: 'nvarchar', shipping_address: 'nvarchar', shipped_at: 'datetime' }
  },
  {
    name: 'review',
    sqlName: 'dbo.review',
    identity: 'review_id',
    columns: ['review_id', 'customer_id', 'product_id', 'first_name', 'last_name', 'rating', 'comment', 'review_date', 'created_at'],
    types: { review_id: 'int', customer_id: 'int', product_id: 'int', first_name: 'nvarchar', last_name: 'nvarchar', rating: 'int', comment: 'nvarchar', review_date: 'nvarchar', created_at: 'datetime' }
  },
  {
    name: 'wishlist',
    sqlName: 'dbo.wishlist',
    identity: null,
    columns: ['customer_id', 'product_id'],
    types: { customer_id: 'int', product_id: 'int' }
  },
  {
    name: 'review_like',
    sqlName: 'dbo.review_like',
    identity: null,
    columns: ['customer_id', 'review_id', 'created_at'],
    types: { customer_id: 'int', review_id: 'int', created_at: 'datetime' }
  }
];

function formatSqlValue(val, type) {
  if (val === null || val === undefined) return 'NULL';
  if (type === 'bit') return val ? '1' : '0';
  if (type === 'int' || type === 'decimal') {
    const n = Number(val);
    return Number.isFinite(n) ? String(n) : '0';
  }
  if (type === 'datetime') {
    const s = String(val).trim();
    if (!s) return 'NULL';
    return `'${s.replace(/'/g, "''")}'`;
  }
  return `N'${String(val).replace(/'/g, "''")}'`;
}

function normalizeDateStr(val) {
  if (val === null || val === undefined || val === '') return null;
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s)) {
    return s.slice(0, 19).replace('T', ' ');
  }
  return s;
}

function getSnapshot(db) {
  const tables = {};
  const counts = {};
  for (const t of TABLE_SCHEMAS) {
    const orderCol = t.identity || t.columns[0];
    const rows = db.prepare(`SELECT ${t.columns.join(', ')} FROM "${t.name}" ORDER BY ${orderCol}`).all();
    tables[t.name] = rows;
    counts[t.name] = rows.length;
  }
  const views = {
    Orders: db.prepare('SELECT * FROM Orders ORDER BY order_id').all(),
    Order_Detail: db.prepare('SELECT * FROM Order_Detail ORDER BY order_detail_id').all()
  };
  const checksum = crypto.createHash('sha256').update(JSON.stringify(tables)).digest('hex').slice(0, 16);
  return {
    instance: DEFAULT_INSTANCE,
    database: DATABASE_NAME,
    timestamp: new Date().toISOString(),
    checksum,
    counts,
    tables,
    views
  };
}

function generateSqlServerScript(db, snapshot = null) {
  const snap = snapshot || getSnapshot(db);
  const lines = [];

  lines.push(`-- ============================================================================`);
  lines.push(`-- NOIR & CREAM CLOTHING SHOP — REALTIME MICROSOFT SQL SERVER DATABASE`);
  lines.push(`-- Instance: ${DEFAULT_INSTANCE} | Database: [${DATABASE_NAME}]`);
  lines.push(`-- Checksum: ${snap.checksum} | Updated: ${snap.timestamp}`);
  lines.push(`-- Compatible with: Microsoft SQL Server 2017+, 2022, 2025 & SSMS 20/21/22`);
  lines.push(`-- ============================================================================`);
  lines.push(``);
  lines.push(`USE master;`);
  lines.push(`GO`);
  lines.push(``);
  lines.push(`IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'${DATABASE_NAME}')`);
  lines.push(`BEGIN`);
  lines.push(`    CREATE DATABASE [${DATABASE_NAME}] COLLATE Thai_100_CI_AS;`);
  lines.push(`END`);
  lines.push(`GO`);
  lines.push(``);
  lines.push(`USE [${DATABASE_NAME}];`);
  lines.push(`GO`);
  lines.push(``);
  lines.push(`-- ============================================================================`);
  lines.push(`-- 1. CREATE TABLES (16 TABLES MATCHING ER DIAGRAM & DATA DICTIONARY)`);
  lines.push(`-- ============================================================================`);
  lines.push(`IF OBJECT_ID('dbo.employee', 'U') IS NULL`);
  lines.push(`BEGIN`);
  lines.push(`    CREATE TABLE dbo.employee (`);
  lines.push(`        employee_id INT IDENTITY(1,1) PRIMARY KEY,`);
  lines.push(`        first_name  NVARCHAR(60) NOT NULL,`);
  lines.push(`        last_name   NVARCHAR(60) NOT NULL,`);
  lines.push(`        email       NVARCHAR(120),`);
  lines.push(`        phone       NVARCHAR(20),`);
  lines.push(`        position    NVARCHAR(80),`);
  lines.push(`        address     NVARCHAR(300)`);
  lines.push(`    );`);
  lines.push(`END`);
  lines.push(`GO`);
  lines.push(``);
  lines.push(`IF OBJECT_ID('dbo.admin', 'U') IS NULL`);
  lines.push(`BEGIN`);
  lines.push(`    CREATE TABLE dbo.admin (`);
  lines.push(`        admin_id      INT IDENTITY(1,1) PRIMARY KEY,`);
  lines.push(`        name          NVARCHAR(100) NOT NULL,`);
  lines.push(`        email         NVARCHAR(120) NOT NULL UNIQUE,`);
  lines.push(`        phone         NVARCHAR(20),`);
  lines.push(`        password_hash NVARCHAR(255) NOT NULL`);
  lines.push(`    );`);
  lines.push(`END`);
  lines.push(`GO`);
  lines.push(``);
  lines.push(`IF OBJECT_ID('dbo.supplier', 'U') IS NULL`);
  lines.push(`BEGIN`);
  lines.push(`    CREATE TABLE dbo.supplier (`);
  lines.push(`        supplier_id  INT IDENTITY(1,1) PRIMARY KEY,`);
  lines.push(`        name         NVARCHAR(120) NOT NULL,`);
  lines.push(`        contact_name NVARCHAR(80),`);
  lines.push(`        phone        NVARCHAR(20),`);
  lines.push(`        email        NVARCHAR(120),`);
  lines.push(`        address      NVARCHAR(300),`);
  lines.push(`        employee_id  INT NULL FOREIGN KEY REFERENCES dbo.employee(employee_id),`);
  lines.push(`        admin_id     INT NULL FOREIGN KEY REFERENCES dbo.admin(admin_id)`);
  lines.push(`    );`);
  lines.push(`END`);
  lines.push(`GO`);
  lines.push(``);
  lines.push(`IF OBJECT_ID('dbo.product', 'U') IS NULL`);
  lines.push(`BEGIN`);
  lines.push(`    CREATE TABLE dbo.product (`);
  lines.push(`        product_id  INT IDENTITY(1,1) PRIMARY KEY,`);
  lines.push(`        name        NVARCHAR(150) NOT NULL,`);
  lines.push(`        category    NVARCHAR(60) NOT NULL,`);
  lines.push(`        description NVARCHAR(MAX),`);
  lines.push(`        status      NVARCHAR(20) NOT NULL DEFAULT 'active',`);
  lines.push(`        stock       INT NOT NULL DEFAULT 0,`);
  lines.push(`        quantity    INT NOT NULL DEFAULT 0,`);
  lines.push(`        price       DECIMAL(10,2) NOT NULL DEFAULT 0,`);
  lines.push(`        supplier_id INT NULL FOREIGN KEY REFERENCES dbo.supplier(supplier_id),`);
  lines.push(`        employee_id INT NULL FOREIGN KEY REFERENCES dbo.employee(employee_id),`);
  lines.push(`        image_url   NVARCHAR(500),`);
  lines.push(`        is_featured BIT NOT NULL DEFAULT 0,`);
  lines.push(`        created_at  DATETIME2 NOT NULL DEFAULT GETDATE()`);
  lines.push(`    );`);
  lines.push(`END`);
  lines.push(`GO`);
  lines.push(``);
  lines.push(`IF OBJECT_ID('dbo.product_variant', 'U') IS NULL`);
  lines.push(`BEGIN`);
  lines.push(`    CREATE TABLE dbo.product_variant (`);
  lines.push(`        variant_id     INT IDENTITY(1,1) PRIMARY KEY,`);
  lines.push(`        product_id     INT NOT NULL FOREIGN KEY REFERENCES dbo.product(product_id) ON DELETE CASCADE,`);
  lines.push(`        size           NVARCHAR(20) NOT NULL,`);
  lines.push(`        color          NVARCHAR(40) NOT NULL,`);
  lines.push(`        color_hex      NVARCHAR(20),`);
  lines.push(`        price          DECIMAL(10,2) NOT NULL,`);
  lines.push(`        stock          INT NOT NULL DEFAULT 0,`);
  lines.push(`        stock_quantity INT NOT NULL DEFAULT 0,`);
  lines.push(`        sku            NVARCHAR(60) UNIQUE`);
  lines.push(`    );`);
  lines.push(`END`);
  lines.push(`GO`);
  lines.push(``);
  lines.push(`IF OBJECT_ID('dbo.customer', 'U') IS NULL`);
  lines.push(`BEGIN`);
  lines.push(`    CREATE TABLE dbo.customer (`);
  lines.push(`        customer_id   INT IDENTITY(1,1) PRIMARY KEY,`);
  lines.push(`        first_name    NVARCHAR(60) NOT NULL,`);
  lines.push(`        last_name     NVARCHAR(60) NOT NULL,`);
  lines.push(`        phone         NVARCHAR(20),`);
  lines.push(`        email         NVARCHAR(120) NOT NULL UNIQUE,`);
  lines.push(`        address       NVARCHAR(500),`);
  lines.push(`        admin_id      INT NULL FOREIGN KEY REFERENCES dbo.admin(admin_id),`);
  lines.push(`        password_hash NVARCHAR(255) NOT NULL,`);
  lines.push(`        created_at    DATETIME2 NOT NULL DEFAULT GETDATE()`);
  lines.push(`    );`);
  lines.push(`END`);
  lines.push(`GO`);
  lines.push(``);
  lines.push(`IF OBJECT_ID('dbo.address', 'U') IS NULL`);
  lines.push(`BEGIN`);
  lines.push(`    CREATE TABLE dbo.address (`);
  lines.push(`        address_id  INT IDENTITY(1,1) PRIMARY KEY,`);
  lines.push(`        customer_id INT NOT NULL FOREIGN KEY REFERENCES dbo.customer(customer_id) ON DELETE CASCADE,`);
  lines.push(`        recipient   NVARCHAR(100),`);
  lines.push(`        phone       NVARCHAR(20),`);
  lines.push(`        house_no    NVARCHAR(100),`);
  lines.push(`        village     NVARCHAR(150),`);
  lines.push(`        road        NVARCHAR(150),`);
  lines.push(`        subdistrict NVARCHAR(100),`);
  lines.push(`        district    NVARCHAR(100),`);
  lines.push(`        province    NVARCHAR(100),`);
  lines.push(`        postal_code NVARCHAR(10),`);
  lines.push(`        is_default  BIT NOT NULL DEFAULT 0`);
  lines.push(`    );`);
  lines.push(`END`);
  lines.push(`GO`);
  lines.push(``);
  lines.push(`IF OBJECT_ID('dbo.cart_item', 'U') IS NULL`);
  lines.push(`BEGIN`);
  lines.push(`    CREATE TABLE dbo.cart_item (`);
  lines.push(`        cart_id     INT IDENTITY(1,1) PRIMARY KEY,`);
  lines.push(`        customer_id INT NOT NULL FOREIGN KEY REFERENCES dbo.customer(customer_id) ON DELETE CASCADE,`);
  lines.push(`        variant_id  INT NOT NULL FOREIGN KEY REFERENCES dbo.product_variant(variant_id) ON DELETE CASCADE,`);
  lines.push(`        product_id  INT NULL FOREIGN KEY REFERENCES dbo.product(product_id),`);
  lines.push(`        quantity    INT NOT NULL DEFAULT 1,`);
  lines.push(`        total_price DECIMAL(10,2) NOT NULL DEFAULT 0,`);
  lines.push(`        CONSTRAINT UQ_Cart_Customer_Variant UNIQUE (customer_id, variant_id)`);
  lines.push(`    );`);
  lines.push(`END`);
  lines.push(`GO`);
  lines.push(``);
  lines.push(`IF OBJECT_ID('dbo.coupon', 'U') IS NULL`);
  lines.push(`BEGIN`);
  lines.push(`    CREATE TABLE dbo.coupon (`);
  lines.push(`        code      NVARCHAR(30) PRIMARY KEY,`);
  lines.push(`        type      NVARCHAR(20) NOT NULL,`);
  lines.push(`        value     DECIMAL(10,2) NOT NULL,`);
  lines.push(`        min_total DECIMAL(10,2) NOT NULL DEFAULT 0,`);
  lines.push(`        active    BIT NOT NULL DEFAULT 1`);
  lines.push(`    );`);
  lines.push(`END`);
  lines.push(`GO`);
  lines.push(``);
  lines.push(`IF OBJECT_ID('dbo.[order]', 'U') IS NULL`);
  lines.push(`BEGIN`);
  lines.push(`    CREATE TABLE dbo.[order] (`);
  lines.push(`        order_id     INT IDENTITY(1,1) PRIMARY KEY,`);
  lines.push(`        customer_id  INT NOT NULL FOREIGN KEY REFERENCES dbo.customer(customer_id),`);
  lines.push(`        product_id   INT NULL FOREIGN KEY REFERENCES dbo.product(product_id),`);
  lines.push(`        order_date   DATETIME2 NOT NULL DEFAULT GETDATE(),`);
  lines.push(`        status       NVARCHAR(30) NOT NULL DEFAULT 'pending',`);
  lines.push(`        subtotal     DECIMAL(10,2) NOT NULL DEFAULT 0,`);
  lines.push(`        discount     DECIMAL(10,2) NOT NULL DEFAULT 0,`);
  lines.push(`        shipping_fee DECIMAL(10,2) NOT NULL DEFAULT 0,`);
  lines.push(`        total_price  DECIMAL(10,2) NOT NULL DEFAULT 0,`);
  lines.push(`        coupon_code  NVARCHAR(30),`);
  lines.push(`        ship_name    NVARCHAR(80),`);
  lines.push(`        ship_phone   NVARCHAR(20),`);
  lines.push(`        ship_address NVARCHAR(300)`);
  lines.push(`    );`);
  lines.push(`END`);
  lines.push(`GO`);
  lines.push(``);
  lines.push(`IF OBJECT_ID('dbo.order_item', 'U') IS NULL`);
  lines.push(`BEGIN`);
  lines.push(`    CREATE TABLE dbo.order_item (`);
  lines.push(`        order_item_id INT IDENTITY(1,1) PRIMARY KEY,`);
  lines.push(`        order_id      INT NOT NULL FOREIGN KEY REFERENCES dbo.[order](order_id) ON DELETE CASCADE,`);
  lines.push(`        variant_id    INT NOT NULL FOREIGN KEY REFERENCES dbo.product_variant(variant_id),`);
  lines.push(`        product_id    INT NULL FOREIGN KEY REFERENCES dbo.product(product_id),`);
  lines.push(`        quantity      INT NOT NULL,`);
  lines.push(`        unit_price    DECIMAL(10,2) NOT NULL,`);
  lines.push(`        total_price   DECIMAL(10,2) NOT NULL DEFAULT 0`);
  lines.push(`    );`);
  lines.push(`END`);
  lines.push(`GO`);
  lines.push(``);
  lines.push(`IF OBJECT_ID('dbo.payment', 'U') IS NULL`);
  lines.push(`BEGIN`);
  lines.push(`    CREATE TABLE dbo.payment (`);
  lines.push(`        payment_id INT IDENTITY(1,1) PRIMARY KEY,`);
  lines.push(`        order_id   INT NOT NULL FOREIGN KEY REFERENCES dbo.[order](order_id) ON DELETE CASCADE,`);
  lines.push(`        method     NVARCHAR(60) NOT NULL,`);
  lines.push(`        status     NVARCHAR(30) NOT NULL DEFAULT 'pending',`);
  lines.push(`        amount     DECIMAL(10,2) NOT NULL,`);
  lines.push(`        paid_at    DATETIME2 NULL`);
  lines.push(`    );`);
  lines.push(`END`);
  lines.push(`GO`);
  lines.push(``);
  lines.push(`IF OBJECT_ID('dbo.shipment', 'U') IS NULL`);
  lines.push(`BEGIN`);
  lines.push(`    CREATE TABLE dbo.shipment (`);
  lines.push(`        shipment_id      INT IDENTITY(1,1) PRIMARY KEY,`);
  lines.push(`        tracking_no      NVARCHAR(60),`);
  lines.push(`        payment_id       INT NOT NULL FOREIGN KEY REFERENCES dbo.payment(payment_id) ON DELETE CASCADE,`);
  lines.push(`        order_id         INT NOT NULL FOREIGN KEY REFERENCES dbo.[order](order_id),`);
  lines.push(`        product_id       INT NULL FOREIGN KEY REFERENCES dbo.product(product_id),`);
  lines.push(`        carrier          NVARCHAR(60),`);
  lines.push(`        status           NVARCHAR(30) NOT NULL DEFAULT 'preparing',`);
  lines.push(`        shipping_address NVARCHAR(300),`);
  lines.push(`        shipped_at       DATETIME2 NULL`);
  lines.push(`    );`);
  lines.push(`END`);
  lines.push(`GO`);
  lines.push(``);
  lines.push(`IF OBJECT_ID('dbo.review', 'U') IS NULL`);
  lines.push(`BEGIN`);
  lines.push(`    CREATE TABLE dbo.review (`);
  lines.push(`        review_id   INT IDENTITY(1,1) PRIMARY KEY,`);
  lines.push(`        customer_id INT NOT NULL FOREIGN KEY REFERENCES dbo.customer(customer_id) ON DELETE CASCADE,`);
  lines.push(`        product_id  INT NOT NULL FOREIGN KEY REFERENCES dbo.product(product_id) ON DELETE CASCADE,`);
  lines.push(`        first_name  NVARCHAR(60),`);
  lines.push(`        last_name   NVARCHAR(60),`);
  lines.push(`        rating      INT NOT NULL CHECK(rating BETWEEN 1 AND 5),`);
  lines.push(`        comment     NVARCHAR(MAX),`);
  lines.push(`        review_date NVARCHAR(20) DEFAULT '',`);
  lines.push(`        created_at  DATETIME2 NOT NULL DEFAULT GETDATE(),`);
  lines.push(`        CONSTRAINT UQ_Review_Customer_Product UNIQUE(customer_id, product_id)`);
  lines.push(`    );`);
  lines.push(`END`);
  lines.push(`GO`);
  lines.push(``);
  lines.push(`IF OBJECT_ID('dbo.wishlist', 'U') IS NULL`);
  lines.push(`BEGIN`);
  lines.push(`    CREATE TABLE dbo.wishlist (`);
  lines.push(`        customer_id INT NOT NULL FOREIGN KEY REFERENCES dbo.customer(customer_id) ON DELETE CASCADE,`);
  lines.push(`        product_id  INT NOT NULL FOREIGN KEY REFERENCES dbo.product(product_id) ON DELETE CASCADE,`);
  lines.push(`        PRIMARY KEY (customer_id, product_id)`);
  lines.push(`    );`);
  lines.push(`END`);
  lines.push(`GO`);
  lines.push(``);
  lines.push(`IF OBJECT_ID('dbo.review_like', 'U') IS NULL`);
  lines.push(`BEGIN`);
  lines.push(`    CREATE TABLE dbo.review_like (`);
  lines.push(`        customer_id INT NOT NULL FOREIGN KEY REFERENCES dbo.customer(customer_id),`);
  lines.push(`        review_id   INT NOT NULL FOREIGN KEY REFERENCES dbo.review(review_id) ON DELETE CASCADE,`);
  lines.push(`        created_at  DATETIME2 NOT NULL DEFAULT GETDATE(),`);
  lines.push(`        PRIMARY KEY (customer_id, review_id)`);
  lines.push(`    );`);
  lines.push(`END`);
  lines.push(`GO`);
  lines.push(``);
  lines.push(`-- ============================================================================`);
  lines.push(`-- 2. CREATE VIEWS (Data Dictionary Compatibility: Orders & Order_Detail)`);
  lines.push(`-- ============================================================================`);
  lines.push(`CREATE OR ALTER VIEW dbo.Orders AS`);
  lines.push(`SELECT`);
  lines.push(`    order_id,`);
  lines.push(`    customer_id,`);
  lines.push(`    order_date,`);
  lines.push(`    total_price AS total_amount,`);
  lines.push(`    status AS order_status`);
  lines.push(`FROM dbo.[order];`);
  lines.push(`GO`);
  lines.push(``);
  lines.push(`CREATE OR ALTER VIEW dbo.Order_Detail AS`);
  lines.push(`SELECT`);
  lines.push(`    order_item_id AS order_detail_id,`);
  lines.push(`    order_id,`);
  lines.push(`    product_id,`);
  lines.push(`    quantity,`);
  lines.push(`    unit_price`);
  lines.push(`FROM dbo.order_item;`);
  lines.push(`GO`);
  lines.push(``);
  lines.push(`-- ============================================================================`);
  lines.push(`-- 3. REALTIME DATA SYNCHRONIZATION (ATOMIC TRANSACTION)`);
  lines.push(`-- ============================================================================`);
  lines.push(`SET NOCOUNT ON;`);
  lines.push(`BEGIN TRANSACTION;`);
  lines.push(``);

  // ลบข้อมูลเก่าตามลำดับ Child -> Parent เพื่อไม่ให้ติด Foreign Key
  for (let i = TABLE_SCHEMAS.length - 1; i >= 0; i--) {
    lines.push(`DELETE FROM ${TABLE_SCHEMAS[i].sqlName};`);
  }
  lines.push(``);

  // ใส่ข้อมูลล่าสุดตามลำดับ Parent -> Child
  for (const t of TABLE_SCHEMAS) {
    const rows = snap.tables[t.name] || [];
    if (!rows.length) continue;

    lines.push(`-- ตาราง ${t.sqlName} (${rows.length} รายการ)`);
    if (t.identity) {
      lines.push(`SET IDENTITY_INSERT ${t.sqlName} ON;`);
    }
    const colList = t.columns.join(', ');
    for (const r of rows) {
      const vals = t.columns.map((c) => formatSqlValue(r[c], t.types[c])).join(', ');
      lines.push(`INSERT INTO ${t.sqlName} (${colList}) VALUES (${vals});`);
    }
    if (t.identity) {
      lines.push(`SET IDENTITY_INSERT ${t.sqlName} OFF;`);
    }
    lines.push(``);
  }

  lines.push(`COMMIT TRANSACTION;`);
  lines.push(`SET NOCOUNT OFF;`);
  lines.push(`GO`);
  lines.push(``);
  lines.push(`-- ============================================================================`);
  lines.push(`-- 4. VERIFY REALTIME SUMMARY`);
  lines.push(`-- ============================================================================`);
  lines.push(
    TABLE_SCHEMAS.map((t, idx) =>
      `${idx === 0 ? 'SELECT ' : 'UNION ALL SELECT '}'${t.name}' AS Table_Name, COUNT(*) AS Total_Records FROM ${t.sqlName}`
    ).join('\n') + ';'
  );
  lines.push(`GO`);
  lines.push(``);

  return lines.join('\n');
}

function applySnapshotToSqlite(db, incomingTables, syncHelpers = {}) {
  if (!incomingTables || typeof incomingTables !== 'object') {
    throw new Error('ข้อมูลตารางไม่ถูกต้อง');
  }
  db.exec('PRAGMA foreign_keys = OFF;');
  db.exec('BEGIN;');
  try {
    for (let i = TABLE_SCHEMAS.length - 1; i >= 0; i--) {
      const t = TABLE_SCHEMAS[i];
      if (Array.isArray(incomingTables[t.name])) {
        db.prepare(`DELETE FROM "${t.name}"`).run();
      }
    }
    for (const t of TABLE_SCHEMAS) {
      const rows = incomingTables[t.name];
      if (!Array.isArray(rows) || !rows.length) continue;
      const placeholders = t.columns.map(() => '?').join(',');
      const stmt = db.prepare(`INSERT INTO "${t.name}" (${t.columns.join(',')}) VALUES (${placeholders})`);
      for (const r of rows) {
        const vals = t.columns.map((c) => {
          let v = r[c];
          if (v === undefined || v === null) return null;
          const typ = t.types[c];
          if (typ === 'bit') return v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0;
          if (typ === 'int') {
            const n = parseInt(v, 10);
            return Number.isFinite(n) ? n : null;
          }
          if (typ === 'decimal') {
            const n = Number(v);
            return Number.isFinite(n) ? n : 0;
          }
          if (typ === 'datetime') return normalizeDateStr(v);
          return String(v);
        });
        stmt.run(...vals);
      }
    }
    db.exec('COMMIT;');
  } catch (e) {
    db.exec('ROLLBACK;');
    throw e;
  } finally {
    db.exec('PRAGMA foreign_keys = ON;');
  }
}

// แปลงคำสั่ง T-SQL (เช่น SELECT TOP 10 * FROM dbo.[order]) ให้รันบน SQLite ได้ด้วย
function translateTSqlToSqlite(sql) {
  let s = String(sql || '').trim();
  s = s.replace(/^\s*USE\s+[\[\]\w]+\s*;?\s*$/gim, '');
  s = s.replace(/^\s*GO\s*$/gim, '');
  s = s.replace(/\bdbo\.\[(\w+)\]/gi, '"$1"');
  s = s.replace(/\bdbo\.(\w+)/gi, '"$1"');
  s = s.replace(/\[order\]/gi, '"order"');
  s = s.replace(/\[(\w+)\]/g, '"$1"');
  s = s.replace(/\bN'/g, "'");
  s = s.replace(/\bGETDATE\s*\(\s*\)/gi, "datetime('now','localtime')");
  // SELECT TOP N ... -> SELECT ... LIMIT N
  const topMatch = s.match(/^\s*SELECT\s+TOP\s+(\d+)\s+([\s\S]+?)(?:;\s*)?$/i);
  if (topMatch && !/\bLIMIT\s+\d+/i.test(s)) {
    s = `SELECT ${topMatch[2]} LIMIT ${topMatch[1]}`;
  }
  return s.trim();
}

function createRealtimeSqlManager(db) {
  const sseClients = new Set();
  const activityLog = [];
  let lastChecksum = '';
  let ssmsStatus = {
    connected: false,
    instance: DEFAULT_INSTANCE,
    database: DATABASE_NAME,
    mode: process.platform === 'win32' ? 'windows-direct' : 'bridge-ready',
    lastSyncAt: null,
    lastError: null,
    syncCount: 0
  };

  function addLog(type, message, extra = {}) {
    const entry = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      time: new Date().toISOString(),
      type,
      message,
      ...extra
    };
    activityLog.unshift(entry);
    if (activityLog.length > 40) activityLog.length = 40;
    return entry;
  }

  function broadcast(event, payload) {
    const msg = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const res of sseClients) {
      try {
        res.write(msg);
      } catch {
        sseClients.delete(res);
      }
    }
  }

  // ซิงค์เข้า SQL Server บนเครื่อง Windows โดยตรง (ถ้ารันเซิร์ฟเวอร์บน Windows ที่มี .\SQLEXPRESS01)
  let winSyncInProgress = false;
  function pushToLocalWindowsSqlServer(scriptText) {
    if (process.platform !== 'win32' || winSyncInProgress) return;
    winSyncInProgress = true;
    const psCode = `
      $ErrorActionPreference = 'Stop'
      $instances = @('${DEFAULT_INSTANCE}', '.\\SQLEXPRESS01', 'localhost\\SQLEXPRESS01', '.\\SQLEXPRESS', 'localhost') | Select-Object -Unique
      $conn = $null
      $usedInst = $null
      foreach ($inst in $instances) {
        try {
          $c = New-Object System.Data.SqlClient.SqlConnection("Server=$inst;Database=master;Integrated Security=True;TrustServerCertificate=True;Connection Timeout=3")
          $c.Open()
          $conn = $c
          $usedInst = $inst
          break
        } catch {}
      }
      if (-not $conn) { throw "ไม่พบ SQL Server Instance (.\\SQLEXPRESS01)" }
      $script = [System.IO.File]::ReadAllText('${SQL_FILE_PATH.replace(/'/g, "''")}', [System.Text.Encoding]::UTF8)
      $batches = $script -split '(?m)^\\s*GO\\s*$'
      foreach ($b in $batches) {
        if ($b.Trim().Length -gt 0) {
          $cmd = $conn.CreateCommand()
          $cmd.CommandTimeout = 30
          $cmd.CommandText = $b
          [void]$cmd.ExecuteNonQuery()
        }
      }
      $conn.Close()
      Write-Output "OK|$usedInst"
    `;
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psCode]);
    let out = '', err = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.stderr.on('data', (d) => (err += d.toString()));
    child.on('close', (code) => {
      winSyncInProgress = false;
      if (code === 0 && out.includes('OK|')) {
        const inst = out.split('OK|')[1]?.trim() || DEFAULT_INSTANCE;
        ssmsStatus.connected = true;
        ssmsStatus.instance = inst;
        ssmsStatus.mode = 'windows-direct';
        ssmsStatus.lastSyncAt = new Date().toISOString();
        ssmsStatus.lastError = null;
        ssmsStatus.syncCount++;
        broadcast('status', ssmsStatus);
      } else if (err) {
        ssmsStatus.lastError = err.trim().slice(0, 200);
      }
    });
  }

  function notifyChange(reason = 'manual', source = 'web') {
    try {
      const snap = getSnapshot(db);
      const changed = snap.checksum !== lastChecksum;
      lastChecksum = snap.checksum;

      const script = generateSqlServerScript(db, snap);
      fs.writeFileSync(SQL_FILE_PATH, script, 'utf8');

      if (changed || reason === 'init' || reason === 'force') {
        const logEntry = addLog('sync', `[${source.toUpperCase()}] ซิงค์ข้อมูล Realtime (${reason})`, {
          checksum: snap.checksum,
          counts: snap.counts
        });
        broadcast('db_change', {
          reason,
          source,
          checksum: snap.checksum,
          timestamp: snap.timestamp,
          counts: snap.counts,
          log: logEntry,
          ssmsStatus
        });
        pushToLocalWindowsSqlServer(script);
      }
      return snap;
    } catch (e) {
      console.error('SQL Sync Error:', e);
      return null;
    }
  }

  function registerBridgeHeartbeat(info = {}) {
    ssmsStatus.connected = true;
    ssmsStatus.instance = info.instance || DEFAULT_INSTANCE;
    ssmsStatus.database = info.database || DATABASE_NAME;
    ssmsStatus.mode = 'ssms-bridge-realtime';
    ssmsStatus.lastSyncAt = new Date().toISOString();
    ssmsStatus.lastError = null;
    ssmsStatus.syncCount++;
  }

  // สร้างไฟล์ .sql ครั้งแรกทันทีที่เริ่มระบบ
  notifyChange('init', 'system');

  return {
    TABLE_SCHEMAS,
    SQL_FILE_PATH,
    DEFAULT_INSTANCE,
    DATABASE_NAME,
    getSnapshot: () => getSnapshot(db),
    generateSqlServerScript: () => generateSqlServerScript(db),
    applySnapshotToSqlite: (tables) => {
      applySnapshotToSqlite(db, tables);
      return notifyChange('ssms_push', 'ssms');
    },
    translateTSqlToSqlite,
    notifyChange,
    registerBridgeHeartbeat,
    getStatus: () => ({
      ...ssmsStatus,
      checksum: lastChecksum,
      clients: sseClients.size,
      logs: activityLog
    }),
    addSseClient: (res) => {
      sseClients.add(res);
      res.on('close', () => sseClients.delete(res));
    }
  };
}

module.exports = {
  TABLE_SCHEMAS,
  createRealtimeSqlManager,
  getSnapshot,
  generateSqlServerScript,
  applySnapshotToSqlite,
  translateTSqlToSqlite
};
