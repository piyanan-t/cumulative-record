-- =====================================================
-- ระบบระเบียนสะสมออนไลน์ แผนกวิชาคอมพิวเตอร์ธุรกิจดิจิทัล
-- Database Setup Script สำหรับ XAMPP (MySQL)
-- วิธีใช้: เปิด phpMyAdmin → Import → เลือกไฟล์นี้ → Go
-- =====================================================

CREATE DATABASE IF NOT EXISTS `cumulative_db`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `cumulative_db`;

-- =====================================================
-- TABLE: users (ผู้ใช้งานทั้งหมด)
-- =====================================================
CREATE TABLE IF NOT EXISTS `users` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`    VARCHAR(20)  NOT NULL UNIQUE COMMENT 'รหัสผู้ใช้ (login)',
  `password`   VARCHAR(255) NOT NULL,
  `role`       ENUM('student','teacher','admin') NOT NULL DEFAULT 'student',
  `full_name`  VARCHAR(150) NOT NULL,
  `email`      VARCHAR(150),
  `phone`      VARCHAR(20),
  `department` VARCHAR(200) COMMENT 'แผนกวิชา (สำหรับอาจารย์)',
  `is_active`  TINYINT(1)  NOT NULL DEFAULT 1,
  `last_login` TIMESTAMP NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: classrooms (ห้องเรียน)
-- year_level: pvc1=ปวช.1, pvc2=ปวช.2, pvc3=ปวช.3, pvs1=ปวส.1, pvs2=ปวส.2
-- =====================================================
CREATE TABLE IF NOT EXISTS `classrooms` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `room_code`     VARCHAR(20)  NOT NULL UNIQUE COMMENT 'รหัสห้อง เช่น COM-1-1',
  `room_name`     VARCHAR(100) NOT NULL,
  `year_level`    VARCHAR(10)  NOT NULL DEFAULT 'pvc1' COMMENT 'pvc1/pvc2/pvc3/pvs1/pvs2',
  `program`       VARCHAR(150) NOT NULL DEFAULT 'คอมพิวเตอร์ธุรกิจดิจิทัล',
  `academic_year` VARCHAR(10)  NOT NULL COMMENT 'ปีการศึกษา เช่น 2567',
  `semester`      INT          NOT NULL DEFAULT 1,
  `max_students`  INT DEFAULT 40,
  `is_active`     TINYINT(1) DEFAULT 1,
  `created_at`    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: teacher_classrooms (อาจารย์ที่ปรึกษา-ห้องเรียน)
-- =====================================================
CREATE TABLE IF NOT EXISTS `teacher_classrooms` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `teacher_id`   VARCHAR(20) NOT NULL,
  `classroom_id` INT NOT NULL,
  `assigned_at`  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_tc` (`teacher_id`,`classroom_id`),
  FOREIGN KEY (`classroom_id`) REFERENCES `classrooms`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: student_profiles (ระเบียนสะสมนักศึกษา)
