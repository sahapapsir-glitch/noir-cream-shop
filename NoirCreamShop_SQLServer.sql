-- ============================================================================
-- NOIR & CREAM CLOTHING SHOP — REALTIME MICROSOFT SQL SERVER DATABASE
-- Instance: .\SQLEXPRESS01 | Database: [NoirCreamShop]
-- Checksum: 2d9357a1690aa89f | Updated: 2026-11-18T06:49:55.290Z
-- Compatible with: Microsoft SQL Server 2017+, 2022, 2025 & SSMS 20/21/22
-- ============================================================================

USE master;
GO

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'NoirCreamShop')
BEGIN
    CREATE DATABASE [NoirCreamShop] COLLATE Thai_100_CI_AS;
END
GO

USE [NoirCreamShop];
GO

-- ============================================================================
-- 1. CREATE TABLES (16 TABLES MATCHING ER DIAGRAM & DATA DICTIONARY)
-- ============================================================================
IF OBJECT_ID('dbo.employee', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.employee (
        employee_id INT IDENTITY(1,1) PRIMARY KEY,
        first_name  NVARCHAR(100) NOT NULL,
        last_name   NVARCHAR(100) NOT NULL,
        email       NVARCHAR(150),
        phone       NVARCHAR(40),
        position    NVARCHAR(120),
        address     NVARCHAR(600)
    );
END
GO

IF OBJECT_ID('dbo.admin', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.admin (
        admin_id      INT IDENTITY(1,1) PRIMARY KEY,
        name          NVARCHAR(150) NOT NULL,
        email         NVARCHAR(150) NOT NULL UNIQUE,
        phone         NVARCHAR(40),
        password_hash NVARCHAR(255) NOT NULL
    );
END
GO

IF OBJECT_ID('dbo.supplier', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.supplier (
        supplier_id  INT IDENTITY(1,1) PRIMARY KEY,
        name         NVARCHAR(150) NOT NULL,
        contact_name NVARCHAR(120),
        phone        NVARCHAR(40),
        email        NVARCHAR(150),
        address      NVARCHAR(600),
        employee_id  INT NULL FOREIGN KEY REFERENCES dbo.employee(employee_id),
        admin_id     INT NULL FOREIGN KEY REFERENCES dbo.admin(admin_id)
    );
END
GO

IF OBJECT_ID('dbo.product', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.product (
        product_id  INT IDENTITY(1,1) PRIMARY KEY,
        name        NVARCHAR(250) NOT NULL,
        category    NVARCHAR(100) NOT NULL,
        description NVARCHAR(MAX),
        status      NVARCHAR(30) NOT NULL DEFAULT 'active',
        stock       INT NOT NULL DEFAULT 0,
        quantity    INT NOT NULL DEFAULT 0,
        price       DECIMAL(10,2) NOT NULL DEFAULT 0,
        supplier_id INT NULL FOREIGN KEY REFERENCES dbo.supplier(supplier_id),
        employee_id INT NULL FOREIGN KEY REFERENCES dbo.employee(employee_id),
        image_url   NVARCHAR(MAX),
        is_featured BIT NOT NULL DEFAULT 0,
        created_at  DATETIME2 NOT NULL DEFAULT GETDATE()
    );
END
GO

IF OBJECT_ID('dbo.product_variant', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.product_variant (
        variant_id     INT IDENTITY(1,1) PRIMARY KEY,
        product_id     INT NOT NULL FOREIGN KEY REFERENCES dbo.product(product_id) ON DELETE CASCADE,
        size           NVARCHAR(40) NOT NULL,
        color          NVARCHAR(80) NOT NULL,
        color_hex      NVARCHAR(30),
        price          DECIMAL(10,2) NOT NULL,
        stock          INT NOT NULL DEFAULT 0,
        stock_quantity INT NOT NULL DEFAULT 0,
        sku            NVARCHAR(80) UNIQUE
    );
END
GO

IF OBJECT_ID('dbo.customer', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.customer (
        customer_id   INT IDENTITY(1,1) PRIMARY KEY,
        first_name    NVARCHAR(100) NOT NULL,
        last_name     NVARCHAR(100) NOT NULL,
        phone         NVARCHAR(40),
        email         NVARCHAR(150) NOT NULL UNIQUE,
        address       NVARCHAR(600),
        admin_id      INT NULL FOREIGN KEY REFERENCES dbo.admin(admin_id),
        password_hash NVARCHAR(255) NOT NULL,
        created_at    DATETIME2 NOT NULL DEFAULT GETDATE()
    );
END
GO

IF OBJECT_ID('dbo.address', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.address (
        address_id  INT IDENTITY(1,1) PRIMARY KEY,
        customer_id INT NOT NULL FOREIGN KEY REFERENCES dbo.customer(customer_id) ON DELETE CASCADE,
        recipient   NVARCHAR(150),
        phone       NVARCHAR(40),
        house_no    NVARCHAR(250),
        village     NVARCHAR(250),
        road        NVARCHAR(250),
        subdistrict NVARCHAR(120),
        district    NVARCHAR(120),
        province    NVARCHAR(120),
        postal_code NVARCHAR(20),
        is_default  BIT NOT NULL DEFAULT 0
    );
END
GO

IF OBJECT_ID('dbo.cart_item', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.cart_item (
        cart_id     INT IDENTITY(1,1) PRIMARY KEY,
        customer_id INT NOT NULL FOREIGN KEY REFERENCES dbo.customer(customer_id) ON DELETE CASCADE,
        variant_id  INT NOT NULL FOREIGN KEY REFERENCES dbo.product_variant(variant_id) ON DELETE CASCADE,
        product_id  INT NULL FOREIGN KEY REFERENCES dbo.product(product_id),
        quantity    INT NOT NULL DEFAULT 1,
        total_price DECIMAL(10,2) NOT NULL DEFAULT 0,
        CONSTRAINT UQ_Cart_Customer_Variant UNIQUE (customer_id, variant_id)
    );
END
GO

IF OBJECT_ID('dbo.coupon', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.coupon (
        code      NVARCHAR(50) PRIMARY KEY,
        type      NVARCHAR(20) NOT NULL,
        value     DECIMAL(10,2) NOT NULL,
        min_total DECIMAL(10,2) NOT NULL DEFAULT 0,
        active    BIT NOT NULL DEFAULT 1
    );
END
GO

IF OBJECT_ID('dbo.[order]', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.[order] (
        order_id     INT IDENTITY(1,1) PRIMARY KEY,
        customer_id  INT NOT NULL FOREIGN KEY REFERENCES dbo.customer(customer_id),
        product_id   INT NULL FOREIGN KEY REFERENCES dbo.product(product_id),
        order_date   DATETIME2 NOT NULL DEFAULT GETDATE(),
        status       NVARCHAR(40) NOT NULL DEFAULT 'pending',
        subtotal     DECIMAL(10,2) NOT NULL DEFAULT 0,
        discount     DECIMAL(10,2) NOT NULL DEFAULT 0,
        shipping_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
        total_price  DECIMAL(10,2) NOT NULL DEFAULT 0,
        coupon_code  NVARCHAR(50),
        ship_name    NVARCHAR(150),
        ship_phone   NVARCHAR(40),
        ship_address NVARCHAR(600)
    );
END
GO

IF OBJECT_ID('dbo.order_item', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.order_item (
        order_item_id INT IDENTITY(1,1) PRIMARY KEY,
        order_id      INT NOT NULL FOREIGN KEY REFERENCES dbo.[order](order_id) ON DELETE CASCADE,
        variant_id    INT NOT NULL FOREIGN KEY REFERENCES dbo.product_variant(variant_id),
        product_id    INT NULL FOREIGN KEY REFERENCES dbo.product(product_id),
        quantity      INT NOT NULL,
        unit_price    DECIMAL(10,2) NOT NULL,
        total_price   DECIMAL(10,2) NOT NULL DEFAULT 0
    );
END
GO

IF OBJECT_ID('dbo.payment', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.payment (
        payment_id INT IDENTITY(1,1) PRIMARY KEY,
        order_id   INT NOT NULL FOREIGN KEY REFERENCES dbo.[order](order_id) ON DELETE CASCADE,
        method     NVARCHAR(80) NOT NULL,
        status     NVARCHAR(40) NOT NULL DEFAULT 'pending',
        amount     DECIMAL(10,2) NOT NULL,
        paid_at    DATETIME2 NULL
    );
END
GO

IF OBJECT_ID('dbo.shipment', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.shipment (
        shipment_id      INT IDENTITY(1,1) PRIMARY KEY,
        tracking_no      NVARCHAR(80),
        payment_id       INT NOT NULL FOREIGN KEY REFERENCES dbo.payment(payment_id) ON DELETE CASCADE,
        order_id         INT NOT NULL FOREIGN KEY REFERENCES dbo.[order](order_id),
        product_id       INT NULL FOREIGN KEY REFERENCES dbo.product(product_id),
        carrier          NVARCHAR(80),
        status           NVARCHAR(40) NOT NULL DEFAULT 'preparing',
        shipping_address NVARCHAR(600),
        shipped_at       DATETIME2 NULL
    );
END
GO

IF OBJECT_ID('dbo.review', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.review (
        review_id   INT IDENTITY(1,1) PRIMARY KEY,
        customer_id INT NOT NULL FOREIGN KEY REFERENCES dbo.customer(customer_id) ON DELETE CASCADE,
        product_id  INT NOT NULL FOREIGN KEY REFERENCES dbo.product(product_id) ON DELETE CASCADE,
        first_name  NVARCHAR(100),
        last_name   NVARCHAR(100),
        rating      INT NOT NULL CHECK(rating BETWEEN 1 AND 5),
        comment     NVARCHAR(MAX),
        review_date NVARCHAR(40) DEFAULT '',
        created_at  DATETIME2 NOT NULL DEFAULT GETDATE(),
        CONSTRAINT UQ_Review_Customer_Product UNIQUE(customer_id, product_id)
    );
END
GO

IF OBJECT_ID('dbo.wishlist', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.wishlist (
        customer_id INT NOT NULL FOREIGN KEY REFERENCES dbo.customer(customer_id) ON DELETE CASCADE,
        product_id  INT NOT NULL FOREIGN KEY REFERENCES dbo.product(product_id) ON DELETE CASCADE,
        PRIMARY KEY (customer_id, product_id)
    );
END
GO

IF OBJECT_ID('dbo.review_like', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.review_like (
        customer_id INT NOT NULL FOREIGN KEY REFERENCES dbo.customer(customer_id),
        review_id   INT NOT NULL FOREIGN KEY REFERENCES dbo.review(review_id) ON DELETE CASCADE,
        created_at  DATETIME2 NOT NULL DEFAULT GETDATE(),
        PRIMARY KEY (customer_id, review_id)
    );
END
GO

-- ============================================================================
-- 1B. AUTO-WIDEN COLUMNS ON EXISTING SQL SERVER DATABASES (PREVENT TRUNCATION)
-- ============================================================================
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.employee') AND name = 'first_name' AND max_length > 0 AND max_length < 200)
    ALTER TABLE dbo.employee ALTER COLUMN first_name NVARCHAR(100) NOT NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.employee') AND name = 'last_name' AND max_length > 0 AND max_length < 200)
    ALTER TABLE dbo.employee ALTER COLUMN last_name NVARCHAR(100) NOT NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.employee') AND name = 'email' AND max_length > 0 AND max_length < 300)
    ALTER TABLE dbo.employee ALTER COLUMN email NVARCHAR(150) NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.employee') AND name = 'phone' AND max_length > 0 AND max_length < 80)
    ALTER TABLE dbo.employee ALTER COLUMN phone NVARCHAR(40) NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.employee') AND name = 'position' AND max_length > 0 AND max_length < 240)
    ALTER TABLE dbo.employee ALTER COLUMN position NVARCHAR(120) NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.employee') AND name = 'address' AND max_length > 0 AND max_length < 1200)
    ALTER TABLE dbo.employee ALTER COLUMN address NVARCHAR(600) NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.supplier') AND name = 'name' AND max_length > 0 AND max_length < 300)
    ALTER TABLE dbo.supplier ALTER COLUMN name NVARCHAR(150) NOT NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.supplier') AND name = 'contact_name' AND max_length > 0 AND max_length < 240)
    ALTER TABLE dbo.supplier ALTER COLUMN contact_name NVARCHAR(120) NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.supplier') AND name = 'phone' AND max_length > 0 AND max_length < 80)
    ALTER TABLE dbo.supplier ALTER COLUMN phone NVARCHAR(40) NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.supplier') AND name = 'email' AND max_length > 0 AND max_length < 300)
    ALTER TABLE dbo.supplier ALTER COLUMN email NVARCHAR(150) NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.supplier') AND name = 'address' AND max_length > 0 AND max_length < 1200)
    ALTER TABLE dbo.supplier ALTER COLUMN address NVARCHAR(600) NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.product') AND name = 'name' AND max_length > 0 AND max_length < 500)
    ALTER TABLE dbo.product ALTER COLUMN name NVARCHAR(250) NOT NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.product') AND name = 'category' AND max_length > 0 AND max_length < 200)
    ALTER TABLE dbo.product ALTER COLUMN category NVARCHAR(100) NOT NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.product') AND name = 'image_url' AND max_length <> -1)
    ALTER TABLE dbo.product ALTER COLUMN image_url NVARCHAR(MAX) NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.product_variant') AND name = 'size' AND max_length > 0 AND max_length < 80)
    ALTER TABLE dbo.product_variant ALTER COLUMN size NVARCHAR(40) NOT NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.product_variant') AND name = 'color' AND max_length > 0 AND max_length < 160)
    ALTER TABLE dbo.product_variant ALTER COLUMN color NVARCHAR(80) NOT NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.product_variant') AND name = 'color_hex' AND max_length > 0 AND max_length < 60)
    ALTER TABLE dbo.product_variant ALTER COLUMN color_hex NVARCHAR(30) NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.customer') AND name = 'first_name' AND max_length > 0 AND max_length < 200)
    ALTER TABLE dbo.customer ALTER COLUMN first_name NVARCHAR(100) NOT NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.customer') AND name = 'last_name' AND max_length > 0 AND max_length < 200)
    ALTER TABLE dbo.customer ALTER COLUMN last_name NVARCHAR(100) NOT NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.customer') AND name = 'phone' AND max_length > 0 AND max_length < 80)
    ALTER TABLE dbo.customer ALTER COLUMN phone NVARCHAR(40) NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.customer') AND name = 'address' AND max_length > 0 AND max_length < 1200)
    ALTER TABLE dbo.customer ALTER COLUMN address NVARCHAR(600) NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.address') AND name = 'recipient' AND max_length > 0 AND max_length < 300)
    ALTER TABLE dbo.address ALTER COLUMN recipient NVARCHAR(150) NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.address') AND name = 'phone' AND max_length > 0 AND max_length < 80)
    ALTER TABLE dbo.address ALTER COLUMN phone NVARCHAR(40) NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.address') AND name = 'house_no' AND max_length > 0 AND max_length < 500)
    ALTER TABLE dbo.address ALTER COLUMN house_no NVARCHAR(250) NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.address') AND name = 'village' AND max_length > 0 AND max_length < 500)
    ALTER TABLE dbo.address ALTER COLUMN village NVARCHAR(250) NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.address') AND name = 'road' AND max_length > 0 AND max_length < 500)
    ALTER TABLE dbo.address ALTER COLUMN road NVARCHAR(250) NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.address') AND name = 'subdistrict' AND max_length > 0 AND max_length < 240)
    ALTER TABLE dbo.address ALTER COLUMN subdistrict NVARCHAR(120) NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.address') AND name = 'district' AND max_length > 0 AND max_length < 240)
    ALTER TABLE dbo.address ALTER COLUMN district NVARCHAR(120) NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.address') AND name = 'province' AND max_length > 0 AND max_length < 240)
    ALTER TABLE dbo.address ALTER COLUMN province NVARCHAR(120) NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.address') AND name = 'postal_code' AND max_length > 0 AND max_length < 40)
    ALTER TABLE dbo.address ALTER COLUMN postal_code NVARCHAR(20) NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.[order]') AND name = 'coupon_code' AND max_length > 0 AND max_length < 100)
    ALTER TABLE dbo.[order] ALTER COLUMN coupon_code NVARCHAR(50) NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.[order]') AND name = 'ship_name' AND max_length > 0 AND max_length < 300)
    ALTER TABLE dbo.[order] ALTER COLUMN ship_name NVARCHAR(150) NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.[order]') AND name = 'ship_phone' AND max_length > 0 AND max_length < 80)
    ALTER TABLE dbo.[order] ALTER COLUMN ship_phone NVARCHAR(40) NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.[order]') AND name = 'ship_address' AND max_length > 0 AND max_length < 1200)
    ALTER TABLE dbo.[order] ALTER COLUMN ship_address NVARCHAR(600) NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.shipment') AND name = 'tracking_no' AND max_length > 0 AND max_length < 160)
    ALTER TABLE dbo.shipment ALTER COLUMN tracking_no NVARCHAR(80) NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.shipment') AND name = 'carrier' AND max_length > 0 AND max_length < 160)
    ALTER TABLE dbo.shipment ALTER COLUMN carrier NVARCHAR(80) NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.shipment') AND name = 'shipping_address' AND max_length > 0 AND max_length < 1200)
    ALTER TABLE dbo.shipment ALTER COLUMN shipping_address NVARCHAR(600) NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.review') AND name = 'first_name' AND max_length > 0 AND max_length < 200)
    ALTER TABLE dbo.review ALTER COLUMN first_name NVARCHAR(100) NULL;
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.review') AND name = 'last_name' AND max_length > 0 AND max_length < 200)
    ALTER TABLE dbo.review ALTER COLUMN last_name NVARCHAR(100) NULL;
GO

-- ============================================================================
-- 2. CREATE VIEWS (Data Dictionary Compatibility: Orders & Order_Detail)
-- ============================================================================
CREATE OR ALTER VIEW dbo.Orders AS
SELECT
    order_id,
    customer_id,
    order_date,
    total_price AS total_amount,
    status AS order_status
FROM dbo.[order];
GO

CREATE OR ALTER VIEW dbo.Order_Detail AS
SELECT
    order_item_id AS order_detail_id,
    order_id,
    product_id,
    quantity,
    unit_price
FROM dbo.order_item;
GO

-- ============================================================================
-- 3. REALTIME DATA SYNCHRONIZATION (ATOMIC TRANSACTION)
-- ============================================================================
SET NOCOUNT ON;
BEGIN TRANSACTION;

DELETE FROM dbo.review_like;
DELETE FROM dbo.wishlist;
DELETE FROM dbo.review;
DELETE FROM dbo.shipment;
DELETE FROM dbo.payment;
DELETE FROM dbo.order_item;
DELETE FROM dbo.[order];
DELETE FROM dbo.cart_item;
DELETE FROM dbo.product_variant;
DELETE FROM dbo.product;
DELETE FROM dbo.address;
DELETE FROM dbo.customer;
DELETE FROM dbo.supplier;
DELETE FROM dbo.coupon;
DELETE FROM dbo.employee;
DELETE FROM dbo.admin;

-- ตาราง dbo.admin (5 รายการ)
SET IDENTITY_INSERT dbo.admin ON;
INSERT INTO dbo.admin (admin_id, name, email, phone, password_hash) VALUES (1, N'ภูวมินทร์ วัฒนสาร', N'phuwamin@shop.com', N'081-000-0001', N'$2b$10$K29Zs/D3qAdalZS.IMpbt..mPtenJCqSOXunj1qPPOr8wgcOg4Ro.');
INSERT INTO dbo.admin (admin_id, name, email, phone, password_hash) VALUES (2, N'ธนกร อิ่มเพ็ง', N'thanakorn@shop.com', N'081-000-0002', N'$2b$10$DKyLG1Wg97A0C.az6yBcEut1Vl7szOEw3ZLifktosOn2tU.keyhLm');
INSERT INTO dbo.admin (admin_id, name, email, phone, password_hash) VALUES (3, N'ธนดล สมจิตต์', N'thanadon@shop.com', N'081-000-0003', N'$2b$10$pJ9VrV6lMy.QuhOBY3BNmOjlJb8j/xV55V8vSJ/5OTCPrdjBoGNJW');
INSERT INTO dbo.admin (admin_id, name, email, phone, password_hash) VALUES (4, N'สหภาพ ศิริพร', N'sahapap@shop.com', N'081-000-0004', N'$2b$10$YyXhViG72qyqV6gcRM/FTOR.dljjVBu/1BB/FxcnenrznLE4pR0s.');
INSERT INTO dbo.admin (admin_id, name, email, phone, password_hash) VALUES (5, N'ปวริศา โสมี', N'pawarisa@shop.com', N'081-000-0005', N'$2b$10$oGw91bSYq8aY3mxhbrcDmO7AgWI.Fhhq8azfRYw6A7uT64CRZO7kq');
SET IDENTITY_INSERT dbo.admin OFF;

-- ตาราง dbo.employee (2 รายการ)
SET IDENTITY_INSERT dbo.employee ON;
INSERT INTO dbo.employee (employee_id, first_name, last_name, email, phone, position, address) VALUES (1, N'สมศรี', N'ใจดี', N'somsri@shop.com', N'081-111-1111', N'ผู้จัดการฝ่ายจัดซื้อ', N'123 ถนนสุขุมวิท เขตวัฒนา กรุงเทพมหานคร');
INSERT INTO dbo.employee (employee_id, first_name, last_name, email, phone, position, address) VALUES (2, N'ธนากร', N'มั่นคง', N'thanakorn@shop.com', N'082-222-2222', N'เจ้าหน้าที่คลังสินค้า', N'45/8 ถนนพระราม 9 เขตห้วยขวาง กรุงเทพมหานคร');
SET IDENTITY_INSERT dbo.employee OFF;

-- ตาราง dbo.coupon (2 รายการ)
INSERT INTO dbo.coupon (code, type, value, min_total, active) VALUES (N'SAVE100', N'fixed', 100, 1000, 1);
INSERT INTO dbo.coupon (code, type, value, min_total, active) VALUES (N'WELCOME10', N'percent', 10, 0, 1);

-- ตาราง dbo.supplier (3 รายการ)
SET IDENTITY_INSERT dbo.supplier ON;
INSERT INTO dbo.supplier (supplier_id, name, contact_name, phone, email, address, employee_id, admin_id) VALUES (1, N'Siam Textile Co.', N'คุณวิชัย', N'02-111-2222', N'sales@siamtextile.example', N'กรุงเทพมหานคร', 1, 1);
INSERT INTO dbo.supplier (supplier_id, name, contact_name, phone, email, address, employee_id, admin_id) VALUES (2, N'Lanna Garment', N'คุณมาลี', N'053-333-444', N'hello@lannagarment.example', N'เชียงใหม่', 2, 1);
INSERT INTO dbo.supplier (supplier_id, name, contact_name, phone, email, address, employee_id, admin_id) VALUES (3, N'Denim House', N'คุณก้อง', N'038-555-666', N'order@denimhouse.example', N'ชลบุรี', 1, 1);
SET IDENTITY_INSERT dbo.supplier OFF;

-- ตาราง dbo.customer (22 รายการ)
SET IDENTITY_INSERT dbo.customer ON;
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (1, N'สมชาย', N'ทดสอบ', N'089-999-9999', N'demo@shop.com', N'เลขที่ 99/148 ชั้น 19 ห้อง 1908 อาคารพาโนรามา ทาวเวอร์ สุขใจแลนด์ หมู่ 7 ซอยกิ่งแก้ว 25/1 ถนนบางนา-ตราด กม.12 บางพลีใหญ่ บางพลี สมุทรปราการ 10540', 1, N'$2b$10$ZOb/yCkPVuDXc9kPaJHQreOI7VIqIIV7hJ.SH2jDhB6YA7na.5yvq', '2026-11-10 07:35:51');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (2, N'ณัฐพร', N'กิจเจริญ', N'081-234-5678', N'nattaporn.k@fake.com', N'เลขที่ 128/45 ชั้น 14 ห้อง 1402 อาคารพาร์ควิว เอ็กเซ็กคิวทีฟ เรสซิเดนซ์ ซอยสุขุมวิท 55 (ทองหล่อ 13) ถนนสุขุมวิท คลองตันเหนือ วัฒนา กรุงเทพมหานคร 10110', 1, N'$2b$10$eAH3aJTMiA0cB4p2zDcID.UmTVp48JrXU5l6IdnuhfnuflWWgNU7y', '2026-11-17 13:38:36');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (3, N'กิตติศักดิ์', N'สุวรรณรัตน์', N'082-345-6789', N'kittisak.s@fake.com', N'เลขที่ 88/154 โซน C ซอย 9/2 หมู่บ้านพฤกษาวิลเลจ เดอะซีซัน คลอง 1 หมู่ 6 ซอยรังสิต-นครนายก 32 ถนนพหลโยธิน คลองหนึ่ง คลองหลวง ปทุมธานี 12120', 2, N'$2b$10$A2sDGNSozuLDXAJ4fqYam.2yJocSIELDARTJRyMdu159lFpBKfWRK', '2026-11-17 13:38:36');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (4, N'ชลธิชา', N'วงศ์สว่าง', N'083-456-7890', N'chonthicha.w@fake.com', N'เลขที่ 45/92 ชั้น 8 อาคาร B ห้อง 815 คอนโดแอสปาย งามวงศ์วาน หมู่ 2 ซอยงามวงศ์วาน 18 (จุฬาเกษม) ถนนงามวงศ์วาน บางเขน เมืองนนทบุรี นนทบุรี 11000', 3, N'$2b$10$mf7ySYhQdt52kHFwrGCveOWylhmOh9OjPnjWT7Y1ZLG/y6T9WFoAS', '2026-11-17 13:38:36');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (5, N'วรเมธ', N'รัตนเดช', N'084-567-8901', N'worameth.r@fake.com', N'เลขที่ 102/48 ซอย 15 เฟส 3 หมู่บ้านศุภาลัย พรีมา วิลลา เพชรเกษม ซอยเพชรเกษม 48 แยก 16 ถนนเพชรเกษม บางหว้า ภาษีเจริญ กรุงเทพมหานคร 10160', 4, N'$2b$10$snL9UVb9mnU1cb9KT2K8S.xiKImxp/nzLOTWWpQw.e7KTq56VAHHq', '2026-11-17 13:38:36');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (6, N'พิชญา', N'บุญเลิศ', N'085-678-9012', N'pitchaya.b@fake.com', N'เลขที่ 77/25 ชั้น 5 ห้อง 503 โครงการเดอะนิมมาน พรีเมียม คอนโดมิเนียม หมู่ 6 ซอยนิมมานเหมินท์ 9 ถนนนิมมานเหมินท์ สุเทพ เมืองเชียงใหม่ เชียงใหม่ 50200', 5, N'$2b$10$f/vqfUgJeNApu4qXajzeKePgU8OGC262E2PDDuqpj.MUsgvCz.ktu', '2026-11-17 13:38:36');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (7, N'ธนาธิป', N'ประเสริฐยิ่ง', N'086-789-0123', N'thanathip.p@fake.com', N'เลขที่ 215/84 ซอย 4 บล็อค B หมู่บ้านคาซ่า แกรนด์ มิตรสัมพันธ์-บางแสน หมู่ 3 ซอยมิตรสัมพันธ์ 13 ถนนลงหาดบางแสน แสนสุข เมืองชลบุรี ชลบุรี 20130', 1, N'$2b$10$BwwhCU4tdkxoZE8EqnVNfO59D.PHCVe04I/WRNg1Zf.n6SzaE/GHi', '2026-11-17 13:38:36');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (8, N'ศิริพร', N'มณีโชติ', N'087-890-1234', N'siriporn.m@fake.com', N'เลขที่ 64/119 ซอยลดาวัลย์ 8 โซนการ์เดน หมู่บ้านลดาวัลย์ ศรีนครินทร์ โครงการ 2 หมู่ 5 ซอยศรีด่าน 22 ถนนศรีนครินทร์ บางแก้ว บางพลี สมุทรปราการ 10540', 2, N'$2b$10$WkpYhQ91Z7D489TpvyLxIOEOR7dZffVtd0AEATTympeGmUARgaUuG', '2026-11-17 13:38:36');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (9, N'อนุชา', N'อักษรศรี', N'088-901-2345', N'anucha.a@fake.com', N'เลขที่ 159/37 ซอยมิตรภาพ 19 แยก 4 หมู่บ้านสีมานคร วิลเลจ แกรนด์พาร์ค หมู่ 1 ซอยมิตรภาพร่วมใจ ถนนมิตรภาพสายหลัก ในเมือง เมืองนครราชสีมา นครราชสีมา 30000', 3, N'$2b$10$lZQZcUbnXd/W5eOqh.Pbze0/k/H6Gw.oAUMue8oOGst1myb9buKWm', '2026-11-17 13:38:36');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (10, N'กัญญาณัฐ', N'สัจธรรม', N'089-012-3456', N'kanyanat.s@fake.com', N'เลขที่ 33/72 ซอย 22 เฟสเลควิว หมู่บ้านสราญสิริ ท่าข้าม-พระราม 2 โครงการหรู ซอยท่าข้าม 7 แยก 4 ถนนพระราม 2 ท่าข้าม บางขุนเทียน กรุงเทพมหานคร 10150', 4, N'$2b$10$4ZlFDUvp0T3DbQZnUjWVxuWCH3H1yJVLxCxOMUsA/IFRloSej3YFm', '2026-11-17 13:38:36');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (11, N'ธีรภัทร', N'จินดารัตน์', N'090-123-4567', N'theerapat.j@fake.com', N'เลขที่ 512/93 ชั้น 7 ห้อง 704 อาคาร A คอนโดกัลปพฤกษ์ พาร์ค ขอนแก่น แอร์พอร์ต หมู่ 5 ซอยมะลิวัลย์ 14 ถนนมะลิวัลย์ ในเมือง เมืองขอนแก่น ขอนแก่น 40000', 5, N'$2b$10$xsnymTOSg8Go9hwwJgcrGu8ZQnG3dplkr6FOOhlZfpSGtrArcfLNu', '2026-11-17 13:38:36');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (12, N'ปริยากร', N'อินทร์แก้ว', N'091-234-5678', N'pariyakorn.i@fake.com', N'เลขที่ 28/46 ชั้น 3 ห้องพูลวิลล่า A3 เดอะรอยัล ภูเก็ต มารีนา ลักชัวรี เรสซิเดนซ์ หมู่ 2 ซอยเกาะแก้ว 24 ถนนเทพกระษัตรี ตลาดใหญ่ เมืองภูเก็ต ภูเก็ต 83000', 1, N'$2b$10$nJFXjdHpJttfMFt4dJaF2.c3wb3MeTvMQr5aQOZdT/19GDj37vPwS', '2026-11-17 13:38:36');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (13, N'ภาณุพงศ์', N'รุ่งเรือง', N'092-345-6789', N'panupong.r@fake.com', N'เลขที่ 90/118 ซอยคาซ่า 5 ซอยย่อย 3 หมู่บ้านคาซ่า วิลล์ ราชพฤกษ์-พระราม 5 หมู่ 4 ซอยบางรักน้อย 18 ถนนราชพฤกษ์ บางรักน้อย เมืองนนทบุรี นนทบุรี 11000', 2, N'$2b$10$bJko2us3Ap1YyIY/YlOI6u.NlPlNl1lx3NE6P5EcIHC5wpseueJBq', '2026-11-17 13:38:37');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (14, N'อภิญญา', N'พงษ์พาณิชย์', N'093-456-7890', N'apinya.p@fake.com', N'เลขที่ 14/255 ซอยสุรนารายณ์ 11/3 หมู่บ้านเซเรเน่การ์เด้น โคราช วิลล่า หมู่ 8 ซอยบ้านเกาะร่วมพัฒนา ถนนสุรนารายณ์ บ้านเกาะ เมืองนครราชสีมา นครราชสีมา 30000', 3, N'$2b$10$nnlcaDlw4y85R4TzZNe72ua8D.Isvj.rmvV1qQ18/FqrMJILlFhsy', '2026-11-17 13:38:37');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (15, N'กรกช', N'ตันติวิวัฒน์', N'094-567-8901', N'korakot.t@fake.com', N'เลขที่ 119/53 ซอยรามอินทรา 65 แยก 2-4 หมู่บ้านชัยพฤกษ์ รามอินทรา-วงแหวน ซอย 12 ซอยคู้บอน 27 แยก 10 ถนนรามอินทรา คันนายาว คันนายาว กรุงเทพมหานคร 10230', 4, N'$2b$10$MIJXDaItAAB9UW24VgVH..55MVCDGt1p679X3XP0CqT1sjL7SG8XS', '2026-11-17 13:38:37');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (16, N'มนัสวี', N'ศรีสุวรรณ', N'095-678-9012', N'manatsawee.s@fake.com', N'เลขที่ 67/124 ชั้น 10 อาคารแกรนด์ C เดอะไฮทส์ คอนโดมิเนียม แอท ช้างเผือก หมู่ 7 ซอยสุขเกษม 4 ถนนซุปเปอร์ไฮเวย์ เชียงใหม่-ลำปาง ช้างเผือก เมืองเชียงใหม่ เชียงใหม่ 50300', 5, N'$2b$10$WsoxHedQohvXq5YHFES4Q.CV/s9fnWUa2D1FfEI8Id/fotAYpIWO.', '2026-11-17 13:38:37');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (17, N'พงศธร', N'ศักดิ์เจริญ', N'096-789-0123', N'pongsatorn.s@fake.com', N'เลขที่ 203/67 ชั้น 18 ห้องวิวทะเล 1802 ลุมพินี วิลล์ นาเกลือ-วงศ์อมาตย์ เฟสบี หมู่ 1 ซอยนาเกลือ 16/1 ถนนสุขุมวิท-พัทยา นาเกลือ บางละมุง ชลบุรี 20150', 1, N'$2b$10$GpNq0av/gVb7nOzldwQUKO4s.hJbMjkASjHkD.dfcKfDImMmn..E6', '2026-11-17 13:38:37');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (18, N'ลลิตา', N'วรเวช', N'097-890-1234', N'lalita.w@fake.com', N'เลขที่ 55/182 ซอยแจ้งวัฒนะ-ปากเกร็ด 43 แยก 6 หมู่บ้านเพอร์เฟค เพลส แจ้งวัฒนะ โครงการพรีเมียม ซอยคลองเกลือ 12 ถนนแจ้งวัฒนะ บางพูด ปากเกร็ด นนทบุรี 11120', 2, N'$2b$10$33z8HPtvwvNfV9DMl8vfCeviUvKb1SlwM1KPxNpdG1Chz/DxoMxZK', '2026-11-17 13:38:37');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (19, N'ศรัณย์', N'ธรรมทัศน์', N'098-901-2345', N'saran.t@fake.com', N'เลขที่ 84/39 ซอยชะอำใต้ 7 แปลงริมสระว่ายน้ำ วิลล่า มาลี บีชไซด์ รีสอร์ทแอนด์เรสซิเดนซ์ หมู่ 3 ซอยร่วมจิตรพัฒนา ถนนเพชรเกษมสายใต้ ชะอำ ชะอำ เพชรบุรี 76120', 3, N'$2b$10$wFOjPHD7yOgJ6gxW4yRMbudVc54utvp/MRO2qTfexl80E9.InfxTS', '2026-11-17 13:38:37');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (20, N'นภัสสร', N'กิตติคุณ', N'099-012-3456', N'napatsorn.k@fake.com', N'เลขที่ 310/25 ซอย 18 ซอยย่อยมัณฑนา 4 หมู่บ้านมัณฑนา วงแหวน-บางแค โครงการ 1 ซอยเพชรเกษม 63 แยก 8 ถนนกาญจนาภิเษก บางแค บางแค กรุงเทพมหานคร 10160', 4, N'$2b$10$tG110zb2O9s0BvYul.sNNOR9HBuoDziQMoH12nSspO1DTvrWpEgRG', '2026-11-17 13:38:37');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (21, N'ชานนท์', N'วิมลศิลป์', N'080-123-4567', N'chanon.w@fake.com', N'เลขที่ 42/158 ซอยพัฒนาอุดร 6 เฟสการ์เดน 2 หมู่บ้านสิทธาการ์เด้นท์ โฮม อุดรธานีการ์เดน หมู่ 5 ซอยบ้านหนองขาม 12 ถนนรอบเมืองสายเหนือ หมากแข้ง เมืองอุดรธานี อุดรธานี 41000', 5, N'$2b$10$sj3AYZjrckAowLUgHJQ70uAuGAzqlIfhpT9CoxsZnnxFMMIPqpqQq', '2026-11-17 13:38:37');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (22, N'จิราภรณ์', N'ธาราสืบ', N'0819551264', N'jiraporn4956@gmail.com', N'11 หมู่บ้านสัมกร กรุงเทพกรีฑรา ทับช้าง สะพานสูง กรุงเทพมหานคร 10250', 1, N'$2b$10$Oy5mmGdeSFfWeX3Z3Cz6w.BnKheY.OowM4DhDUGEX74A/Y8/gSHHu', '2026-11-17 16:14:37');
SET IDENTITY_INSERT dbo.customer OFF;

-- ตาราง dbo.address (22 รายการ)
SET IDENTITY_INSERT dbo.address ON;
INSERT INTO dbo.address (address_id, customer_id, recipient, phone, house_no, village, road, subdistrict, district, province, postal_code, is_default) VALUES (43, 1, N'สมชาย ทดสอบ', N'089-999-9999', N'เลขที่ 99/148 ชั้น 19 ห้อง 1908', N'อาคารพาโนรามา ทาวเวอร์ สุขใจแลนด์ หมู่ 7', N'ซอยกิ่งแก้ว 25/1 ถนนบางนา-ตราด กม.12', N'บางพลีใหญ่', N'บางพลี', N'สมุทรปราการ', N'10540', 1);
INSERT INTO dbo.address (address_id, customer_id, recipient, phone, house_no, village, road, subdistrict, district, province, postal_code, is_default) VALUES (44, 2, N'ณัฐพร กิจเจริญ', N'081-234-5678', N'เลขที่ 128/45 ชั้น 14 ห้อง 1402', N'อาคารพาร์ควิว เอ็กเซ็กคิวทีฟ เรสซิเดนซ์', N'ซอยสุขุมวิท 55 (ทองหล่อ 13) ถนนสุขุมวิท', N'คลองตันเหนือ', N'วัฒนา', N'กรุงเทพมหานคร', N'10110', 1);
INSERT INTO dbo.address (address_id, customer_id, recipient, phone, house_no, village, road, subdistrict, district, province, postal_code, is_default) VALUES (45, 3, N'กิตติศักดิ์ สุวรรณรัตน์', N'082-345-6789', N'เลขที่ 88/154 โซน C ซอย 9/2', N'หมู่บ้านพฤกษาวิลเลจ เดอะซีซัน คลอง 1 หมู่ 6', N'ซอยรังสิต-นครนายก 32 ถนนพหลโยธิน', N'คลองหนึ่ง', N'คลองหลวง', N'ปทุมธานี', N'12120', 1);
INSERT INTO dbo.address (address_id, customer_id, recipient, phone, house_no, village, road, subdistrict, district, province, postal_code, is_default) VALUES (46, 4, N'ชลธิชา วงศ์สว่าง', N'083-456-7890', N'เลขที่ 45/92 ชั้น 8 อาคาร B ห้อง 815', N'คอนโดแอสปาย งามวงศ์วาน หมู่ 2', N'ซอยงามวงศ์วาน 18 (จุฬาเกษม) ถนนงามวงศ์วาน', N'บางเขน', N'เมืองนนทบุรี', N'นนทบุรี', N'11000', 1);
INSERT INTO dbo.address (address_id, customer_id, recipient, phone, house_no, village, road, subdistrict, district, province, postal_code, is_default) VALUES (47, 5, N'วรเมธ รัตนเดช', N'084-567-8901', N'เลขที่ 102/48 ซอย 15 เฟส 3', N'หมู่บ้านศุภาลัย พรีมา วิลลา เพชรเกษม', N'ซอยเพชรเกษม 48 แยก 16 ถนนเพชรเกษม', N'บางหว้า', N'ภาษีเจริญ', N'กรุงเทพมหานคร', N'10160', 1);
INSERT INTO dbo.address (address_id, customer_id, recipient, phone, house_no, village, road, subdistrict, district, province, postal_code, is_default) VALUES (48, 6, N'พิชญา บุญเลิศ', N'085-678-9012', N'เลขที่ 77/25 ชั้น 5 ห้อง 503', N'โครงการเดอะนิมมาน พรีเมียม คอนโดมิเนียม หมู่ 6', N'ซอยนิมมานเหมินท์ 9 ถนนนิมมานเหมินท์', N'สุเทพ', N'เมืองเชียงใหม่', N'เชียงใหม่', N'50200', 1);
INSERT INTO dbo.address (address_id, customer_id, recipient, phone, house_no, village, road, subdistrict, district, province, postal_code, is_default) VALUES (49, 7, N'ธนาธิป ประเสริฐยิ่ง', N'086-789-0123', N'เลขที่ 215/84 ซอย 4 บล็อค B', N'หมู่บ้านคาซ่า แกรนด์ มิตรสัมพันธ์-บางแสน หมู่ 3', N'ซอยมิตรสัมพันธ์ 13 ถนนลงหาดบางแสน', N'แสนสุข', N'เมืองชลบุรี', N'ชลบุรี', N'20130', 1);
INSERT INTO dbo.address (address_id, customer_id, recipient, phone, house_no, village, road, subdistrict, district, province, postal_code, is_default) VALUES (50, 8, N'ศิริพร มณีโชติ', N'087-890-1234', N'เลขที่ 64/119 ซอยลดาวัลย์ 8 โซนการ์เดน', N'หมู่บ้านลดาวัลย์ ศรีนครินทร์ โครงการ 2 หมู่ 5', N'ซอยศรีด่าน 22 ถนนศรีนครินทร์', N'บางแก้ว', N'บางพลี', N'สมุทรปราการ', N'10540', 1);
INSERT INTO dbo.address (address_id, customer_id, recipient, phone, house_no, village, road, subdistrict, district, province, postal_code, is_default) VALUES (51, 9, N'อนุชา อักษรศรี', N'088-901-2345', N'เลขที่ 159/37 ซอยมิตรภาพ 19 แยก 4', N'หมู่บ้านสีมานคร วิลเลจ แกรนด์พาร์ค หมู่ 1', N'ซอยมิตรภาพร่วมใจ ถนนมิตรภาพสายหลัก', N'ในเมือง', N'เมืองนครราชสีมา', N'นครราชสีมา', N'30000', 1);
INSERT INTO dbo.address (address_id, customer_id, recipient, phone, house_no, village, road, subdistrict, district, province, postal_code, is_default) VALUES (52, 10, N'กัญญาณัฐ สัจธรรม', N'089-012-3456', N'เลขที่ 33/72 ซอย 22 เฟสเลควิว', N'หมู่บ้านสราญสิริ ท่าข้าม-พระราม 2 โครงการหรู', N'ซอยท่าข้าม 7 แยก 4 ถนนพระราม 2', N'ท่าข้าม', N'บางขุนเทียน', N'กรุงเทพมหานคร', N'10150', 1);
INSERT INTO dbo.address (address_id, customer_id, recipient, phone, house_no, village, road, subdistrict, district, province, postal_code, is_default) VALUES (53, 11, N'ธีรภัทร จินดารัตน์', N'090-123-4567', N'เลขที่ 512/93 ชั้น 7 ห้อง 704 อาคาร A', N'คอนโดกัลปพฤกษ์ พาร์ค ขอนแก่น แอร์พอร์ต หมู่ 5', N'ซอยมะลิวัลย์ 14 ถนนมะลิวัลย์', N'ในเมือง', N'เมืองขอนแก่น', N'ขอนแก่น', N'40000', 1);
INSERT INTO dbo.address (address_id, customer_id, recipient, phone, house_no, village, road, subdistrict, district, province, postal_code, is_default) VALUES (54, 12, N'ปริยากร อินทร์แก้ว', N'091-234-5678', N'เลขที่ 28/46 ชั้น 3 ห้องพูลวิลล่า A3', N'เดอะรอยัล ภูเก็ต มารีนา ลักชัวรี เรสซิเดนซ์ หมู่ 2', N'ซอยเกาะแก้ว 24 ถนนเทพกระษัตรี', N'ตลาดใหญ่', N'เมืองภูเก็ต', N'ภูเก็ต', N'83000', 1);
INSERT INTO dbo.address (address_id, customer_id, recipient, phone, house_no, village, road, subdistrict, district, province, postal_code, is_default) VALUES (55, 13, N'ภาณุพงศ์ รุ่งเรือง', N'092-345-6789', N'เลขที่ 90/118 ซอยคาซ่า 5 ซอยย่อย 3', N'หมู่บ้านคาซ่า วิลล์ ราชพฤกษ์-พระราม 5 หมู่ 4', N'ซอยบางรักน้อย 18 ถนนราชพฤกษ์', N'บางรักน้อย', N'เมืองนนทบุรี', N'นนทบุรี', N'11000', 1);
INSERT INTO dbo.address (address_id, customer_id, recipient, phone, house_no, village, road, subdistrict, district, province, postal_code, is_default) VALUES (56, 14, N'อภิญญา พงษ์พาณิชย์', N'093-456-7890', N'เลขที่ 14/255 ซอยสุรนารายณ์ 11/3', N'หมู่บ้านเซเรเน่การ์เด้น โคราช วิลล่า หมู่ 8', N'ซอยบ้านเกาะร่วมพัฒนา ถนนสุรนารายณ์', N'บ้านเกาะ', N'เมืองนครราชสีมา', N'นครราชสีมา', N'30000', 1);
INSERT INTO dbo.address (address_id, customer_id, recipient, phone, house_no, village, road, subdistrict, district, province, postal_code, is_default) VALUES (57, 15, N'กรกช ตันติวิวัฒน์', N'094-567-8901', N'เลขที่ 119/53 ซอยรามอินทรา 65 แยก 2-4', N'หมู่บ้านชัยพฤกษ์ รามอินทรา-วงแหวน ซอย 12', N'ซอยคู้บอน 27 แยก 10 ถนนรามอินทรา', N'คันนายาว', N'คันนายาว', N'กรุงเทพมหานคร', N'10230', 1);
INSERT INTO dbo.address (address_id, customer_id, recipient, phone, house_no, village, road, subdistrict, district, province, postal_code, is_default) VALUES (58, 16, N'มนัสวี ศรีสุวรรณ', N'095-678-9012', N'เลขที่ 67/124 ชั้น 10 อาคารแกรนด์ C', N'เดอะไฮทส์ คอนโดมิเนียม แอท ช้างเผือก หมู่ 7', N'ซอยสุขเกษม 4 ถนนซุปเปอร์ไฮเวย์ เชียงใหม่-ลำปาง', N'ช้างเผือก', N'เมืองเชียงใหม่', N'เชียงใหม่', N'50300', 1);
INSERT INTO dbo.address (address_id, customer_id, recipient, phone, house_no, village, road, subdistrict, district, province, postal_code, is_default) VALUES (59, 17, N'พงศธร ศักดิ์เจริญ', N'096-789-0123', N'เลขที่ 203/67 ชั้น 18 ห้องวิวทะเล 1802', N'ลุมพินี วิลล์ นาเกลือ-วงศ์อมาตย์ เฟสบี หมู่ 1', N'ซอยนาเกลือ 16/1 ถนนสุขุมวิท-พัทยา', N'นาเกลือ', N'บางละมุง', N'ชลบุรี', N'20150', 1);
INSERT INTO dbo.address (address_id, customer_id, recipient, phone, house_no, village, road, subdistrict, district, province, postal_code, is_default) VALUES (60, 18, N'ลลิตา วรเวช', N'097-890-1234', N'เลขที่ 55/182 ซอยแจ้งวัฒนะ-ปากเกร็ด 43 แยก 6', N'หมู่บ้านเพอร์เฟค เพลส แจ้งวัฒนะ โครงการพรีเมียม', N'ซอยคลองเกลือ 12 ถนนแจ้งวัฒนะ', N'บางพูด', N'ปากเกร็ด', N'นนทบุรี', N'11120', 1);
INSERT INTO dbo.address (address_id, customer_id, recipient, phone, house_no, village, road, subdistrict, district, province, postal_code, is_default) VALUES (61, 19, N'ศรัณย์ ธรรมทัศน์', N'098-901-2345', N'เลขที่ 84/39 ซอยชะอำใต้ 7 แปลงริมสระว่ายน้ำ', N'วิลล่า มาลี บีชไซด์ รีสอร์ทแอนด์เรสซิเดนซ์ หมู่ 3', N'ซอยร่วมจิตรพัฒนา ถนนเพชรเกษมสายใต้', N'ชะอำ', N'ชะอำ', N'เพชรบุรี', N'76120', 1);
INSERT INTO dbo.address (address_id, customer_id, recipient, phone, house_no, village, road, subdistrict, district, province, postal_code, is_default) VALUES (62, 20, N'นภัสสร กิตติคุณ', N'099-012-3456', N'เลขที่ 310/25 ซอย 18 ซอยย่อยมัณฑนา 4', N'หมู่บ้านมัณฑนา วงแหวน-บางแค โครงการ 1', N'ซอยเพชรเกษม 63 แยก 8 ถนนกาญจนาภิเษก', N'บางแค', N'บางแค', N'กรุงเทพมหานคร', N'10160', 1);
INSERT INTO dbo.address (address_id, customer_id, recipient, phone, house_no, village, road, subdistrict, district, province, postal_code, is_default) VALUES (63, 21, N'ชานนท์ วิมลศิลป์', N'080-123-4567', N'เลขที่ 42/158 ซอยพัฒนาอุดร 6 เฟสการ์เดน 2', N'หมู่บ้านสิทธาการ์เด้นท์ โฮม อุดรธานีการ์เดน หมู่ 5', N'ซอยบ้านหนองขาม 12 ถนนรอบเมืองสายเหนือ', N'หมากแข้ง', N'เมืองอุดรธานี', N'อุดรธานี', N'41000', 1);
INSERT INTO dbo.address (address_id, customer_id, recipient, phone, house_no, village, road, subdistrict, district, province, postal_code, is_default) VALUES (64, 22, N'Jiraporn konsoi', N'0819551245', N'11', N'หมู่บ้านสัมกร', N'กรุงเทพกรีฑรา', N'ทับช้าง', N'สะพานสูง', N'กรุงเทพมหานคร', N'10250', 1);
SET IDENTITY_INSERT dbo.address OFF;

-- ตาราง dbo.product (33 รายการ)
SET IDENTITY_INSERT dbo.product ON;
INSERT INTO dbo.product (product_id, name, category, description, status, stock, quantity, price, supplier_id, employee_id, image_url, is_featured, created_at) VALUES (24, N'Classic Fit Mesh Polo', N'เสื้อโปโล', N'brand:Polo Ralph Lauren', N'active', 150, 150, 2900, 3, 2, N'https://is8.revolveassets.com/images/p4/n/z/PLAU-MS38_V1.jpg', 1, '2026-11-17 14:46:27');
INSERT INTO dbo.product (product_id, name, category, description, status, stock, quantity, price, supplier_id, employee_id, image_url, is_featured, created_at) VALUES (28, N'Ronron Pattern Logo Basic Fit T Shirt White Navy (Women''s)', N'เสื้อยืด', N'เนื้อผ้าคอตตอน', N'active', 58, 58, 790, 2, 1, N'https://img.sasom.co.th/rr4285wn-ronron-pattern-logo-basic-fit-t-shirt-white-navy-women-s-1.jpg?width=640&quality=75', 1, '2026-11-17 15:48:59');
INSERT INTO dbo.product (product_id, name, category, description, status, stock, quantity, price, supplier_id, employee_id, image_url, is_featured, created_at) VALUES (30, N'Fleece Hoodie', N'เสื้อแขนยาว', N'brand:Polo Ralph Lauren', N'active', 150, 150, 3000, 2, 2, N'https://is8.revolveassets.com/images/p4/n/z/PLAU-MK9M_V1.jpg', 1, '2026-11-17 15:49:26');
INSERT INTO dbo.product (product_id, name, category, description, status, stock, quantity, price, supplier_id, employee_id, image_url, is_featured, created_at) VALUES (31, N'90''S Crewneck Sweatshirt', N'เสื้อแขนยาว', N'brand:Fear of God ESSENTIALS', N'active', 100, 100, 3600, 2, 2, N'https://is8.revolveassets.com/images/p4/n/z/FALF-MK61_V1.jpg', 1, '2026-11-17 15:51:39');
INSERT INTO dbo.product (product_id, name, category, description, status, stock, quantity, price, supplier_id, employee_id, image_url, is_featured, created_at) VALUES (32, N'T-SHIRT ACTIF EMBLEM WHITE PINK F', N'เสื้อยืด', N'คอลเลคชั่นล่าสุดจาก MARDI MERCREDI แบรนด์แฟชั่นสุดไอคอนิกจากเกาหลีใต้ วัสดุผ้า ฝ้าย/ คอตตอน รูปแบบเสื้อคอกลม', N'active', 40, 40, 1190, 2, 1, N'https://www.central.co.th/_next/image?url=https%3A%2F%2Fassets.central.co.th%2Ffile-assets%2FCDSPIM%2Fweb%2FImage%2FCDS2259%2Fmardimercrediactif-tshirtactifemblemwhitepinkf-CDS22597717-1.webp&w=1080&q=75', 1, '2026-11-17 15:52:46');
INSERT INTO dbo.product (product_id, name, category, description, status, stock, quantity, price, supplier_id, employee_id, image_url, is_featured, created_at) VALUES (33, N'Fear of God ESSENTIALS', N'เสื้อแขนยาว', N'Fear of God ESSENTIALS', N'active', 100, 100, 2999, 3, 1, N'https://is8.revolveassets.com/images/p4/n/z/FALF-MK59_V1.jpg', 1, '2026-11-17 15:56:30');
INSERT INTO dbo.product (product_id, name, category, description, status, stock, quantity, price, supplier_id, employee_id, image_url, is_featured, created_at) VALUES (34, N'Tshirt Nez Tout Rose 02 Ivory Pink F', N'เสื้อยืด', N'ประเทศเจ้าของแบรนด์ เกาหลีใต้
เพศ  ผู้หญิง ขนาด  ฟรีไซส์', N'active', 40, 40, 1790, 3, 2, N'https://www.central.co.th/_next/image?url=https%3A%2F%2Fassets.central.co.th%2Ffile-assets%2FCDSPIM%2Fweb%2FImage%2FCDS3203%2FMARDIMERCREDI-TSHIRTNEZTOUTROSE02IVORYPINKF-CDS32033793-1.webp&w=1080&q=75', 1, '2026-11-17 15:58:23');
INSERT INTO dbo.product (product_id, name, category, description, status, stock, quantity, price, supplier_id, employee_id, image_url, is_featured, created_at) VALUES (35, N'Polo Bear Fleece Sweatshirt', N'เสื้อแขนยาว', N'brand:Polo Ralph Lauren', N'active', 160, 160, 2400, 1, 1, N'https://is8.revolveassets.com/images/p4/n/z/PLAU-MK263_V1.jpg', 0, '2026-11-17 16:01:36');
INSERT INTO dbo.product (product_id, name, category, description, status, stock, quantity, price, supplier_id, employee_id, image_url, is_featured, created_at) VALUES (37, N'Collegiate Sweatshirt', N'เสื้อแขนยาว', N'Malbon', N'active', 175, 175, 5600, 3, 2, N'https://is8.revolveassets.com/images/p4/n/z/MGOL-MK46_V1.jpg', 0, '2026-11-17 16:09:34');
INSERT INTO dbo.product (product_id, name, category, description, status, stock, quantity, price, supplier_id, employee_id, image_url, is_featured, created_at) VALUES (38, N'Script Logo Skate Hoodie', N'เสื้อแขนยาว', N'brand:OFF-WHITE', N'active', 80, 80, 19999, NULL, 1, N'https://is8.revolveassets.com/images/p4/n/z/OFFF-MK152_V1.jpg', 0, '2026-11-17 16:12:23');
INSERT INTO dbo.product (product_id, name, category, description, status, stock, quantity, price, supplier_id, employee_id, image_url, is_featured, created_at) VALUES (39, N'Stripe Rugby Polo', N'เสื้อแขนยาว', N'Polo Ralph Lauren', N'active', 100, 100, 4800, 3, 2, N'https://is8.revolveassets.com/images/p4/n/z/PLAU-MS541_V1.jpg', 0, '2026-11-17 16:18:00');
INSERT INTO dbo.product (product_id, name, category, description, status, stock, quantity, price, supplier_id, employee_id, image_url, is_featured, created_at) VALUES (40, N'Lee ON THE GO Women’s T-Shirt Pink', N'เสื้อยืด', N'เสื้อยืดแขนสั้นผู้หญิง คอลเลคชั่น On The Go Boyfriend Fit สีชมพู ผลิตจาก คอตตอน 100% ระบายอากาศได้ดี สวมใส่สบาย ไม่ร้อน ให้สัมผัสที่นุ่มและสบาย เหมาะกับการสวมใส่ในชีวิตประจำวัน เนื้อผ้าให้ความรู้สึกเป็นธรรมชาติและระบายอากาศได้ดี', N'active', 75, 75, 690, 2, 1, N'https://www.central.co.th/_next/image?url=https%3A%2F%2Fassets.central.co.th%2Ffile-assets%2FCDSPIM%2Fweb%2FImage%2FMKP1093%2FLEE-WOMENSSHORTSLEEVETSHIRTONTHEGOCOLLECTIONBOYFRIENDFITPINK-MKP1093361409-1.webp&w=1080&q=75', 0, '2026-11-17 16:18:46');
INSERT INTO dbo.product (product_id, name, category, description, status, stock, quantity, price, supplier_id, employee_id, image_url, is_featured, created_at) VALUES (41, N'Signature Classic Half Zip Sweatshirt', N'เสื้อแขนยาว', N'brand:Fear of God ESSENTIALS', N'active', 120, 120, 5888, 1, 2, N'https://is8.revolveassets.com/images/p4/n/z/FALF-MK136_V1.jpg', 0, '2026-11-17 16:21:43');
INSERT INTO dbo.product (product_id, name, category, description, status, stock, quantity, price, supplier_id, employee_id, image_url, is_featured, created_at) VALUES (42, N'maison mihara yasuhiro', N'เสื้อยืด', N'วัสดุ ผ้าฝ้าย 100% เสื้อยืดตัวนี้มีรายละเอียดเป็นลายพิมพ์กราฟิกแบบวาดเล่นของลีออน ซึ่งมีลักษณะเหมือนภาพวาดด้วยมือ', N'active', 15, 15, 11900, 2, 1, N'https://cdn-images.farfetch-contents.com/38/64/63/84/38646384_71929619_1000.jpg', 0, '2026-11-17 16:27:24');
INSERT INTO dbo.product (product_id, name, category, description, status, stock, quantity, price, supplier_id, employee_id, image_url, is_featured, created_at) VALUES (43, N'Short Sleeve Mesh Polo', N'เสื้อโปโล', N'brand:Polo Ralph Lauren', N'active', 180, 180, 3900, 3, 2, N'https://is8.revolveassets.com/images/p4/n/z/PLAU-MS263_V1.jpg', 1, '2026-11-17 16:33:20');
INSERT INTO dbo.product (product_id, name, category, description, status, stock, quantity, price, supplier_id, employee_id, image_url, is_featured, created_at) VALUES (44, N'FOUND', N'เสื้อยืด', N'วัสดุภายนอก ผ้าฝ้าย 100% ปักลายยีราฟด้านหน้า คอกลม แขนสั้น', N'active', 15, 15, 5200, 3, 2, N'https://cdn-images.farfetch-contents.com/37/52/60/23/37526023_70405666_1000.jpg', 0, '2026-11-17 16:37:26');
INSERT INTO dbo.product (product_id, name, category, description, status, stock, quantity, price, supplier_id, employee_id, image_url, is_featured, created_at) VALUES (46, N'Short Sleeve Basic Mesh Litchfield Bear Polo', N'เสื้อโปโล', N'Polo Ralph Lauren', N'active', 125, 125, 4890, 1, 2, N'https://is8.revolveassets.com/images/p4/n/z/PLAU-MS521_V1.jpg', 1, '2026-11-17 16:40:08');
INSERT INTO dbo.product (product_id, name, category, description, status, stock, quantity, price, supplier_id, employee_id, image_url, is_featured, created_at) VALUES (47, N'Mars Dog Disco', N'เสื้อยืด', N'พิมพ์ลายกราฟิกรูปสุนัข Mars พร้อมลวดลายโลโก้ “MCM Disco”
 ตัวผลิตภัณฑ์ ผ้าฝ้ายออร์แกนิก 100%', N'active', 60, 60, 8790, 2, 1, N'https://images.mcmworldwide.com/i/mcmworldwide/MHTGAMM01WT00L_01/-mars-dog-disco-white-l?$w1000$&fmt=auto&qlt=default', 0, '2026-11-17 16:45:09');
INSERT INTO dbo.product (product_id, name, category, description, status, stock, quantity, price, supplier_id, employee_id, image_url, is_featured, created_at) VALUES (48, N'Classic Fit Long Sleeve Polo', N'เสื้อโปโล', N'', N'active', 120, 120, 4200, 1, 2, N'https://is8.revolveassets.com/images/p4/n/uv/LACO-MS190_V1.jpg', 0, '2026-11-17 16:47:27');
INSERT INTO dbo.product (product_id, name, category, description, status, stock, quantity, price, supplier_id, employee_id, image_url, is_featured, created_at) VALUES (49, N'Classic Polo in Burgundy', N'เสื้อโปโล', N'Lacoste', N'active', 120, 120, 1999, 1, 2, N'https://is8.revolveassets.com/images/p4/n/uv/LACO-MS201_V1.jpg', 0, '2026-11-17 16:50:25');
INSERT INTO dbo.product (product_id, name, category, description, status, stock, quantity, price, supplier_id, employee_id, image_url, is_featured, created_at) VALUES (50, N'Bet Polo', N'เสื้อโปโล', N'ICECREAM', N'active', 125, 125, 4300, 3, 1, N'https://is8.revolveassets.com/images/p4/n/uv/ICER-MS90_V1.jpg', 0, '2026-11-17 16:53:45');
INSERT INTO dbo.product (product_id, name, category, description, status, stock, quantity, price, supplier_id, employee_id, image_url, is_featured, created_at) VALUES (51, N'Performance Pique Polo', N'เสื้อโปโล', N'HEAD Golf', N'active', 120, 120, 3456, 2, 2, N'https://is8.revolveassets.com/images/p4/n/uv/HGOL-MS9_V1.jpg', 1, '2026-11-17 16:57:25');
INSERT INTO dbo.product (product_id, name, category, description, status, stock, quantity, price, supplier_id, employee_id, image_url, is_featured, created_at) VALUES (52, N'What A Player', N'เสื้อโปโล', N'Carne Bollente', N'active', 200, 200, 4700, 1, 2, N'https://is8.revolveassets.com/images/p4/n/z/CBOL-MS12_V1.jpg', 0, '2026-11-17 17:01:36');
INSERT INTO dbo.product (product_id, name, category, description, status, stock, quantity, price, supplier_id, employee_id, image_url, is_featured, created_at) VALUES (54, N'Kobe', N'เสื้อยืด', N'เสื้อยืดบาสเก็ตบอลผู้ชาย Nike Dri-FIT', N'active', 35, 35, 11111, 1, 1, N'https://static.nike.com/a/images/c_limit,w_2880/f_auto,q_auto,u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/b41f11db-eef3-41be-beac-f0520a949b65/AS+KB+M+NK+DF+TEE+M90+SSNL2+FH.png', 0, '2026-11-17 17:07:41');
INSERT INTO dbo.product (product_id, name, category, description, status, stock, quantity, price, supplier_id, employee_id, image_url, is_featured, created_at) VALUES (55, N'Prima Motion T7', N'กางเกง', N'ผ้าไนลอน 100%', N'active', 80, 80, 1900, 2, 1, N'https://www.jdsports.co.th/cdn/shop/files/jd_641663-48_a.jpg?v=1793785118&width=1007', 1, '2026-11-17 17:09:02');
INSERT INTO dbo.product (product_id, name, category, description, status, stock, quantity, price, supplier_id, employee_id, image_url, is_featured, created_at) VALUES (56, N'Baggy Jean', N'กางเกง', N'FRAME', N'active', 200, 200, 8300, 1, 2, N'https://is8.revolveassets.com/images/p4/n/uv/FAMF-MJ102_V1.jpg', 1, '2026-11-17 17:12:34');
INSERT INTO dbo.product (product_id, name, category, description, status, stock, quantity, price, supplier_id, employee_id, image_url, is_featured, created_at) VALUES (58, N'Big Daddy Denim', N'กางเกง', N'424', N'active', 175, 175, 15000, 3, 2, N'https://is8.revolveassets.com/images/p4/n/z/424F-MJ5_V1.jpg', 1, '2026-11-17 17:15:46');
INSERT INTO dbo.product (product_id, name, category, description, status, stock, quantity, price, supplier_id, employee_id, image_url, is_featured, created_at) VALUES (59, N'Fusion Jean', N'กางเกง', N'AGOLDE', N'active', 150, 150, 7999, 1, 2, N'https://is8.revolveassets.com/images/p4/n/z/AGOF-MJ39_V1.jpg', 0, '2026-11-17 17:19:08');
INSERT INTO dbo.product (product_id, name, category, description, status, stock, quantity, price, supplier_id, employee_id, image_url, is_featured, created_at) VALUES (62, N'Fusion Jean', N'กางเกง', N'AGOLDE', N'active', 100, 100, 6290, 2, 1, N'https://is8.revolveassets.com/images/p4/n/uv/AGOF-MJ44_V1.jpg', 0, '2026-11-17 17:21:59');
INSERT INTO dbo.product (product_id, name, category, description, status, stock, quantity, price, supplier_id, employee_id, image_url, is_featured, created_at) VALUES (63, N'Satin Polka Dots', N'กางเกง', N'ตัดเย็บจากผ้าซาติน', N'active', 60, 60, 2700, 2, 1, N'https://www.jdsports.co.th/cdn/shop/files/jd_810593_c.jpg?v=1790642291&width=1007', 0, '2026-11-17 17:23:49');
INSERT INTO dbo.product (product_id, name, category, description, status, stock, quantity, price, supplier_id, employee_id, image_url, is_featured, created_at) VALUES (64, N'Lyon Jeans', N'กางเกง', N'Won Hundred', N'active', 165, 165, 10300, 3, 2, N'https://is8.revolveassets.com/images/p4/n/z/WONH-MJ13_V1.jpg', 0, '2026-11-17 17:25:08');
INSERT INTO dbo.product (product_id, name, category, description, status, stock, quantity, price, supplier_id, employee_id, image_url, is_featured, created_at) VALUES (65, N'Satin Polka Dots', N'กางเกง', N'เนื้อผ้าหลัก ผ้าซาติน', N'active', 80, 80, 2700, 2, 1, N'https://www.jdsports.co.th/cdn/shop/files/jd_810591_b.jpg?v=1793176773&width=1007', 0, '2026-11-17 17:26:20');
INSERT INTO dbo.product (product_id, name, category, description, status, stock, quantity, price, supplier_id, employee_id, image_url, is_featured, created_at) VALUES (66, N'Los Angeles Lakers', N'เสื้อยืด', N'เสื้อยืดใส่ก่อนลงสนามบาสเก็ตบอลผู้ชาย Noir&Cream', N'active', 75, 75, 1700, 2, 2, N'https://static.nike.com/a/images/t_PDP_1728_v1/f_auto,q_auto:eco,u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/d01dedfc-cfc7-455a-af38-b53a27dc9ef3/LAL+M+NK+SS+PREGAME+TEE.png', 1, '2026-11-18 06:03:19');
SET IDENTITY_INSERT dbo.product OFF;

-- ตาราง dbo.product_variant (142 รายการ)
SET IDENTITY_INSERT dbo.product_variant ON;
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (165, 24, N'S', N'ดำ', N'#000000', 2900, 30, 30, N'SKU-24-S-ดำ');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (166, 24, N'M', N'ดำ', N'#000000', 2900, 30, 30, N'SKU-24-M-ดำ');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (167, 24, N'L', N'ดำ', N'#000000', 2900, 30, 30, N'SKU-24-L-ดำ');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (168, 24, N'XL', N'ดำ', N'#000000', 2900, 30, 30, N'SKU-24-XL-ดำ');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (169, 24, N'2XL', N'ดำ', N'#000000', 2900, 30, 30, N'SKU-24-2XL-ดำ');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (182, 28, N'S', N'ขาว กรมท่า', N'#eaeaef', 790, 15, 15, N'SKU-28-S-ขาวกรมท่า');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (183, 28, N'M', N'ขาว กรมท่า', N'#eaeaef', 790, 13, 13, N'SKU-28-M-ขาวกรมท่า');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (184, 28, N'L', N'ขาว กรมท่า', N'#eaeaef', 790, 15, 15, N'SKU-28-L-ขาวกรมท่า');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (185, 28, N'XL', N'ขาว กรมท่า', N'#eaeaef', 790, 15, 15, N'SKU-28-XL-ขาวกรมท่า');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (190, 30, N'S', N'ดำ', N'#000000', 3000, 30, 30, N'SKU-30-S-ดำ');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (191, 30, N'M', N'ดำ', N'#000000', 3000, 30, 30, N'SKU-30-M-ดำ');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (192, 30, N'L', N'ดำ', N'#000000', 3000, 30, 30, N'SKU-30-L-ดำ');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (193, 30, N'XL', N'ดำ', N'#000000', 3000, 30, 30, N'SKU-30-XL-ดำ');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (194, 30, N'2XL', N'ดำ', N'#000000', 3299, 30, 30, N'SKU-30-2XL-ดำ');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (195, 31, N'S', N'ดำ', N'#000000', 3600, 25, 25, N'SKU-31-S-ดำ');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (196, 31, N'M', N'ดำ', N'#000000', 3600, 25, 25, N'SKU-31-M-ดำ');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (197, 31, N'L', N'ดำ', N'#000000', 3600, 25, 25, N'SKU-31-L-ดำ');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (198, 31, N'XL', N'ดำ', N'#000000', 3699, 25, 25, N'SKU-31-XL-ดำ');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (199, 32, N'S', N'ขาว ชมพู', N'#f7e2e7', 1190, 10, 10, N'SKU-32-S-ขาวชมพู');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (200, 32, N'M', N'ขาว ชมพู', N'#f7e2e7', 1190, 10, 10, N'SKU-32-M-ขาวชมพู');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (201, 32, N'L', N'ขาว ชมพู', N'#f7e2e7', 1190, 10, 10, N'SKU-32-L-ขาวชมพู');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (202, 32, N'XL', N'ขาว ชมพู', N'#f7e2e7', 1299, 10, 10, N'SKU-32-XL-ขาวชมพู');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (203, 33, N'S', N'สีครีมอ่อน / สีเบจอ่อนอมเทา', N'#dedcd7', 2999, 25, 25, N'SKU-33-S-สีครีมอ่อน/สีเบจอ่อนอมเทา');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (204, 33, N'M', N'สีครีมอ่อน / สีเบจอ่อนอมเทา', N'#dedcd7', 2999, 25, 25, N'SKU-33-M-สีครีมอ่อน/สีเบจอ่อนอมเทา');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (205, 33, N'L', N'สีครีมอ่อน / สีเบจอ่อนอมเทา', N'#dedcd7', 2999, 25, 25, N'SKU-33-L-สีครีมอ่อน/สีเบจอ่อนอมเทา');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (206, 33, N'XL', N'สีครีมอ่อน / สีเบจอ่อนอมเทา', N'#dedcd7', 2999, 25, 25, N'SKU-33-XL-สีครีมอ่อน/สีเบจอ่อนอมเทา');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (207, 34, N'S', N'ไอวอรี่ชมพู)', N'#f5e8e4', 1790, 10, 10, N'SKU-34-S-ไอวอรี่ชมพู)');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (208, 34, N'M', N'ไอวอรี่ชมพู)', N'#f5e8e4', 1790, 10, 10, N'SKU-34-M-ไอวอรี่ชมพู)');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (209, 34, N'L', N'ไอวอรี่ชมพู)', N'#f5e8e4', 1790, 10, 10, N'SKU-34-L-ไอวอรี่ชมพู)');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (210, 34, N'XL', N'ไอวอรี่ชมพู)', N'#f5e8e4', 1790, 10, 10, N'SKU-34-XL-ไอวอรี่ชมพู)');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (211, 35, N'S', N'สีครีมอ่อน / สีเบจอ่อนอมเทา', N'#62749a', 2400, 40, 40, N'SKU-35-S-สีครีมอ่อน/สีเบจอ่อนอมเทา');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (212, 35, N'M', N'สีครีมอ่อน / สีเบจอ่อนอมเทา', N'#62749a', 2400, 40, 40, N'SKU-35-M-สีครีมอ่อน/สีเบจอ่อนอมเทา');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (213, 35, N'L', N'สีครีมอ่อน / สีเบจอ่อนอมเทา', N'#62749a', 2400, 40, 40, N'SKU-35-L-สีครีมอ่อน/สีเบจอ่อนอมเทา');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (214, 35, N'XL', N'สีครีมอ่อน / สีเบจอ่อนอมเทา', N'#62749a', 2400, 40, 40, N'SKU-35-XL-สีครีมอ่อน/สีเบจอ่อนอมเทา');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (219, 37, N'S', N'สีขาวงาช้าง / สีครีมอ่อน', N'#eae7df', 5600, 35, 35, N'SKU-37-S-สีขาวงาช้าง/สีครีมอ่อน');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (220, 37, N'M', N'สีขาวงาช้าง / สีครีมอ่อน', N'#eae7df', 5600, 35, 35, N'SKU-37-M-สีขาวงาช้าง/สีครีมอ่อน');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (221, 37, N'L', N'สีขาวงาช้าง / สีครีมอ่อน', N'#eae7df', 5600, 35, 35, N'SKU-37-L-สีขาวงาช้าง/สีครีมอ่อน');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (222, 37, N'XL', N'สีขาวงาช้าง / สีครีมอ่อน', N'#eae7df', 5600, 35, 35, N'SKU-37-XL-สีขาวงาช้าง/สีครีมอ่อน');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (223, 37, N'2XL', N'สีขาวงาช้าง / สีครีมอ่อน', N'#eae7df', 5600, 35, 35, N'SKU-37-2XL-สีขาวงาช้าง/สีครีมอ่อน');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (224, 38, N'S', N'ดำ', N'#000000', 19999, 20, 20, N'SKU-38-S-ดำ');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (225, 38, N'M', N'ดำ', N'#000000', 19999, 20, 20, N'SKU-38-M-ดำ');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (226, 38, N'L', N'ดำ', N'#000000', 19999, 20, 20, N'SKU-38-L-ดำ');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (227, 38, N'XL', N'ดำ', N'#000000', 21000, 20, 20, N'SKU-38-XL-ดำ');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (228, 39, N'S', N'สีกรมท่า / สีขาว', N'#373e54', 4800, 25, 25, N'SKU-39-S-สีกรมท่า/สีขาว');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (229, 39, N'M', N'สีกรมท่า / สีขาว', N'#373e54', 4800, 25, 25, N'SKU-39-M-สีกรมท่า/สีขาว');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (230, 39, N'L', N'สีกรมท่า / สีขาว', N'#373e54', 4800, 25, 25, N'SKU-39-L-สีกรมท่า/สีขาว');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (231, 39, N'XL', N'สีกรมท่า / สีขาว', N'#373e54', 4800, 25, 25, N'SKU-39-XL-สีกรมท่า/สีขาว');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (232, 40, N'S', N'ชมพูพาสเทล', N'#f4c5cd', 690, 25, 25, N'SKU-40-S-ชมพูพาสเทล');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (233, 40, N'M', N'ชมพูพาสเทล', N'#f4c5cd', 690, 25, 25, N'SKU-40-M-ชมพูพาสเทล');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (234, 40, N'L', N'ชมพูพาสเทล', N'#f4c5cd', 690, 25, 25, N'SKU-40-L-ชมพูพาสเทล');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (235, 41, N'S', N'สีเทาชาร์โคล / สีเทาเข้มอมเขีย', N'#4a4a47', 5888, 30, 30, N'SKU-41-S-สีเทาชาร์โคล/สีเทาเข้มอมเขีย');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (236, 41, N'M', N'สีเทาชาร์โคล / สีเทาเข้มอมเขีย', N'#4a4a47', 5888, 30, 30, N'SKU-41-M-สีเทาชาร์โคล/สีเทาเข้มอมเขีย');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (237, 41, N'L', N'สีเทาชาร์โคล / สีเทาเข้มอมเขีย', N'#4a4a47', 5888, 30, 30, N'SKU-41-L-สีเทาชาร์โคล/สีเทาเข้มอมเขีย');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (238, 41, N'XL', N'สีเทาชาร์โคล / สีเทาเข้มอมเขีย', N'#4a4a47', 5888, 30, 30, N'SKU-41-XL-สีเทาชาร์โคล/สีเทาเข้มอมเขีย');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (239, 42, N'M', N'เทา', N'#b3b3b3', 11900, 5, 5, N'SKU-42-M-เทา');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (240, 42, N'L', N'เทา', N'#b3b3b3', 11900, 5, 5, N'SKU-42-L-เทา');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (241, 42, N'XL', N'เทา', N'#b3b3b3', 11900, 5, 5, N'SKU-42-XL-เทา');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (242, 43, N'S', N'สีกรม', N'#262335', 3900, 45, 45, N'SKU-43-S-สีกรม');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (243, 43, N'M', N'สีกรม', N'#262335', 3900, 45, 45, N'SKU-43-M-สีกรม');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (244, 43, N'L', N'สีกรม', N'#262335', 3900, 45, 45, N'SKU-43-L-สีกรม');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (245, 43, N'XL', N'สีกรม', N'#262335', 3900, 45, 45, N'SKU-43-XL-สีกรม');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (246, 44, N'S', N'แดง', N'#c6242e', 5200, 5, 5, N'SKU-44-S-แดง');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (247, 44, N'M', N'แดง', N'#c6242e', 5200, 5, 5, N'SKU-44-M-แดง');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (248, 44, N'L', N'แดง', N'#c6242e', 5200, 5, 5, N'SKU-44-L-แดง');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (252, 46, N'S', N'สีน้ำตาล / สีน้ำตาลอิฐ', N'#8a6246', 4890, 25, 25, N'SKU-46-S-สีน้ำตาล/สีน้ำตาลอิฐ');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (253, 46, N'M', N'สีน้ำตาล / สีน้ำตาลอิฐ', N'#8a6246', 4890, 25, 25, N'SKU-46-M-สีน้ำตาล/สีน้ำตาลอิฐ');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (254, 46, N'L', N'สีน้ำตาล / สีน้ำตาลอิฐ', N'#8a6246', 4890, 25, 25, N'SKU-46-L-สีน้ำตาล/สีน้ำตาลอิฐ');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (255, 46, N'XL', N'สีน้ำตาล / สีน้ำตาลอิฐ', N'#8a6246', 4890, 25, 25, N'SKU-46-XL-สีน้ำตาล/สีน้ำตาลอิฐ');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (256, 46, N'2XL', N'สีน้ำตาล / สีน้ำตาลอิฐ', N'#8a6246', 4990, 25, 25, N'SKU-46-2XL-สีน้ำตาล/สีน้ำตาลอิฐ');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (257, 47, N'S', N'ขาว', N'#ffffff', 8790, 15, 15, N'SKU-47-S-ขาว');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (258, 47, N'M', N'ขาว', N'#ffffff', 8790, 15, 15, N'SKU-47-M-ขาว');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (259, 47, N'L', N'ขาว', N'#ffffff', 8790, 15, 15, N'SKU-47-L-ขาว');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (260, 47, N'XL', N'ขาว', N'#ffffff', 8790, 15, 15, N'SKU-47-XL-ขาว');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (261, 48, N'S', N'ครีม', N'#222236', 4200, 30, 30, N'SKU-48-S-ครีม');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (262, 48, N'M', N'ครีม', N'#222236', 4200, 30, 30, N'SKU-48-M-ครีม');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (263, 48, N'L', N'ครีม', N'#222236', 4200, 30, 30, N'SKU-48-L-ครีม');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (264, 48, N'XL', N'ครีม', N'#222236', 4200, 30, 30, N'SKU-48-XL-ครีม');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (265, 49, N'S', N'สีแดงเลือดหมูเข้ม', N'#3b2127', 1999, 30, 30, N'SKU-49-S-สีแดงเลือดหมูเข้ม');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (266, 49, N'M', N'สีแดงเลือดหมูเข้ม', N'#3b2127', 1999, 30, 30, N'SKU-49-M-สีแดงเลือดหมูเข้ม');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (267, 49, N'L', N'สีแดงเลือดหมูเข้ม', N'#3b2127', 1999, 30, 30, N'SKU-49-L-สีแดงเลือดหมูเข้ม');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (268, 49, N'XL', N'สีแดงเลือดหมูเข้ม', N'#3b2127', 1999, 30, 30, N'SKU-49-XL-สีแดงเลือดหมูเข้ม');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (269, 50, N'S', N'สีดำ / สีเทาตุ่น', N'#252424', 4300, 25, 25, N'SKU-50-S-สีดำ/สีเทาตุ่น');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (270, 50, N'M', N'สีดำ / สีเทาตุ่น', N'#252424', 4300, 25, 25, N'SKU-50-M-สีดำ/สีเทาตุ่น');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (271, 50, N'L', N'สีดำ / สีเทาตุ่น', N'#252424', 4300, 25, 25, N'SKU-50-L-สีดำ/สีเทาตุ่น');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (272, 50, N'XL', N'สีดำ / สีเทาตุ่น', N'#252424', 4300, 25, 25, N'SKU-50-XL-สีดำ/สีเทาตุ่น');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (273, 50, N'2XL', N'สีดำ / สีเทาตุ่น', N'#252424', 4399, 25, 25, N'SKU-50-2XL-สีดำ/สีเทาตุ่น');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (274, 51, N'S', N'สีฟ้าหม่น / สีฟ้าอมเทา', N'#b6bbc6', 3456, 30, 30, N'SKU-51-S-สีฟ้าหม่น/สีฟ้าอมเทา');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (275, 51, N'M', N'สีฟ้าหม่น / สีฟ้าอมเทา', N'#b6bbc6', 3456, 30, 30, N'SKU-51-M-สีฟ้าหม่น/สีฟ้าอมเทา');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (276, 51, N'L', N'สีฟ้าหม่น / สีฟ้าอมเทา', N'#b6bbc6', 3456, 30, 30, N'SKU-51-L-สีฟ้าหม่น/สีฟ้าอมเทา');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (277, 51, N'XL', N'สีฟ้าหม่น / สีฟ้าอมเทา', N'#b6bbc6', 3456, 30, 30, N'SKU-51-XL-สีฟ้าหม่น/สีฟ้าอมเทา');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (278, 52, N'S', N'สีเขียวเข้ม / สีขาวนวล', N'#264538', 4700, 40, 40, N'SKU-52-S-สีเขียวเข้ม/สีขาวนวล');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (279, 52, N'M', N'สีเขียวเข้ม / สีขาวนวล', N'#264538', 4700, 40, 40, N'SKU-52-M-สีเขียวเข้ม/สีขาวนวล');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (280, 52, N'L', N'สีเขียวเข้ม / สีขาวนวล', N'#264538', 4700, 40, 40, N'SKU-52-L-สีเขียวเข้ม/สีขาวนวล');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (281, 52, N'XL', N'สีเขียวเข้ม / สีขาวนวล', N'#264538', 4700, 40, 40, N'SKU-52-XL-สีเขียวเข้ม/สีขาวนวล');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (282, 52, N'2XL', N'สีเขียวเข้ม / สีขาวนวล', N'#264538', 4700, 40, 40, N'SKU-52-2XL-สีเขียวเข้ม/สีขาวนวล');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (287, 54, N'S', N'สีขาว', N'#ffffff', 11111, 7, 7, N'SKU-54-S-สีขาว');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (288, 54, N'M', N'สีขาว', N'#ffffff', 11111, 7, 7, N'SKU-54-M-สีขาว');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (289, 54, N'L', N'สีขาว', N'#ffffff', 11111, 7, 7, N'SKU-54-L-สีขาว');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (290, 54, N'XL', N'สีขาว', N'#ffffff', 11111, 7, 7, N'SKU-54-XL-สีขาว');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (291, 54, N'2XL', N'สีขาว', N'#ffffff', 11111, 7, 7, N'SKU-54-2XL-สีขาว');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (292, 55, N'28', N'ชมพู', N'#fce8ec', 1900, 20, 20, N'SKU-55-28-ชมพู');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (293, 55, N'30', N'ชมพู', N'#fce8ec', 1900, 20, 20, N'SKU-55-30-ชมพู');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (294, 55, N'32', N'ชมพู', N'#fce8ec', 1900, 20, 20, N'SKU-55-32-ชมพู');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (295, 55, N'34', N'ชมพู', N'#fce8ec', 1900, 20, 20, N'SKU-55-34-ชมพู');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (296, 56, N'28', N'สีขาวนวล / สีครีมอ่อน', N'#e8e5dc', 8300, 40, 40, N'SKU-56-28-สีขาวนวล/สีครีมอ่อน');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (297, 56, N'30', N'สีขาวนวล / สีครีมอ่อน', N'#e8e5dc', 8300, 40, 40, N'SKU-56-30-สีขาวนวล/สีครีมอ่อน');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (298, 56, N'32', N'สีขาวนวล / สีครีมอ่อน', N'#e8e5dc', 8300, 40, 40, N'SKU-56-32-สีขาวนวล/สีครีมอ่อน');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (299, 56, N'34', N'สีขาวนวล / สีครีมอ่อน', N'#e8e5dc', 8300, 40, 40, N'SKU-56-34-สีขาวนวล/สีครีมอ่อน');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (300, 56, N'36', N'สีขาวนวล / สีครีมอ่อน', N'#e8e5dc', 8399, 40, 40, N'SKU-56-36-สีขาวนวล/สีครีมอ่อน');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (305, 58, N'28', N'ครีม', N'#65798a', 15000, 35, 35, N'SKU-58-28-ครีม');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (306, 58, N'30', N'ครีม', N'#65798a', 15000, 35, 35, N'SKU-58-30-ครีม');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (307, 58, N'32', N'ครีม', N'#65798a', 15000, 35, 35, N'SKU-58-32-ครีม');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (308, 58, N'34', N'ครีม', N'#65798a', 15000, 35, 35, N'SKU-58-34-ครีม');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (309, 58, N'36', N'ครีม', N'#65798a', 16000, 35, 35, N'SKU-58-36-ครีม');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (310, 59, N'28', N'สีดำฟอก / สีเทาดำ', N'#3b3b3d', 7999, 30, 30, N'SKU-59-28-สีดำฟอก/สีเทาดำ');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (311, 59, N'30', N'สีดำฟอก / สีเทาดำ', N'#3b3b3d', 7999, 30, 30, N'SKU-59-30-สีดำฟอก/สีเทาดำ');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (312, 59, N'32', N'สีดำฟอก / สีเทาดำ', N'#3b3b3d', 7999, 30, 30, N'SKU-59-32-สีดำฟอก/สีเทาดำ');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (313, 59, N'34', N'สีดำฟอก / สีเทาดำ', N'#3b3b3d', 7999, 30, 30, N'SKU-59-34-สีดำฟอก/สีเทาดำ');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (314, 59, N'36', N'สีดำฟอก / สีเทาดำ', N'#3b3b3d', 7999, 30, 30, N'SKU-59-36-สีดำฟอก/สีเทาดำ');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (323, 62, N'28', N'สีส้มอิฐอมน้ำตาล / สีสนิม', N'#b87d64', 6290, 20, 20, N'SKU-62-28-สีส้มอิฐอมน้ำตาล/สีสนิม');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (324, 62, N'30', N'สีส้มอิฐอมน้ำตาล / สีสนิม', N'#b87d64', 6290, 20, 20, N'SKU-62-30-สีส้มอิฐอมน้ำตาล/สีสนิม');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (325, 62, N'32', N'สีส้มอิฐอมน้ำตาล / สีสนิม', N'#b87d64', 6290, 20, 20, N'SKU-62-32-สีส้มอิฐอมน้ำตาล/สีสนิม');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (326, 62, N'34', N'สีส้มอิฐอมน้ำตาล / สีสนิม', N'#b87d64', 6290, 20, 20, N'SKU-62-34-สีส้มอิฐอมน้ำตาล/สีสนิม');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (327, 62, N'36', N'สีส้มอิฐอมน้ำตาล / สีสนิม', N'#b87d64', 6290, 20, 20, N'SKU-62-36-สีส้มอิฐอมน้ำตาล/สีสนิม');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (328, 63, N'28', N'ชมพูซาติน', N'#dfc4c9', 2700, 15, 15, N'SKU-63-28-ชมพูซาติน');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (329, 63, N'30', N'ชมพูซาติน', N'#dfc4c9', 2700, 15, 15, N'SKU-63-30-ชมพูซาติน');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (330, 63, N'32', N'ชมพูซาติน', N'#dfc4c9', 2700, 15, 15, N'SKU-63-32-ชมพูซาติน');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (331, 63, N'34', N'ชมพูซาติน', N'#dfc4c9', 2700, 15, 15, N'SKU-63-34-ชมพูซาติน');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (332, 64, N'28', N'สีฟ้าอมเทาหม่น / สียีนส์ฟอกวิน', N'#7e919b', 10300, 33, 33, N'SKU-64-28-สีฟ้าอมเทาหม่น/สียีนส์ฟอกวิน');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (333, 64, N'30', N'สีฟ้าอมเทาหม่น / สียีนส์ฟอกวิน', N'#7e919b', 10300, 33, 33, N'SKU-64-30-สีฟ้าอมเทาหม่น/สียีนส์ฟอกวิน');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (334, 64, N'32', N'สีฟ้าอมเทาหม่น / สียีนส์ฟอกวิน', N'#7e919b', 10300, 33, 33, N'SKU-64-32-สีฟ้าอมเทาหม่น/สียีนส์ฟอกวิน');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (335, 64, N'34', N'สีฟ้าอมเทาหม่น / สียีนส์ฟอกวิน', N'#7e919b', 10300, 33, 33, N'SKU-64-34-สีฟ้าอมเทาหม่น/สียีนส์ฟอกวิน');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (336, 64, N'36', N'สีฟ้าอมเทาหม่น / สียีนส์ฟอกวิน', N'#7e919b', 10300, 33, 33, N'SKU-64-36-สีฟ้าอมเทาหม่น/สียีนส์ฟอกวิน');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (337, 65, N'28', N'สีน้ำตาล', N'#5b423d', 2700, 20, 20, N'SKU-65-28-สีน้ำตาล');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (338, 65, N'30', N'สีน้ำตาล', N'#5b423d', 2700, 20, 20, N'SKU-65-30-สีน้ำตาล');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (339, 65, N'32', N'สีน้ำตาล', N'#5b423d', 2700, 20, 20, N'SKU-65-32-สีน้ำตาล');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (340, 65, N'34', N'สีน้ำตาล', N'#5b423d', 2700, 20, 20, N'SKU-65-34-สีน้ำตาล');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (341, 66, N'S', N'เทาเข้ม', N'#555555', 1700, 15, 15, N'SKU-66-S-เทาเข้ม');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (342, 66, N'M', N'เทาเข้ม', N'#555555', 1700, 15, 15, N'SKU-66-M-เทาเข้ม');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (343, 66, N'L', N'เทาเข้ม', N'#555555', 1700, 15, 15, N'SKU-66-L-เทาเข้ม');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (344, 66, N'XL', N'เทาเข้ม', N'#555555', 1700, 15, 15, N'SKU-66-XL-เทาเข้ม');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (345, 66, N'2XL', N'เทาเข้ม', N'#555555', 1700, 15, 15, N'SKU-66-2XL-เทาเข้ม');
SET IDENTITY_INSERT dbo.product_variant OFF;

-- ตาราง dbo.cart_item (1 รายการ)
SET IDENTITY_INSERT dbo.cart_item ON;
INSERT INTO dbo.cart_item (cart_id, customer_id, variant_id, product_id, quantity, total_price) VALUES (9, 1, 194, 30, 1, 3299);
SET IDENTITY_INSERT dbo.cart_item OFF;

-- ตาราง dbo.[order] (1 รายการ)
SET IDENTITY_INSERT dbo.[order] ON;
INSERT INTO dbo.[order] (order_id, customer_id, product_id, order_date, status, subtotal, discount, shipping_fee, total_price, coupon_code, ship_name, ship_phone, ship_address) VALUES (8, 22, 28, '2026-11-17 16:16:50', N'completed', 1580, 0, 0, 1580, NULL, N'Jiraporn konsoi', N'0819551245', N'11 หมู่บ้านสัมกร กรุงเทพกรีฑรา ทับช้าง สะพานสูง กรุงเทพมหานคร 10250');
SET IDENTITY_INSERT dbo.[order] OFF;

-- ตาราง dbo.order_item (1 รายการ)
SET IDENTITY_INSERT dbo.order_item ON;
INSERT INTO dbo.order_item (order_item_id, order_id, variant_id, product_id, quantity, unit_price, total_price) VALUES (9, 8, 183, 28, 2, 790, 1580);
SET IDENTITY_INSERT dbo.order_item OFF;

-- ตาราง dbo.payment (1 รายการ)
SET IDENTITY_INSERT dbo.payment ON;
INSERT INTO dbo.payment (payment_id, order_id, method, status, amount, paid_at) VALUES (8, 8, N'โอนผ่านธนาคาร', N'paid', 1580, '2026-11-17 16:16:54');
SET IDENTITY_INSERT dbo.payment OFF;

-- ตาราง dbo.shipment (1 รายการ)
SET IDENTITY_INSERT dbo.shipment ON;
INSERT INTO dbo.shipment (shipment_id, tracking_no, payment_id, order_id, product_id, carrier, status, shipping_address, shipped_at) VALUES (5, N'TH1212312121', 8, 8, 28, N'Flash', N'delivered', N'11 หมู่บ้านสัมกร กรุงเทพกรีฑรา ทับช้าง สะพานสูง กรุงเทพมหานคร 10250', '2026-11-17 16:17:50');
SET IDENTITY_INSERT dbo.shipment OFF;

-- ตาราง dbo.review (1 รายการ)
SET IDENTITY_INSERT dbo.review ON;
INSERT INTO dbo.review (review_id, customer_id, product_id, first_name, last_name, rating, comment, review_date, created_at) VALUES (5, 22, 28, N'จิราภรณ์', N'ธาราสืบ', 5, N'👍👍เสื้อสวย', N'2026-11-17', '2026-11-17 16:19:03');
SET IDENTITY_INSERT dbo.review OFF;

-- ตาราง dbo.wishlist (2 รายการ)
INSERT INTO dbo.wishlist (customer_id, product_id) VALUES (1, 33);
INSERT INTO dbo.wishlist (customer_id, product_id) VALUES (1, 34);

COMMIT TRANSACTION;
SET NOCOUNT OFF;
GO

-- ============================================================================
-- 4. VERIFY REALTIME SUMMARY
-- ============================================================================
SELECT 'admin' AS Table_Name, COUNT(*) AS Total_Records FROM dbo.admin
UNION ALL SELECT 'employee' AS Table_Name, COUNT(*) AS Total_Records FROM dbo.employee
UNION ALL SELECT 'coupon' AS Table_Name, COUNT(*) AS Total_Records FROM dbo.coupon
UNION ALL SELECT 'supplier' AS Table_Name, COUNT(*) AS Total_Records FROM dbo.supplier
UNION ALL SELECT 'customer' AS Table_Name, COUNT(*) AS Total_Records FROM dbo.customer
UNION ALL SELECT 'address' AS Table_Name, COUNT(*) AS Total_Records FROM dbo.address
UNION ALL SELECT 'product' AS Table_Name, COUNT(*) AS Total_Records FROM dbo.product
UNION ALL SELECT 'product_variant' AS Table_Name, COUNT(*) AS Total_Records FROM dbo.product_variant
UNION ALL SELECT 'cart_item' AS Table_Name, COUNT(*) AS Total_Records FROM dbo.cart_item
UNION ALL SELECT 'order' AS Table_Name, COUNT(*) AS Total_Records FROM dbo.[order]
UNION ALL SELECT 'order_item' AS Table_Name, COUNT(*) AS Total_Records FROM dbo.order_item
UNION ALL SELECT 'payment' AS Table_Name, COUNT(*) AS Total_Records FROM dbo.payment
UNION ALL SELECT 'shipment' AS Table_Name, COUNT(*) AS Total_Records FROM dbo.shipment
UNION ALL SELECT 'review' AS Table_Name, COUNT(*) AS Total_Records FROM dbo.review
UNION ALL SELECT 'wishlist' AS Table_Name, COUNT(*) AS Total_Records FROM dbo.wishlist
UNION ALL SELECT 'review_like' AS Table_Name, COUNT(*) AS Total_Records FROM dbo.review_like;
GO
