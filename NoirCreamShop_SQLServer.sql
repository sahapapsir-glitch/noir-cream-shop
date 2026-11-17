-- ============================================================================
-- NOIR & CREAM CLOTHING SHOP — REALTIME MICROSOFT SQL SERVER DATABASE
-- Instance: .\SQLEXPRESS01 | Database: [NoirCreamShop]
-- Checksum: 343dcf9d93115427 | Updated: 2026-11-17T11:29:52.470Z
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
        first_name  NVARCHAR(60) NOT NULL,
        last_name   NVARCHAR(60) NOT NULL,
        email       NVARCHAR(120),
        phone       NVARCHAR(20),
        position    NVARCHAR(80),
        address     NVARCHAR(300)
    );
END
GO

IF OBJECT_ID('dbo.admin', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.admin (
        admin_id      INT IDENTITY(1,1) PRIMARY KEY,
        name          NVARCHAR(100) NOT NULL,
        email         NVARCHAR(120) NOT NULL UNIQUE,
        phone         NVARCHAR(20),
        password_hash NVARCHAR(255) NOT NULL
    );
END
GO

IF OBJECT_ID('dbo.supplier', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.supplier (
        supplier_id  INT IDENTITY(1,1) PRIMARY KEY,
        name         NVARCHAR(120) NOT NULL,
        contact_name NVARCHAR(80),
        phone        NVARCHAR(20),
        email        NVARCHAR(120),
        address      NVARCHAR(300),
        employee_id  INT NULL FOREIGN KEY REFERENCES dbo.employee(employee_id),
        admin_id     INT NULL FOREIGN KEY REFERENCES dbo.admin(admin_id)
    );
END
GO

IF OBJECT_ID('dbo.product', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.product (
        product_id  INT IDENTITY(1,1) PRIMARY KEY,
        name        NVARCHAR(150) NOT NULL,
        category    NVARCHAR(60) NOT NULL,
        description NVARCHAR(MAX),
        status      NVARCHAR(20) NOT NULL DEFAULT 'active',
        stock       INT NOT NULL DEFAULT 0,
        quantity    INT NOT NULL DEFAULT 0,
        price       DECIMAL(10,2) NOT NULL DEFAULT 0,
        supplier_id INT NULL FOREIGN KEY REFERENCES dbo.supplier(supplier_id),
        employee_id INT NULL FOREIGN KEY REFERENCES dbo.employee(employee_id),
        image_url   NVARCHAR(500),
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
        size           NVARCHAR(20) NOT NULL,
        color          NVARCHAR(40) NOT NULL,
        color_hex      NVARCHAR(20),
        price          DECIMAL(10,2) NOT NULL,
        stock          INT NOT NULL DEFAULT 0,
        stock_quantity INT NOT NULL DEFAULT 0,
        sku            NVARCHAR(60) UNIQUE
    );
END
GO

IF OBJECT_ID('dbo.customer', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.customer (
        customer_id   INT IDENTITY(1,1) PRIMARY KEY,
        first_name    NVARCHAR(60) NOT NULL,
        last_name     NVARCHAR(60) NOT NULL,
        phone         NVARCHAR(20),
        email         NVARCHAR(120) NOT NULL UNIQUE,
        address       NVARCHAR(300),
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
        recipient   NVARCHAR(80),
        phone       NVARCHAR(20),
        house_no    NVARCHAR(40),
        village     NVARCHAR(80),
        road        NVARCHAR(80),
        subdistrict NVARCHAR(80),
        district    NVARCHAR(80),
        province    NVARCHAR(80),
        postal_code NVARCHAR(10),
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
        code      NVARCHAR(30) PRIMARY KEY,
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
        status       NVARCHAR(30) NOT NULL DEFAULT 'pending',
        subtotal     DECIMAL(10,2) NOT NULL DEFAULT 0,
        discount     DECIMAL(10,2) NOT NULL DEFAULT 0,
        shipping_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
        total_price  DECIMAL(10,2) NOT NULL DEFAULT 0,
        coupon_code  NVARCHAR(30),
        ship_name    NVARCHAR(80),
        ship_phone   NVARCHAR(20),
        ship_address NVARCHAR(300)
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
        method     NVARCHAR(60) NOT NULL,
        status     NVARCHAR(30) NOT NULL DEFAULT 'pending',
        amount     DECIMAL(10,2) NOT NULL,
        paid_at    DATETIME2 NULL
    );
END
GO

IF OBJECT_ID('dbo.shipment', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.shipment (
        shipment_id      INT IDENTITY(1,1) PRIMARY KEY,
        tracking_no      NVARCHAR(60),
        payment_id       INT NOT NULL FOREIGN KEY REFERENCES dbo.payment(payment_id) ON DELETE CASCADE,
        order_id         INT NOT NULL FOREIGN KEY REFERENCES dbo.[order](order_id),
        product_id       INT NULL FOREIGN KEY REFERENCES dbo.product(product_id),
        carrier          NVARCHAR(60),
        status           NVARCHAR(30) NOT NULL DEFAULT 'preparing',
        shipping_address NVARCHAR(300),
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
        first_name  NVARCHAR(60),
        last_name   NVARCHAR(60),
        rating      INT NOT NULL CHECK(rating BETWEEN 1 AND 5),
        comment     NVARCHAR(MAX),
        review_date NVARCHAR(20) DEFAULT '',
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
INSERT INTO dbo.admin (admin_id, name, email, phone, password_hash) VALUES (1, N'ภูวมินทร์ วัฒนสาร', N'phuwamin@shop.com', N'081-000-0001', N'$2b$10$lGZcnGBz3xD1MhZ2nUc81u.PmC68jYdBilDyYVJUHgbN56CV8nxQ6');
INSERT INTO dbo.admin (admin_id, name, email, phone, password_hash) VALUES (2, N'ธนกร อิ่มเพ็ง', N'thanakorn@shop.com', N'081-000-0002', N'$2b$10$S4XqHZFKxd9hFW48FMMWR.Fpg1dV1zRmM3.CotXctvETrrvTFbxY2');
INSERT INTO dbo.admin (admin_id, name, email, phone, password_hash) VALUES (3, N'ธนดล สมจิตต์', N'thanadon@shop.com', N'081-000-0003', N'$2b$10$G5UE5TruB00szHUc0GY8seiz98aEtRpJrAOOnn7oZPpCAVqWB9gqK');
INSERT INTO dbo.admin (admin_id, name, email, phone, password_hash) VALUES (4, N'สหภาพ ศิริพร', N'sahapap@shop.com', N'081-000-0004', N'$2b$10$dWgMhApPzmNHSlFuuETXv.kMJll7xc8ymEfqg5wIZK1aMQRLkY0XG');
INSERT INTO dbo.admin (admin_id, name, email, phone, password_hash) VALUES (5, N'ปวริศา โสมี', N'pawarisa@shop.com', N'081-000-0005', N'$2b$10$u3k3aahmoBbBiEaco4ESs.l7c8CDgmRcDCweec5o5o1L8eNwvgrZu');
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

-- ตาราง dbo.customer (1 รายการ)
SET IDENTITY_INSERT dbo.customer ON;
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (1, N'สมชาย', N'ทดสอบ', N'089-999-9999', N'demo@shop.com', N'99/1 หมู่บ้านสุขใจ ถนนบางนา-ตราด บางพลีใหญ่ บางพลี สมุทรปราการ 10540', 1, N'$2b$10$ZOb/yCkPVuDXc9kPaJHQreOI7VIqIIV7hJ.SH2jDhB6YA7na.5yvq', '2026-11-10 07:35:51');
SET IDENTITY_INSERT dbo.customer OFF;

-- ตาราง dbo.address (1 รายการ)
SET IDENTITY_INSERT dbo.address ON;
INSERT INTO dbo.address (address_id, customer_id, recipient, phone, house_no, village, road, subdistrict, district, province, postal_code, is_default) VALUES (1, 1, N'สมชาย ทดสอบ', N'089-999-9999', N'99/1', N'หมู่บ้านสุขใจ', N'ถนนบางนา-ตราด', N'บางพลีใหญ่', N'บางพลี', N'สมุทรปราการ', N'10540', 1);
SET IDENTITY_INSERT dbo.address OFF;

-- ตาราง dbo.product (1 รายการ)
SET IDENTITY_INSERT dbo.product ON;
INSERT INTO dbo.product (product_id, name, category, description, status, stock, quantity, price, supplier_id, employee_id, image_url, is_featured, created_at) VALUES (19, N'Kobe', N'เสื้อยืด', N'เสื้อยืดบาสเก็ตบอลผู้ชาย Nike Dri-FIT', N'active', 37, 37, 11111, 2, 1, N'https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto,u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/b41f11db-eef3-41be-beac-f0520a949b65/AS+KB+M+NK+DF+TEE+M90+SSNL2+FH.png', 1, '2026-11-11 15:31:30');
SET IDENTITY_INSERT dbo.product OFF;

-- ตาราง dbo.product_variant (4 รายการ)
SET IDENTITY_INSERT dbo.product_variant ON;
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (116, 19, N'S', N'ขาว', N'#ffffff', 11111, 7, 7, N'SKU-19-S-ขาว');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (117, 19, N'M', N'ขาว', N'#ffffff', 11111, 10, 10, N'SKU-19-M-ขาว');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (118, 19, N'L', N'ขาว', N'#ffffff', 11111, 10, 10, N'SKU-19-L-ขาว');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (119, 19, N'XL', N'ขาว', N'#ffffff', 11111, 10, 10, N'SKU-19-XL-ขาว');
SET IDENTITY_INSERT dbo.product_variant OFF;

-- ตาราง dbo.[order] (3 รายการ)
SET IDENTITY_INSERT dbo.[order] ON;
INSERT INTO dbo.[order] (order_id, customer_id, product_id, order_date, status, subtotal, discount, shipping_fee, total_price, coupon_code, ship_name, ship_phone, ship_address) VALUES (5, 1, 19, '2026-11-16 23:35:48', N'completed', 11111, 1111, 0, 10000, N'WELCOME10', N'สมชาย ทดสอบ', N'089-999-9999', N'99/1 หมู่บ้านสุขใจ ถนนบางนา-ตราด บางพลีใหญ่ บางพลี สมุทรปราการ 10540');
INSERT INTO dbo.[order] (order_id, customer_id, product_id, order_date, status, subtotal, discount, shipping_fee, total_price, coupon_code, ship_name, ship_phone, ship_address) VALUES (6, 1, 19, '2026-11-17 06:27:52', N'shipped', 11111, 0, 0, 11111, NULL, N'สมชาย ทดสอบ', N'089-999-9999', N'99/1 หมู่บ้านสุขใจ ถนนบางนา-ตราด บางพลีใหญ่ บางพลี สมุทรปราการ 10540');
INSERT INTO dbo.[order] (order_id, customer_id, product_id, order_date, status, subtotal, discount, shipping_fee, total_price, coupon_code, ship_name, ship_phone, ship_address) VALUES (7, 1, 19, '2026-11-17 07:13:36', N'shipped', 11111, 1111, 0, 10000, N'WELCOME10', N'สมชาย ทดสอบ', N'089-999-9999', N'99/1 หมู่บ้านสุขใจ ถนนบางนา-ตราด บางพลีใหญ่ บางพลี สมุทรปราการ 10540');
SET IDENTITY_INSERT dbo.[order] OFF;

-- ตาราง dbo.order_item (3 รายการ)
SET IDENTITY_INSERT dbo.order_item ON;
INSERT INTO dbo.order_item (order_item_id, order_id, variant_id, product_id, quantity, unit_price, total_price) VALUES (6, 5, 116, 19, 1, 11111, 11111);
INSERT INTO dbo.order_item (order_item_id, order_id, variant_id, product_id, quantity, unit_price, total_price) VALUES (7, 6, 116, 19, 1, 11111, 11111);
INSERT INTO dbo.order_item (order_item_id, order_id, variant_id, product_id, quantity, unit_price, total_price) VALUES (8, 7, 116, 19, 1, 11111, 11111);
SET IDENTITY_INSERT dbo.order_item OFF;

-- ตาราง dbo.payment (3 รายการ)
SET IDENTITY_INSERT dbo.payment ON;
INSERT INTO dbo.payment (payment_id, order_id, method, status, amount, paid_at) VALUES (5, 5, N'โอนผ่านธนาคาร', N'paid', 10000, '2026-11-16 23:35:50');
INSERT INTO dbo.payment (payment_id, order_id, method, status, amount, paid_at) VALUES (6, 6, N'โอนผ่านธนาคาร', N'paid', 11111, '2026-11-17 06:27:58');
INSERT INTO dbo.payment (payment_id, order_id, method, status, amount, paid_at) VALUES (7, 7, N'โอนผ่านธนาคาร', N'paid', 10000, '2026-11-17 07:13:40');
SET IDENTITY_INSERT dbo.payment OFF;

-- ตาราง dbo.shipment (3 รายการ)
SET IDENTITY_INSERT dbo.shipment ON;
INSERT INTO dbo.shipment (shipment_id, tracking_no, payment_id, order_id, product_id, carrier, status, shipping_address, shipped_at) VALUES (2, N'12345678', 5, 5, 19, N'Flash', N'delivered', N'99/1 หมู่บ้านสุขใจ ถนนบางนา-ตราด บางพลีใหญ่ บางพลี สมุทรปราการ 10540', '2026-11-16 23:37:08');
INSERT INTO dbo.shipment (shipment_id, tracking_no, payment_id, order_id, product_id, carrier, status, shipping_address, shipped_at) VALUES (3, N'11111112222', 7, 7, 19, N'Flash', N'shipped', N'99/1 หมู่บ้านสุขใจ ถนนบางนา-ตราด บางพลีใหญ่ บางพลี สมุทรปราการ 10540', '2026-11-17 07:13:58');
INSERT INTO dbo.shipment (shipment_id, tracking_no, payment_id, order_id, product_id, carrier, status, shipping_address, shipped_at) VALUES (4, N'3123123333', 6, 6, 19, N'Flash', N'shipped', N'99/1 หมู่บ้านสุขใจ ถนนบางนา-ตราด บางพลีใหญ่ บางพลี สมุทรปราการ 10540', '2026-11-17 07:14:06');
SET IDENTITY_INSERT dbo.shipment OFF;

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
