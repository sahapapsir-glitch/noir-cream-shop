-- ============================================================================
-- NOIR & CREAM CLOTHING SHOP — MICROSOFT SQL SERVER SCHEMA & SEED DATA
-- Database: NoirCreamShop
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

-- 1. Employee (พนักงาน)
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

-- 2. Admin (ผู้ดูแลระบบ)
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

-- 3. Supplier (ซัพพลายเออร์)
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

-- 4. Product (สินค้า)
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

-- 5. Product Variant (รูปแบบไซส์/สีสินค้า)
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

-- 6. Customer (ลูกค้า)
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

-- 7. Address (ที่อยู่จัดส่ง)
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

-- 8. Cart Item (ตะกร้าสินค้า)
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

-- 9. Coupon (คูปองส่วนลด)
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

-- 10. Order (คำสั่งซื้อ)
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

-- 11. Order Item (รายการในคำสั่งซื้อ)
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

-- 12. Payment (การชำระเงิน)
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

-- 13. Shipment (การจัดส่งพัสดุ)
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

-- 14. Review (รีวิวสินค้า)
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

-- 15. Wishlist (รายการโปรด)
IF OBJECT_ID('dbo.wishlist', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.wishlist (
        customer_id INT NOT NULL FOREIGN KEY REFERENCES dbo.customer(customer_id) ON DELETE CASCADE,
        product_id  INT NOT NULL FOREIGN KEY REFERENCES dbo.product(product_id) ON DELETE CASCADE,
        PRIMARY KEY (customer_id, product_id)
    );
END
GO

-- ============================================================================
-- INSERT SEED DATA
-- ============================================================================

-- ใส่ข้อมูล Admin ทั้ง 5 บัญชี
SET IDENTITY_INSERT dbo.admin ON;
IF NOT EXISTS (SELECT 1 FROM dbo.admin WHERE admin_id = 1)
    INSERT INTO dbo.admin (admin_id, name, email, phone, password_hash)
    VALUES (1, N'ภูวมินทร์ วัฒนสาร', N'phuwamin@shop.com', N'081-000-0001', N'$2b$10$lGZcnGBz3xD1MhZ2nUc81u.PmC68jYdBilDyYVJUHgbN56CV8nxQ6');
IF NOT EXISTS (SELECT 1 FROM dbo.admin WHERE admin_id = 2)
    INSERT INTO dbo.admin (admin_id, name, email, phone, password_hash)
    VALUES (2, N'ธนกร อิ่มเพ็ง', N'thanakorn@shop.com', N'081-000-0002', N'$2b$10$S4XqHZFKxd9hFW48FMMWR.Fpg1dV1zRmM3.CotXctvETrrvTFbxY2');
IF NOT EXISTS (SELECT 1 FROM dbo.admin WHERE admin_id = 3)
    INSERT INTO dbo.admin (admin_id, name, email, phone, password_hash)
    VALUES (3, N'ธนดล สมจิตต์', N'thanadon@shop.com', N'081-000-0003', N'$2b$10$G5UE5TruB00szHUc0GY8seiz98aEtRpJrAOOnn7oZPpCAVqWB9gqK');
IF NOT EXISTS (SELECT 1 FROM dbo.admin WHERE admin_id = 4)
    INSERT INTO dbo.admin (admin_id, name, email, phone, password_hash)
    VALUES (4, N'สหภาพ ศิริพร', N'sahapap@shop.com', N'081-000-0004', N'$2b$10$dWgMhApPzmNHSlFuuETXv.kMJll7xc8ymEfqg5wIZK1aMQRLkY0XG');
IF NOT EXISTS (SELECT 1 FROM dbo.admin WHERE admin_id = 5)
    INSERT INTO dbo.admin (admin_id, name, email, phone, password_hash)
    VALUES (5, N'ปวริศา โสมี', N'pawarisa@shop.com', N'081-000-0005', N'$2b$10$u3k3aahmoBbBiEaco4ESs.l7c8CDgmRcDCweec5o5o1L8eNwvgrZu');
SET IDENTITY_INSERT dbo.admin OFF;
GO

-- พนักงาน
SET IDENTITY_INSERT dbo.employee ON;
IF NOT EXISTS (SELECT 1 FROM dbo.employee WHERE employee_id = 1)
    INSERT INTO dbo.employee (employee_id, first_name, last_name, email, phone, position, address)
    VALUES (1, N'สมศรี', N'ใจดี', N'somsri@shop.com', N'081-111-1111', N'ผู้จัดการฝ่ายจัดซื้อ', N'123 ถนนสุขุมวิท เขตวัฒนา กรุงเทพมหานคร');
IF NOT EXISTS (SELECT 1 FROM dbo.employee WHERE employee_id = 2)
    INSERT INTO dbo.employee (employee_id, first_name, last_name, email, phone, position, address)
    VALUES (2, N'ธนากร', N'มั่นคง', N'thanakorn@shop.com', N'082-222-2222', N'เจ้าหน้าที่คลังสินค้า', N'45/8 ถนนพระราม 9 เขตห้วยขวาง กรุงเทพมหานคร');
SET IDENTITY_INSERT dbo.employee OFF;
GO

-- ซัพพลายเออร์
SET IDENTITY_INSERT dbo.supplier ON;
IF NOT EXISTS (SELECT 1 FROM dbo.supplier WHERE supplier_id = 1)
    INSERT INTO dbo.supplier (supplier_id, name, contact_name, phone, email, address, employee_id, admin_id)
    VALUES (1, N'Siam Textile Co.', N'คุณวิชัย', N'02-111-2222', N'sales@siamtextile.example', N'กรุงเทพมหานคร', 1, 1);
IF NOT EXISTS (SELECT 1 FROM dbo.supplier WHERE supplier_id = 2)
    INSERT INTO dbo.supplier (supplier_id, name, contact_name, phone, email, address, employee_id, admin_id)
    VALUES (2, N'Lanna Garment', N'คุณมาลี', N'053-333-444', N'hello@lannagarment.example', N'เชียงใหม่', 2, 1);
IF NOT EXISTS (SELECT 1 FROM dbo.supplier WHERE supplier_id = 3)
    INSERT INTO dbo.supplier (supplier_id, name, contact_name, phone, email, address, employee_id, admin_id)
    VALUES (3, N'Denim House', N'คุณก้อง', N'038-555-666', N'order@denimhouse.example', N'ชลบุรี', 1, 1);
SET IDENTITY_INSERT dbo.supplier OFF;
GO

-- สินค้า (Kobe)
SET IDENTITY_INSERT dbo.product ON;
IF NOT EXISTS (SELECT 1 FROM dbo.product WHERE product_id = 19)
    INSERT INTO dbo.product (product_id, name, category, description, status, stock, quantity, price, supplier_id, employee_id, image_url, is_featured, created_at)
    VALUES (19, N'Kobe', N'เสื้อยืด', N'เสื้อยืดบาสเก็ตบอลผู้ชาย Nike Dri-FIT', N'active', 37, 37, 11111, 2, 1, N'https://static.nike.com/a/images/t_web_pdp_535_v2/f_auto,u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/b41f11db-eef3-41be-beac-f0520a949b65/AS+KB+M+NK+DF+TEE+M90+SSNL2+FH.png', 1, '2026-11-11 15:31:30');
SET IDENTITY_INSERT dbo.product OFF;
GO

-- ไซส์สินค้า (Variants)
SET IDENTITY_INSERT dbo.product_variant ON;
IF NOT EXISTS (SELECT 1 FROM dbo.product_variant WHERE variant_id = 116)
    INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku)
    VALUES (116, 19, N'S', N'ขาว', N'#ffffff', 11111, 7, 7, N'SKU-19-S-ขาว');
