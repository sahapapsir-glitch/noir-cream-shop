-- ============================================================================
-- NOIR & CREAM CLOTHING SHOP — REALTIME MICROSOFT SQL SERVER DATABASE
-- Instance: .\SQLEXPRESS01 | Database: [NoirCreamShop]
-- Checksum: a81ad9115b9099a5 | Updated: 2026-11-17T14:46:29.044Z
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
        address       NVARCHAR(500),
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
        recipient   NVARCHAR(100),
        phone       NVARCHAR(20),
        house_no    NVARCHAR(100),
        village     NVARCHAR(150),
        road        NVARCHAR(150),
        subdistrict NVARCHAR(100),
        district    NVARCHAR(100),
        province    NVARCHAR(100),
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

-- ตาราง dbo.customer (21 รายการ)
SET IDENTITY_INSERT dbo.customer ON;
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (1, N'สมชาย', N'ทดสอบ', N'089-999-9999', N'demo@shop.com', N'เลขที่ 99/148 อาคารพาโนรามา ทาวเวอร์ ชั้น 19 ห้อง 1908 หมู่บ้านสุขใจแลนด์ หมู่ 7 ซอยกิ่งแก้ว 25/1 ถนนบางนา-ตราด กม.12 ตำบลบางพลีใหญ่ อำเภอบางพลี จังหวัดสมุทรปราการ 10540', 1, N'$2b$10$ZOb/yCkPVuDXc9kPaJHQreOI7VIqIIV7hJ.SH2jDhB6YA7na.5yvq', '2026-11-10 07:35:51');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (2, N'ณัฐพร', N'กิจเจริญ', N'081-234-5678', N'nattaporn.k@fake.com', N'เลขที่ 128/45 ชั้น 14 ห้อง 1402 อาคารพาร์ควิว เอ็กเซ็กคิวทีฟ เรสซิเดนซ์ ซอยสุขุมวิท 55 (ทองหล่อ 13) ถนนสุขุมวิท แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพมหานคร 10110', 1, N'$2b$10$eAH3aJTMiA0cB4p2zDcID.UmTVp48JrXU5l6IdnuhfnuflWWgNU7y', '2026-11-17 13:38:36');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (3, N'กิตติศักดิ์', N'สุวรรณรัตน์', N'082-345-6789', N'kittisak.s@fake.com', N'เลขที่ 88/154 โซน C ซอย 9/2 หมู่บ้านพฤกษาวิลเลจ เดอะซีซัน คลอง 1 หมู่ 6 ซอยรังสิต-นครนายก 32 ถนนพหลโยธิน ตำบลคลองหนึ่ง อำเภอคลองหลวง จังหวัดปทุมธานี 12120', 2, N'$2b$10$A2sDGNSozuLDXAJ4fqYam.2yJocSIELDARTJRyMdu159lFpBKfWRK', '2026-11-17 13:38:36');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (4, N'ชลธิชา', N'วงศ์สว่าง', N'083-456-7890', N'chonthicha.w@fake.com', N'เลขที่ 45/92 ชั้น 8 อาคาร B ห้อง 815 คอนโดแอสปาย งามวงศ์วาน หมู่ 2 ซอยงามวงศ์วาน 18 (จุฬาเกษม) ถนนงามวงศ์วาน ตำบลบางเขน อำเภอเมืองนนทบุรี จังหวัดนนทบุรี 11000', 3, N'$2b$10$mf7ySYhQdt52kHFwrGCveOWylhmOh9OjPnjWT7Y1ZLG/y6T9WFoAS', '2026-11-17 13:38:36');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (5, N'วรเมธ', N'รัตนเดช', N'084-567-8901', N'worameth.r@fake.com', N'เลขที่ 102/48 ซอย 15 เฟส 3 หมู่บ้านศุภาลัย พรีมา วิลลา เพชรเกษม ซอยเพชรเกษม 48 แยก 16 ถนนเพชรเกษม แขวงบางหว้า เขตภาษีเจริญ กรุงเทพมหานคร 10160', 4, N'$2b$10$snL9UVb9mnU1cb9KT2K8S.xiKImxp/nzLOTWWpQw.e7KTq56VAHHq', '2026-11-17 13:38:36');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (6, N'พิชญา', N'บุญเลิศ', N'085-678-9012', N'pitchaya.b@fake.com', N'เลขที่ 77/25 ชั้น 5 ห้อง 503 โครงการเดอะนิมมาน พรีเมียม คอนโดมิเนียม หมู่ 6 ซอยนิมมานเหมินท์ 9 ถนนนิมมานเหมินท์ ตำบลสุเทพ อำเภอเมืองเชียงใหม่ จังหวัดเชียงใหม่ 50200', 5, N'$2b$10$f/vqfUgJeNApu4qXajzeKePgU8OGC262E2PDDuqpj.MUsgvCz.ktu', '2026-11-17 13:38:36');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (7, N'ธนาธิป', N'ประเสริฐยิ่ง', N'086-789-0123', N'thanathip.p@fake.com', N'เลขที่ 215/84 ซอย 4 บล็อค B หมู่บ้านคาซ่า แกรนด์ มิตรสัมพันธ์-บางแสน หมู่ 3 ซอยมิตรสัมพันธ์ 13 ถนนลงหาดบางแสน ตำบลแสนสุข อำเภอเมืองชลบุรี จังหวัดชลบุรี 20130', 1, N'$2b$10$BwwhCU4tdkxoZE8EqnVNfO59D.PHCVe04I/WRNg1Zf.n6SzaE/GHi', '2026-11-17 13:38:36');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (8, N'ศิริพร', N'มณีโชติ', N'087-890-1234', N'siriporn.m@fake.com', N'เลขที่ 64/119 ซอยลดาวัลย์ 8 โซนการ์เดน หมู่บ้านลดาวัลย์ ศรีนครินทร์ โครงการ 2 หมู่ 5 ซอยศรีด่าน 22 ถนนศรีนครินทร์ ตำบลบางแก้ว อำเภอบางพลี จังหวัดสมุทรปราการ 10540', 2, N'$2b$10$WkpYhQ91Z7D489TpvyLxIOEOR7dZffVtd0AEATTympeGmUARgaUuG', '2026-11-17 13:38:36');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (9, N'อนุชา', N'อักษรศรี', N'088-901-2345', N'anucha.a@fake.com', N'เลขที่ 159/37 ซอยมิตรภาพ 19 แยก 4 หมู่บ้านสีมานคร วิลเลจ แกรนด์พาร์ค หมู่ 1 ซอยมิตรภาพร่วมใจ ถนนมิตรภาพสายหลัก ตำบลในเมือง อำเภอเมืองนครราชสีมา จังหวัดนครราชสีมา 30000', 3, N'$2b$10$lZQZcUbnXd/W5eOqh.Pbze0/k/H6Gw.oAUMue8oOGst1myb9buKWm', '2026-11-17 13:38:36');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (10, N'กัญญาณัฐ', N'สัจธรรม', N'089-012-3456', N'kanyanat.s@fake.com', N'เลขที่ 33/72 ซอย 22 เฟสเลควิว หมู่บ้านสราญสิริ ท่าข้าม-พระราม 2 โครงการหรู ซอยท่าข้าม 7 แยก 4 ถนนพระราม 2 แขวงท่าข้าม เขตบางขุนเทียน กรุงเทพมหานคร 10150', 4, N'$2b$10$4ZlFDUvp0T3DbQZnUjWVxuWCH3H1yJVLxCxOMUsA/IFRloSej3YFm', '2026-11-17 13:38:36');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (11, N'ธีรภัทร', N'จินดารัตน์', N'090-123-4567', N'theerapat.j@fake.com', N'เลขที่ 512/93 ชั้น 7 ห้อง 704 อาคาร A คอนโดกัลปพฤกษ์ พาร์ค ขอนแก่น แอร์พอร์ต หมู่ 5 ซอยมะลิวัลย์ 14 ถนนมะลิวัลย์ ตำบลในเมือง อำเภอเมืองขอนแก่น จังหวัดขอนแก่น 40000', 5, N'$2b$10$xsnymTOSg8Go9hwwJgcrGu8ZQnG3dplkr6FOOhlZfpSGtrArcfLNu', '2026-11-17 13:38:36');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (12, N'ปริยากร', N'อินทร์แก้ว', N'091-234-5678', N'pariyakorn.i@fake.com', N'เลขที่ 28/46 ชั้น 3 ห้องพูลวิลล่า A3 เดอะรอยัล ภูเก็ต มารีนา ลักชัวรี เรสซิเดนซ์ หมู่ 2 ซอยเกาะแก้ว 24 ถนนเทพกระษัตรี ตำบลตลาดใหญ่ อำเภอเมืองภูเก็ต จังหวัดภูเก็ต 83000', 1, N'$2b$10$nJFXjdHpJttfMFt4dJaF2.c3wb3MeTvMQr5aQOZdT/19GDj37vPwS', '2026-11-17 13:38:36');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (13, N'ภาณุพงศ์', N'รุ่งเรือง', N'092-345-6789', N'panupong.r@fake.com', N'เลขที่ 90/118 ซอยคาซ่า 5 ซอยย่อย 3 หมู่บ้านคาซ่า วิลล์ ราชพฤกษ์-พระราม 5 หมู่ 4 ซอยบางรักน้อย 18 ถนนราชพฤกษ์ ตำบลบางรักน้อย อำเภอเมืองนนทบุรี จังหวัดนนทบุรี 11000', 2, N'$2b$10$bJko2us3Ap1YyIY/YlOI6u.NlPlNl1lx3NE6P5EcIHC5wpseueJBq', '2026-11-17 13:38:37');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (14, N'อภิญญา', N'พงษ์พาณิชย์', N'093-456-7890', N'apinya.p@fake.com', N'เลขที่ 14/255 ซอยสุรนารายณ์ 11/3 หมู่บ้านเซเรเน่การ์เด้น โคราช วิลล่า หมู่ 8 ซอยบ้านเกาะร่วมพัฒนา ถนนสุรนารายณ์ ตำบลบ้านเกาะ อำเภอเมืองนครราชสีมา จังหวัดนครราชสีมา 30000', 3, N'$2b$10$nnlcaDlw4y85R4TzZNe72ua8D.Isvj.rmvV1qQ18/FqrMJILlFhsy', '2026-11-17 13:38:37');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (15, N'กรกช', N'ตันติวิวัฒน์', N'094-567-8901', N'korakot.t@fake.com', N'เลขที่ 119/53 ซอยรามอินทรา 65 แยก 2-4 หมู่บ้านชัยพฤกษ์ รามอินทรา-วงแหวน ซอย 12 ซอยคู้บอน 27 แยก 10 ถนนรามอินทรา แขวงคันนายาว เขตคันนายาว กรุงเทพมหานคร 10230', 4, N'$2b$10$MIJXDaItAAB9UW24VgVH..55MVCDGt1p679X3XP0CqT1sjL7SG8XS', '2026-11-17 13:38:37');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (16, N'มนัสวี', N'ศรีสุวรรณ', N'095-678-9012', N'manatsawee.s@fake.com', N'เลขที่ 67/124 ชั้น 10 อาคารแกรนด์ C เดอะไฮทส์ คอนโดมิเนียม แอท ช้างเผือก หมู่ 7 ซอยสุขเกษม 4 ถนนซุปเปอร์ไฮเวย์ เชียงใหม่-ลำปาง ตำบลช้างเผือก อำเภอเมืองเชียงใหม่ จังหวัดเชียงใหม่ 50300', 5, N'$2b$10$WsoxHedQohvXq5YHFES4Q.CV/s9fnWUa2D1FfEI8Id/fotAYpIWO.', '2026-11-17 13:38:37');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (17, N'พงศธร', N'ศักดิ์เจริญ', N'096-789-0123', N'pongsatorn.s@fake.com', N'เลขที่ 203/67 ชั้น 18 ห้องวิวทะเล 1802 ลุมพินี วิลล์ นาเกลือ-วงศ์อมาตย์ เฟสบี หมู่ 1 ซอยนาเกลือ 16/1 ถนนสุขุมวิท-พัทยา ตำบลนาเกลือ อำเภอบางละมุง จังหวัดชลบุรี 20150', 1, N'$2b$10$GpNq0av/gVb7nOzldwQUKO4s.hJbMjkASjHkD.dfcKfDImMmn..E6', '2026-11-17 13:38:37');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (18, N'ลลิตา', N'วรเวช', N'097-890-1234', N'lalita.w@fake.com', N'เลขที่ 55/182 ซอยแจ้งวัฒนะ-ปากเกร็ด 43 แยก 6 หมู่บ้านเพอร์เฟค เพลส แจ้งวัฒนะ โครงการพรีเมียม ซอยคลองเกลือ 12 ถนนแจ้งวัฒนะ ตำบลบางพูด อำเภอปากเกร็ด จังหวัดนนทบุรี 11120', 2, N'$2b$10$33z8HPtvwvNfV9DMl8vfCeviUvKb1SlwM1KPxNpdG1Chz/DxoMxZK', '2026-11-17 13:38:37');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (19, N'ศรัณย์', N'ธรรมทัศน์', N'098-901-2345', N'saran.t@fake.com', N'เลขที่ 84/39 ซอยชะอำใต้ 7 แปลงริมสระว่ายน้ำ วิลล่า มาลี บีชไซด์ รีสอร์ทแอนด์เรสซิเดนซ์ หมู่ 3 ซอยร่วมจิตรพัฒนา ถนนเพชรเกษมสายใต้ ตำบลชะอำ อำเภอชะอำ จังหวัดเพชรบุรี 76120', 3, N'$2b$10$wFOjPHD7yOgJ6gxW4yRMbudVc54utvp/MRO2qTfexl80E9.InfxTS', '2026-11-17 13:38:37');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (20, N'นภัสสร', N'กิตติคุณ', N'099-012-3456', N'napatsorn.k@fake.com', N'เลขที่ 310/25 ซอย 18 ซอยย่อยมัณฑนา 4 หมู่บ้านมัณฑนา วงแหวน-บางแค โครงการ 1 ซอยเพชรเกษม 63 แยก 8 ถนนกาญจนาภิเษก แขวงบางแค เขตบางแค กรุงเทพมหานคร 10160', 4, N'$2b$10$tG110zb2O9s0BvYul.sNNOR9HBuoDziQMoH12nSspO1DTvrWpEgRG', '2026-11-17 13:38:37');
INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at) VALUES (21, N'ชานนท์', N'วิมลศิลป์', N'080-123-4567', N'chanon.w@fake.com', N'เลขที่ 42/158 ซอยพัฒนาอุดร 6 เฟสการ์เดน 2 หมู่บ้านสิทธาการ์เด้นท์ โฮม อุดรธานีการ์เดน หมู่ 5 ซอยบ้านหนองขาม 12 ถนนรอบเมืองสายเหนือ ตำบลหมากแข้ง อำเภอเมืองอุดรธานี จังหวัดอุดรธานี 41000', 5, N'$2b$10$sj3AYZjrckAowLUgHJQ70uAuGAzqlIfhpT9CoxsZnnxFMMIPqpqQq', '2026-11-17 13:38:37');
SET IDENTITY_INSERT dbo.customer OFF;

