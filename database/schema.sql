-- =============================================
-- CyberHub Database Schema
-- Quản lý quán điện tử công cộng
-- =============================================

CREATE DATABASE IF NOT EXISTS cyberhub_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cyberhub_db;

-- =============================================
-- 1. Bảng users (Nhân viên & Admin)
-- =============================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role ENUM('admin', 'staff') NOT NULL DEFAULT 'staff',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =============================================
-- 2. Bảng computers (Máy tính)
-- =============================================
CREATE TABLE IF NOT EXISTS computers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    status ENUM('available', 'in_use', 'maintenance') NOT NULL DEFAULT 'available',
    specs TEXT,
    price_per_hour DECIMAL(10,2) NOT NULL DEFAULT 10000,
    zone VARCHAR(50) DEFAULT 'Thường',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =============================================
-- 3. Bảng customers (Khách hàng)
-- =============================================
CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) UNIQUE,
    balance DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_hours DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =============================================
-- 4. Bảng sessions (Phiên sử dụng)
-- =============================================
CREATE TABLE IF NOT EXISTS sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    computer_id INT NOT NULL,
    customer_id INT DEFAULT NULL,
    start_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME DEFAULT NULL,
    planned_minutes INT DEFAULT NULL,
    planned_end_time DATETIME DEFAULT NULL,
    prepaid_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    is_prepaid TINYINT(1) NOT NULL DEFAULT 0,
    total_amount DECIMAL(12,2) DEFAULT 0,
    status ENUM('active', 'completed') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (computer_id) REFERENCES computers(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =============================================
-- 5. Bảng products (Đồ ăn/uống)
-- =============================================
-- =============================================
-- 5. Bang support_messages (yeu cau realtime khach <-> admin)
-- =============================================
CREATE TABLE IF NOT EXISTS support_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    sender_role ENUM('customer', 'admin', 'staff') NOT NULL,
    sender_name VARCHAR(120) NOT NULL,
    sender_user_id INT DEFAULT NULL,
    sender_customer_id INT DEFAULT NULL,
    message TEXT NOT NULL,
    read_by_admin TINYINT(1) NOT NULL DEFAULT 0,
    read_by_customer TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (sender_customer_id) REFERENCES customers(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_support_messages_customer_created ON support_messages(customer_id, created_at);
CREATE INDEX idx_support_messages_unread_admin ON support_messages(customer_id, sender_role, read_by_admin);
CREATE INDEX idx_support_messages_unread_customer ON support_messages(customer_id, sender_role, read_by_customer);

-- =============================================
-- 6. Bang products (do an/uong)
-- =============================================
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category ENUM('food', 'drink', 'other') NOT NULL DEFAULT 'other',
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    stock INT NOT NULL DEFAULT 0,
    image_url VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =============================================
-- 6. Bảng orders (Đơn hàng)
-- =============================================
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT DEFAULT NULL,
    customer_id INT DEFAULT NULL,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    status ENUM('pending', 'confirmed', 'cancelled') NOT NULL DEFAULT 'confirmed',
    created_by INT DEFAULT NULL,
    confirmed_by INT DEFAULT NULL,
    confirmed_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (confirmed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =============================================
-- 7. Bảng order_items (Chi tiết đơn hàng)
-- =============================================
CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =============================================
-- 8. Bảng shifts (Ca trực)
-- =============================================
CREATE TABLE IF NOT EXISTS shifts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    start_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME DEFAULT NULL,
    starting_cash DECIMAL(12,2) NOT NULL DEFAULT 0,
    ending_cash DECIMAL(12,2) DEFAULT NULL,
    total_revenue DECIMAL(12,2) DEFAULT 0,
    status ENUM('active', 'completed') NOT NULL DEFAULT 'active',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =============================================
-- 9. Bảng transactions (Giao dịch nạp tiền)
-- =============================================
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    type ENUM('topup', 'payment', 'refund', 'redeem') NOT NULL DEFAULT 'topup',
    status ENUM('pending', 'success', 'failed') NOT NULL DEFAULT 'success',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =============================================
-- SEED DATA
-- =============================================

-- Admin mặc định (password: admin123 - bcrypt hash)
INSERT INTO users (username, password, full_name, role) VALUES
('admin', '$2a$10$8gcu8SvCnuZt6HVGBoDxzeDMavTN2KViY/VHvqBplM1OVHuITODdS', 'Quản Trị Viên', 'admin'),
('nhanvien1', '$2a$10$8gcu8SvCnuZt6HVGBoDxzeDMavTN2KViY/VHvqBplM1OVHuITODdS', 'Nguyễn Văn A', 'staff');

-- Máy tính mẫu
INSERT INTO computers (name, status, specs, price_per_hour, zone) VALUES
('PC-01', 'available', 'Intel i5-12400F, RTX 3060, 16GB RAM, 512GB SSD', 50000, 'Thuong'),
('PC-02', 'available', 'Intel i5-12400F, RTX 3060, 16GB RAM, 512GB SSD', 50000, 'Thuong'),
('PC-03', 'available', 'Intel i5-12400F, RTX 3060, 16GB RAM, 512GB SSD', 50000, 'Thuong'),
('PC-04', 'available', 'Intel i5-12400F, RTX 3060, 16GB RAM, 512GB SSD', 50000, 'Thuong'),
('PC-05', 'available', 'Intel i5-12400F, RTX 3060, 16GB RAM, 512GB SSD', 50000, 'Thuong'),
('PC-06', 'available', 'Intel i7-13700K, RTX 4070, 32GB RAM, 1TB SSD', 100000, 'VIP'),
('PC-07', 'available', 'Intel i7-13700K, RTX 4070, 32GB RAM, 1TB SSD', 100000, 'VIP'),
('PC-08', 'available', 'Intel i7-13700K, RTX 4070, 32GB RAM, 1TB SSD', 100000, 'VIP'),
('PC-09', 'available', 'Intel i9-13900K, RTX 4090, 64GB RAM, 2TB SSD', 150000, 'Streaming'),
('PC-10', 'available', 'Intel i9-13900K, RTX 4090, 64GB RAM, 2TB SSD', 150000, 'Streaming');

-- Khách hàng mẫu
INSERT INTO customers (name, phone, balance, total_hours) VALUES
('Trần Minh Khoa', '0901234567', 200000, 45.5),
('Lê Thị Hương', '0912345678', 150000, 30.0),
('Phạm Đức Long', '0923456789', 500000, 120.0),
('Nguyễn Thanh Tùng', '0934567890', 80000, 15.5),
('Hoàng Văn Nam', '0945678901', 320000, 88.0);

-- Sản phẩm mẫu
INSERT INTO products (name, category, price, stock) VALUES
('Mì tôm xào', 'food', 20000, 50),
('Cơm chiên dương châu', 'food', 35000, 30),
('Bánh mì thịt', 'food', 15000, 40),
('Xúc xích nướng', 'food', 10000, 60),
('Snack Oishi', 'food', 8000, 100),
('Trà sữa trân châu', 'drink', 25000, 50),
('Coca Cola', 'drink', 12000, 100),
('Pepsi', 'drink', 12000, 100),
('Nước suối', 'drink', 5000, 200),
('Cà phê sữa đá', 'drink', 18000, 80),
('Red Bull', 'drink', 15000, 60),
('Sting dâu', 'drink', 10000, 80),
('Tai nghe thuê', 'other', 5000, 20),
('Sạc điện thoại', 'other', 3000, 15);