-- =====================================================
CREATE TABLE IF NOT EXISTS `student_profiles` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`      VARCHAR(20) NOT NULL UNIQUE,
  `student_code` VARCHAR(20) NOT NULL UNIQUE,
  `classroom_id` INT,
  `year_level`   VARCHAR(10) DEFAULT 'pvc1' COMMENT 'pvc1/pvc2/pvc3/pvs1/pvs2 (ระดับชั้นที่แอดมินกำหนด)',
  -- ข้อมูลส่วนตัว
  `prefix`          VARCHAR(10),
  `first_name_th`   VARCHAR(80) NOT NULL DEFAULT '',
  `last_name_th`    VARCHAR(80) NOT NULL DEFAULT '',
  `first_name_en`   VARCHAR(80),
  `last_name_en`    VARCHAR(80),
  `nickname`        VARCHAR(40),
  `gender`          ENUM('male','female') DEFAULT 'male',
  `date_of_birth`   DATE,
  `race`            VARCHAR(50) DEFAULT 'ไทย',
  `nationality`     VARCHAR(50) DEFAULT 'ไทย',
  `religion`        VARCHAR(50) DEFAULT 'พุทธ',
  `blood_type`      VARCHAR(5),
  `id_card_number`  VARCHAR(13),
  -- ที่อยู่ตามทะเบียนบ้าน
  `address_no`    VARCHAR(20),
  `village_no`    VARCHAR(10),
  `alley`         VARCHAR(100),
  `road`          VARCHAR(100),
  `subdistrict`   VARCHAR(80),
  `district`      VARCHAR(80),
  `province`      VARCHAR(80),
  `postal_code`   VARCHAR(5),
  `phone`         VARCHAR(20),
  `email`         VARCHAR(150),
  -- ข้อมูลพี่น้อง
  `siblings_same_both`         INT DEFAULT 0,
  `siblings_younger_same_both` INT DEFAULT 0,
  `siblings_diff_father`       INT DEFAULT 0,
  `siblings_younger_diff`      INT DEFAULT 0,
  -- ข้อมูลบิดา
  `father_name`          VARCHAR(150),
  `father_alive`         ENUM('alive','deceased') DEFAULT 'alive',
  `father_deceased_when` VARCHAR(100),
  `father_occupation`    VARCHAR(100),
  `father_workplace`     VARCHAR(200),
  `father_income`        VARCHAR(50),
  `father_education`     VARCHAR(100),
  `father_address`       TEXT,
  `father_phone`         VARCHAR(20),
  `father_email`         VARCHAR(150),
  `father_other`         TEXT,
  -- ข้อมูลมารดา
  `mother_name`          VARCHAR(150),
  `mother_alive`         ENUM('alive','deceased') DEFAULT 'alive',
  `mother_deceased_when` VARCHAR(100),
  `mother_occupation`    VARCHAR(100),
  `mother_workplace`     VARCHAR(200),
  `mother_income`        VARCHAR(50),
  `mother_education`     VARCHAR(100),
  `mother_address`       TEXT,
  `mother_phone`         VARCHAR(20),
  `mother_email`         VARCHAR(150),
  `mother_other`         TEXT,
  -- สถานภาพบิดามารดา
  `parent_status`        VARCHAR(50) DEFAULT 'together',
  `parent_status_detail` TEXT,
  -- ที่อยู่ปัจจุบัน
  `current_address`  TEXT,
  `current_phone`    VARCHAR(20),
  `current_email`    VARCHAR(150),
  `address_type`     VARCHAR(50),
  `nearby_place`     VARCHAR(200),
  `living_with`      VARCHAR(100),
  `living_relation`  VARCHAR(100),
  -- ผู้ปกครอง
  `guardian_name`        VARCHAR(150),
  `guardian_occupation`  VARCHAR(100),
  `guardian_workplace`   VARCHAR(200),
  `guardian_education`   VARCHAR(100),
  `guardian_address`     TEXT,
  `guardian_phone`       VARCHAR(20),
  `guardian_email`       VARCHAR(150),
  -- บุคคลที่ปรึกษา (นอกวิทยาลัย)
  `counselor_name`     VARCHAR(150),
  `counselor_relation` VARCHAR(100),
  `counselor_address`  TEXT,
  `counselor_postal`   VARCHAR(5),
  `counselor_phone`    VARCHAR(20),
  -- ข้อมูลสุขภาพ
  `chronic_disease`   TEXT,
  `past_disease`      TEXT,
  `allergy`           TEXT,
  `surgery_history`   TEXT,
  `vision_condition`  TEXT,
  `hearing_condition` TEXT,
  `dental_condition`  TEXT,
  `mental_behavior`   TEXT,
  -- ความสามารถพิเศษ
  `special_abilities` TEXT,
  -- แผนที่บ้าน (base64 canvas data)
  `route_map` LONGTEXT,
  -- สถานะเอกสาร
  `form_status`       ENUM('not_started','draft','submitted') DEFAULT 'not_started',
  `form_submitted_at` TIMESTAMP NULL,
  `photo_pvs`         VARCHAR(255) COMMENT 'path รูปตอน ปวช.',
  `photo_pvss`        VARCHAR(255) COMMENT 'path รูปตอน ปวส.',
  `student_code_pvs`  VARCHAR(20)  COMMENT 'รหัสนักศึกษาสมัย ปวช.',
  FOREIGN KEY (`classroom_id`) REFERENCES `classrooms`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: student_friends (เพื่อนสนิท)
-- =====================================================
CREATE TABLE IF NOT EXISTS `student_friends` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`      VARCHAR(20) NOT NULL,
  `friend_name`  VARCHAR(150),
  `friend_school` VARCHAR(200),
  `friend_phone` VARCHAR(20),
  `sort_order`   INT DEFAULT 0,
  INDEX `idx_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: health_checkups (การตรวจสุขภาพประจำปี)
-- =====================================================
CREATE TABLE IF NOT EXISTS `health_checkups` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`        VARCHAR(20) NOT NULL,
  `academic_year`  VARCHAR(10),
  `semester`       INT DEFAULT 1,
  `checkup_date`   DATE,
  `height`         DECIMAL(5,2),
  `weight`         DECIMAL(5,2),
  `vision_left`    VARCHAR(10),
  `vision_right`   VARCHAR(10),
  `blood_pressure` VARCHAR(20),
  `notes`          TEXT,
  `created_at`     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: notifications (การแจ้งเตือน)
