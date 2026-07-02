<?php
// ONE-TIME RESET SCRIPT — ลบหลังใช้แล้ว
require_once 'config.php';
startSession();

$db = getDB();

// ลบความสัมพันธ์อาจารย์-ห้อง
$db->query("DELETE FROM teacher_classrooms");
// ปลด classroom_id นักศึกษาทุกคน
$db->query("UPDATE student_profiles SET classroom_id = NULL");
// ลบห้องเรียนทั้งหมด
$db->query("DELETE FROM classrooms");
// Reset AUTO_INCREMENT
$db->query("ALTER TABLE classrooms AUTO_INCREMENT = 1");

header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'success' => true,
    'message' => 'เคลียข้อมูลห้องที่ปรึกษาทั้งหมดสำเร็จ',
    'affected' => [
        'classrooms' => 'ลบแล้ว',
        'teacher_classrooms' => 'ลบแล้ว',
        'student_profiles.classroom_id' => 'SET NULL แล้ว'
    ]
], JSON_UNESCAPED_UNICODE);