IF NOT EXISTS (SELECT 1 FROM dbo.product_variant WHERE variant_id = 117)
    INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku)
    VALUES (117, 19, N'M', N'ขาว', N'#ffffff', 11111, 10, 10, N'SKU-19-M-ขาว');
IF NOT EXISTS (SELECT 1 FROM dbo.product_variant WHERE variant_id = 118)
    INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku)
    VALUES (118, 19, N'L', N'ขาว', N'#ffffff', 11111, 10, 10, N'SKU-19-L-ขาว');
IF NOT EXISTS (SELECT 1 FROM dbo.product_variant WHERE variant_id = 119)
    INSERT INTO dbo.product_variant (variant_id, product_id, size, color, color_hex, price, stock, stock_quantity, sku)
    VALUES (119, 19, N'XL', N'ขาว', N'#ffffff', 11111, 10, 10, N'SKU-19-XL-ขาว');
SET IDENTITY_INSERT dbo.product_variant OFF;
GO

-- ลูกค้าตัวอย่าง
SET IDENTITY_INSERT dbo.customer ON;
IF NOT EXISTS (SELECT 1 FROM dbo.customer WHERE customer_id = 1)
    INSERT INTO dbo.customer (customer_id, first_name, last_name, phone, email, address, admin_id, password_hash, created_at)
    VALUES (1, N'สมชาย', N'ทดสอบ', N'089-999-9999', N'demo@shop.com', N'99/1 หมู่บ้านสุขใจ ถนนบางนา-ตราด บางพลีใหญ่ บางพลี สมุทรปราการ 10540', 1, N'$2b$10$ZOb/yCkPVuDXc9kPaJHQreOI7VIqIIV7hJ.SH2jDhB6YA7na.5yvq', '2026-11-10 07:35:51');