-- =====================================================
CREATE TABLE IF NOT EXISTS `notifications` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `sender_id`    VARCHAR(20),
  `recipient_id` VARCHAR(20) NOT NULL,
  `title`        VARCHAR(250) NOT NULL,
  `message`      TEXT,
  `type`         ENUM('info','warning','reminder','system') DEFAULT 'info',
  `is_read`      TINYINT(1) DEFAULT 0,
  `created_at`   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_recipient` (`recipient_id`),
  INDEX `idx_unread`    (`recipient_id`, `is_read`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: activity_logs (บันทึกกิจกรรม)
-- =====================================================
CREATE TABLE IF NOT EXISTS `activity_logs` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`     VARCHAR(20),
  `action`      VARCHAR(150) NOT NULL,
  `entity_type` VARCHAR(50),
  `entity_id`   VARCHAR(50),
  `details`     TEXT,
  `ip_address`  VARCHAR(45),
  `created_at`  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_user`    (`user_id`),
  INDEX `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: system_settings (การตั้งค่าระบบ)
-- =====================================================
CREATE TABLE IF NOT EXISTS `system_settings` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `setting_key`   VARCHAR(100) NOT NULL UNIQUE,
  `setting_value` TEXT,
  `setting_group` VARCHAR(50) DEFAULT 'general',
  `updated_at`    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- ข้อมูลเริ่มต้น
-- =====================================================

-- บัญชีแอดมิน
-- รหัสผู้ใช้ : admin001
-- รหัสผ่าน  : admin1234
-- ** เปลี่ยนรหัสผ่านหลัง login ครั้งแรกทันที **
INSERT INTO `users` (`user_id`, `password`, `role`, `full_name`, `phone`) VALUES
('admin001', 'admin1234', 'admin', 'ผู้ดูแลระบบ', '');

-- การตั้งค่าระบบเริ่มต้น
INSERT INTO `system_settings` (`setting_key`, `setting_value`, `setting_group`) VALUES
('college_name',          'วิทยาลัยเทคนิค',                     'general'),
('department_name',       'แผนกวิชาคอมพิวเตอร์ธุรกิจดิจิทัล', 'general'),
('current_academic_year', '2567',                                'academic'),
('current_semester',      '1',                                   'academic'),
('system_version',        '1.0.0',                               'system');