-- ตาราง dbo.address (21 รายการ)
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
SET IDENTITY_INSERT dbo.address OFF;

-- ตาราง dbo.product (1 รายการ)
SET IDENTITY_INSERT dbo.product ON;
INSERT INTO dbo.product (product_id, name, category, description, status, stock, quantity, price, supplier_id, employee_id, image_url, is_featured, created_at) VALUES (24, N'Classic Fit Mesh Polo', N'เสื้อโปโล', N'brand:Polo Ralph Lauren', N'active', 150, 150, 2900, 3, 2, N'https://is8.revolveassets.com/images/p4/n/z/PLAU-MS38_V1.jpg', 1, '2026-11-17 14:46:27');
SET IDENTITY_INSERT dbo.product OFF;

-- ตาราง dbo.product_variant (5 รายการ)
SET IDENTITY_INSERT dbo.product_variant ON;
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (165, 24, N'S', N'ดำ', N'#000000', 2900, 30, 30, N'SKU-24-S-ดำ');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (166, 24, N'M', N'ดำ', N'#000000', 2900, 30, 30, N'SKU-24-M-ดำ');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (167, 24, N'L', N'ดำ', N'#000000', 2900, 30, 30, N'SKU-24-L-ดำ');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (168, 24, N'XL', N'ดำ', N'#000000', 2900, 30, 30, N'SKU-24-XL-ดำ');
INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku) VALUES (169, 24, N'2XL', N'ดำ', N'#000000', 2900, 30, 30, N'SKU-24-2XL-ดำ');
SET IDENTITY_INSERT dbo.product_variant OFF;

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