SET IDENTITY_INSERT dbo.customer OFF;
GO

-- ที่อยู่ลูกค้า
SET IDENTITY_INSERT dbo.address ON;
IF NOT EXISTS (SELECT 1 FROM dbo.address WHERE address_id = 1)
    INSERT INTO dbo.address (address_id, customer_id, recipient, phone, house_no, village, road, subdistrict, district, province, postal_code, is_default)
    VALUES (1, 1, N'สมชาย ทดสอบ', N'089-999-9999', N'99/1', N'หมู่บ้านสุขใจ', N'ถนนบางนา-ตราด', N'บางพลีใหญ่', N'บางพลี', N'สมุทรปราการ', N'10540', 1);
SET IDENTITY_INSERT dbo.address OFF;
GO

-- คูปอง
IF NOT EXISTS (SELECT 1 FROM dbo.coupon WHERE code = N'WELCOME10')
    INSERT INTO dbo.coupon (code, type, value, min_total, active) VALUES (N'WELCOME10', N'percent', 10, 0, 1);
IF NOT EXISTS (SELECT 1 FROM dbo.coupon WHERE code = N'SAVE100')
    INSERT INTO dbo.coupon (code, type, value, min_total, active) VALUES (N'SAVE100', N'fixed', 100, 1000, 1);
GO

-- ============================================================================
-- VERIFY SUMMARY
-- ============================================================================
SELECT 'admin' AS Table_Name, COUNT(*) AS Total_Records FROM dbo.admin
UNION ALL SELECT 'employee', COUNT(*) FROM dbo.employee
UNION ALL SELECT 'supplier', COUNT(*) FROM dbo.supplier
UNION ALL SELECT 'product', COUNT(*) FROM dbo.product
UNION ALL SELECT 'product_variant', COUNT(*) FROM dbo.product_variant
UNION ALL SELECT 'customer', COUNT(*) FROM dbo.customer
UNION ALL SELECT 'address', COUNT(*) FROM dbo.address
UNION ALL SELECT 'coupon', COUNT(*) FROM dbo.coupon;
GO