-- =====================================================
-- ห้องเรียน 16 ห้อง แผนกวิชาคอมพิวเตอร์ธุรกิจดิจิทัล
-- ชคธ = ปวช.คอมพิวเตอร์ธุรกิจ | สคธ/สทธ = ปวส.
-- 67/68/69 = ปีเข้าเรียน (พ.ศ. 25xx)
-- =====================================================
INSERT IGNORE INTO `classrooms`
  (`room_code`, `room_name`, `year_level`, `program`, `academic_year`, `semester`)
VALUES
-- ── ชคธ.67 (ปวช.3) ───────────────────────────────────
('ชคธ67-11','ชคธ.67-11','pvc3','คอมพิวเตอร์ธุรกิจดิจิทัล','2568',1),
('ชคธ67-21','ชคธ.67-21','pvc3','คอมพิวเตอร์ธุรกิจดิจิทัล','2568',1),
-- ── ชคธ.68 (ปวช.2) ───────────────────────────────────
('ชคธ68-11','ชคธ.68-11','pvc2','คอมพิวเตอร์ธุรกิจดิจิทัล','2568',1),
('ชคธ68-12','ชคธ.68-12','pvc2','คอมพิวเตอร์ธุรกิจดิจิทัล','2568',1),
('ชคธ68-21','ชคธ.68-21','pvc2','คอมพิวเตอร์ธุรกิจดิจิทัล','2568',1),
-- ── ชคธ.69 (ปวช.1) ───────────────────────────────────
('ชคธ69-11','ชคธ.69-11','pvc1','คอมพิวเตอร์ธุรกิจดิจิทัล','2568',1),
('ชคธ69-12','ชคธ.69-12','pvc1','คอมพิวเตอร์ธุรกิจดิจิทัล','2568',1),
-- ── สคธ.68 (ปวส.2) ───────────────────────────────────
('สทธ68-11','สทธ.68-11','pvs2','คอมพิวเตอร์ธุรกิจดิจิทัล','2568',1),
-- ── สทธ.68 (ปวส.2) ───────────────────────────────────
('สทธ68-21','สทธ.68-21','pvs2','คอมพิวเตอร์ธุรกิจดิจิทัล','2568',1),
('สทธ68-22','สทธ.68-22','pvs2','คอมพิวเตอร์ธุรกิจดิจิทัล','2568',1),
('สทธ68-23','สทธ.68-23','pvs2','คอมพิวเตอร์ธุรกิจดิจิทัล','2568',1),
('สทธ68-31','สทธ.68-31','pvs2','คอมพิวเตอร์ธุรกิจดิจิทัล','2568',1),
-- ── สทธ.69 (ปวส.1) ───────────────────────────────────
('สทธ69-11','สทธ.69-11','pvs1','คอมพิวเตอร์ธุรกิจดิจิทัล','2568',1),
('สทธ69-2', 'สทธ.69-2', 'pvs1','คอมพิวเตอร์ธุรกิจดิจิทัล','2568',1),
('สทธ69-3', 'สทธ.69-3', 'pvs1','คอมพิวเตอร์ธุรกิจดิจิทัล','2568',1),
('สทธ69-4', 'สทธ.69-4', 'pvs1','คอมพิวเตอร์ธุรกิจดิจิทัล','2568',1);

-- =====================================================
-- สำหรับ DB ที่ติดตั้งแล้ว: เพิ่มคอลัมน์ใหม่
-- =====================================================
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `department` VARCHAR(200) COMMENT 'แผนกวิชา (สำหรับอาจารย์)';
ALTER TABLE `student_profiles` ADD COLUMN IF NOT EXISTS `year_level` VARCHAR(10) DEFAULT 'pvc1' COMMENT 'ระดับชั้น' AFTER `classroom_id`;
