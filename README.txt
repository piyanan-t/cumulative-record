====================================================
ระบบระเบียนสะสมออนไลน์
แผนกวิชาคอมพิวเตอร์ธุรกิจดิจิทัล
====================================================

=== วิธีติดตั้งและใช้งาน ===

--- โหมดสาธิต (ไม่ต้องการ XAMPP) ---
เปิดไฟล์ index.html ด้วย VS Code LiveServer หรือเบราว์เซอร์โดยตรง
ใช้บัญชีทดสอบตามด้านล่าง รหัสผ่าน: password

--- ใช้งานกับ XAMPP (เต็มรูปแบบ) ---
1. คัดลอกโฟลเดอร์ Project_J ไปไว้ที่ C:\xampp\htdocs\Project_J
2. เปิด XAMPP Control Panel > Start Apache และ MySQL
3. เปิด phpMyAdmin: http://localhost/phpmyadmin
4. สร้าง database ชื่อ "cumulative_db" (utf8mb4_unicode_ci)
5. Import ไฟล์ database/setup.sql
6. เปิดเว็บ: http://localhost/Project_J/

=== โครงสร้างไฟล์ ===

Project_J/
├── index.html          ← หน้า Login
├── student.html        ← หน้านักศึกษา (กรอกระเบียนสะสม)
├── teacher.html        ← หน้าอาจารย์ (ติดตามนักศึกษา)
├── admin.html          ← หน้า Admin (จัดการระบบ)
│
├── assets/
│   ├── css/styles.css  ← CSS หลัก (theme, components)
│   └── js/
│       ├── i18n.js     ← ระบบภาษา ไทย/อังกฤษ
│       ├── app.js      ← Utilities ร่วม
│       ├── student.js  ← Logic สำหรับนักศึกษา
│       └── teacher.js  ← Logic สำหรับอาจารย์
│
├── api/
│   ├── config.php      ← การตั้งค่า Database
│   ├── login.php       ← API Login
│   ├── logout.php      ← API Logout
│   ├── student.php     ← API นักศึกษา
│   ├── teacher.php     ← API อาจารย์
│   └── admin.php       ← API Admin
│
└── database/
    └── setup.sql       ← SQL Schema + ข้อมูลตัวอย่าง

=== บัญชีผู้ใช้ทดสอบ ===

[Admin]
  รหัส: admin001
  รหัสผ่าน: password

[อาจารย์]
  รหัส: T001 / T002 / T003
  รหัสผ่าน: password

[นักศึกษา]
  รหัส: 6701001, 6701002, 6701003, 6701004
         6702001, 6702002, 6703001, 6703002
  รหัสผ่าน: password

=== ความสามารถของระบบ ===

[นักศึกษา]
✅ กรอกระเบียนสะสม 4 หน้า
✅ ดูตัวอย่างเอกสาร Real-time (Preview)
✅ บันทึกร่าง / ส่งเอกสาร
✅ พิมพ์ / Export PDF
✅ วาดแผนที่การเดินทาง (Canvas)
✅ รับการแจ้งเตือนจากอาจารย์

[อาจารย์]
✅ ดูรายชื่อนักศึกษาทั้งหมด
✅ กรองตามชั้นปี / ห้อง / สถานะ / จังหวัด / สัญชาติ
✅ ค้นหานักศึกษา
✅ ดูข้อมูลรายละเอียดนักศึกษา
✅ ส่งการแจ้งเตือนไปยังนักศึกษา
✅ เพิ่มห้องที่ปรึกษา
✅ Dashboard พร้อมกราฟ

[Admin]
✅ ทำทุกอย่างที่นักศึกษาและอาจารย์ทำได้
✅ จัดการผู้ใช้ (เพิ่ม/แก้ไข/ระงับ)
✅ จัดการห้องเรียน
✅ Dashboard ภาพรวมทั้งหมด
✅ บันทึกกิจกรรม (Activity Log)
✅ ตั้งค่าระบบ
✅ Export CSV

=== ฟีเจอร์เพิ่มเติม ===
🌙 Dark Mode / Light Mode
🌐 ภาษาไทย / English
📱 Responsive Design
🔒 Session-based Authentication

====================================================
