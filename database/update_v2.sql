-- =============================================
-- CyberHub Database Update - Version 2.0
-- Cập nhật tính năng toàn diện
-- =============================================
USE cyberhub_db;

-- 0. Cap nhat bang sessions cho co che tra truoc theo thoi gian
ALTER TABLE sessions
ADD COLUMN planned_minutes INT DEFAULT NULL AFTER end_time,
ADD COLUMN planned_end_time DATETIME DEFAULT NULL AFTER planned_minutes,
ADD COLUMN prepaid_amount DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER planned_end_time,
ADD COLUMN is_prepaid TINYINT(1) NOT NULL DEFAULT 0 AFTER prepaid_amount;

-- 0b. Cap nhat bang orders cho quy trinh admin xac nhan mon
ALTER TABLE orders
ADD COLUMN status ENUM('pending', 'confirmed', 'cancelled') NOT NULL DEFAULT 'confirmed' AFTER total_amount,
ADD COLUMN confirmed_by INT DEFAULT NULL AFTER created_by,
ADD COLUMN confirmed_at DATETIME DEFAULT NULL AFTER confirmed_by;
-- 1. Cập nhật bảng customers
-- Thêm cột password cho khách đăng nhập web, điểm tích lũy và rank hội viên
ALTER TABLE customers 
ADD COLUMN password VARCHAR(255) DEFAULT NULL AFTER phone,
ADD COLUMN points INT NOT NULL DEFAULT 0 AFTER total_hours,
ADD COLUMN member_rank ENUM('Bronze', 'Silver', 'Gold', 'Platinum') NOT NULL DEFAULT 'Bronze' AFTER points;

-- 2. Tạo bảng promotions (Khuyến mãi)
CREATE TABLE IF NOT EXISTS promotions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    valid_from DATETIME NOT NULL,
    valid_to DATETIME NOT NULL,
    usage_limit INT DEFAULT NULL,
    used_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 3. Tạo bảng combo_packages (Gói Combo)
CREATE TABLE IF NOT EXISTS combo_packages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    hours_included DECIMAL(5,2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 4. Tạo bảng bookings (Đặt máy online)
CREATE TABLE IF NOT EXISTS bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    zone VARCHAR(50) NOT NULL,
    computer_id INT DEFAULT NULL,
    start_time DATETIME NOT NULL,
    duration_hours DECIMAL(5,2) NOT NULL,
    status ENUM('pending', 'confirmed', 'cancelled', 'completed') NOT NULL DEFAULT 'pending',
    payment_status ENUM('unpaid', 'paid') NOT NULL DEFAULT 'unpaid',
    total_amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (computer_id) REFERENCES computers(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 5. Tạo bảng activity_logs (Nhật ký nhân viên)
-- 5. Tao bang support_messages (realtime chat khach <-> admin)
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

CREATE TABLE IF NOT EXISTS activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    action VARCHAR(255) NOT NULL,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 6. Tạo bảng maintenance_logs (Nhật ký bảo trì)
CREATE TABLE IF NOT EXISTS maintenance_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    computer_id INT NOT NULL,
    issue_description TEXT NOT NULL,
    resolved_by INT DEFAULT NULL,
    cost DECIMAL(10,2) DEFAULT 0,
    status ENUM('pending', 'in_progress', 'resolved') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME DEFAULT NULL,
    FOREIGN KEY (computer_id) REFERENCES computers(id) ON DELETE CASCADE,
    FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =============================================
-- SEED DATA CẬP NHẬT
-- =============================================

-- Seed Promotions
INSERT IGNORE INTO promotions (code, description, discount_percent, valid_from, valid_to, usage_limit) VALUES 
('NEWYEAR2026', 'Giảm 20% cho dịp đầu năm', 20.00, '2026-01-01', '2026-12-31', 100),
('WELCOME', 'Giảm 50K cho khách mới', 0, '2026-01-01', '2026-12-31', 500);

-- Mật khẩu mặc định cho khách hàng cũ là '123456' (đã mã hóa bcrypt)
UPDATE customers SET password = '$2a$10$8gcu8SvCnuZt6HVGBoDxzeDMavTN2KViY/VHvqBplM1OVHuITODdS' WHERE password IS NULL;


