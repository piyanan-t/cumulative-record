<?php
require_once 'config.php';
$session = checkAuth(['admin']);
$userId = $session['user_id'];
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$db = getDB();

// ============================
// USERS MANAGEMENT
// ============================
if ($action === 'get_users') {
    $role = $_GET['role'] ?? null;
    $search = $_GET['search'] ?? null;
    $where = ['1=1'];
    $params = []; $types = '';

    if ($role) { $where[] = 'role = ?'; $params[] = $role; $types .= 's'; }
    if ($search) {
        $where[] = '(user_id LIKE ? OR full_name LIKE ? OR email LIKE ?)';
        $s = "%$search%";
        $params[] = $s; $params[] = $s; $params[] = $s;
        $types .= 'sss';
    }

    $sql = "SELECT u.*, IF(role='student', sp.student_code, NULL) as student_code,
            IF(role='student', c.room_name, NULL) as room_name,
            IF(role='student', sp.year_level, NULL) as year_level
            FROM users u
            LEFT JOIN student_profiles sp ON u.user_id = sp.user_id
            LEFT JOIN classrooms c ON sp.classroom_id = c.id
            WHERE " . implode(' AND ', $where) . " ORDER BY role ASC, u.created_at DESC";

    if (!empty($params)) {
        $stmt = $db->prepare($sql);
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $users = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
    } else {
        $users = $db->query($sql)->fetch_all(MYSQLI_ASSOC);
    }

    // Remove passwords
    foreach ($users as &$u) unset($u['password']);
    sendJSON(['success' => true, 'data' => $users, 'total' => count($users)]);
}

if ($action === 'create_user' && $method === 'POST') {
    $input = getInput();
    $newUserId = sanitize($input['user_id'] ?? '');
    $rawPassword = $input['password'] ?? '';
    $role = sanitize($input['role'] ?? 'student');
    $fullName = sanitize($input['full_name'] ?? '');
    $email = sanitize($input['email'] ?? '');
    $phone = sanitize($input['phone'] ?? '');
    $department = sanitize($input['department'] ?? '');

    if (!$newUserId || !$fullName) sendJSON(['success' => false, 'message' => 'กรุณากรอกข้อมูลที่จำเป็น']);
    if (!$rawPassword) sendJSON(['success' => false, 'message' => 'กรุณากรอกรหัสผ่าน']);
    $password = password_hash($rawPassword, PASSWORD_DEFAULT);

    $stmt = $db->prepare("INSERT INTO users (user_id, password, role, full_name, email, phone, department) VALUES (?,?,?,?,?,?,?)");
    $stmt->bind_param('sssssss', $newUserId, $password, $role, $fullName, $email, $phone, $department);
    if (!$stmt->execute()) {
        sendJSON(['success' => false, 'message' => 'รหัสผู้ใช้นี้มีอยู่แล้ว']);
    }
    $stmt->close();

    // If student, create profile
    if ($role === 'student') {
        $studentCode = sanitize($input['student_code'] ?? $newUserId);
        $classroomId = intval($input['classroom_id'] ?? 0) ?: null;
        $yearLevel = sanitize($input['year_level'] ?? 'pvc1');
        $firstName = sanitize($input['first_name_th'] ?? '');
        $lastName = sanitize($input['last_name_th'] ?? '');
        $prefix = sanitize($input['prefix'] ?? 'นาย');
        if (!$firstName && $fullName) {
            $nameParts = explode(' ', str_replace(['นาย','นางสาว','นาง'], '', $fullName), 2);
            $firstName = $nameParts[0] ?? '';
            $lastName = $nameParts[1] ?? '';
        }
        $stmt = $db->prepare("INSERT INTO student_profiles (user_id, student_code, classroom_id, year_level, prefix, first_name_th, last_name_th) VALUES (?,?,?,?,?,?,?)");
        $stmt->bind_param('ssissss', $newUserId, $studentCode, $classroomId, $yearLevel, $prefix, $firstName, $lastName);
        $stmt->execute();
        $stmt->close();
    }

    logActivity($userId, 'create_user', 'user', $newUserId, "สร้างผู้ใช้ใหม่: $fullName ($role)");
    sendJSON(['success' => true, 'message' => 'สร้างผู้ใช้สำเร็จ']);
}

if ($action === 'update_user' && $method === 'POST') {
    $input = getInput();
    $targetId = sanitize($input['user_id'] ?? '');
    if (!$targetId) sendJSON(['success' => false, 'message' => 'Missing user_id']);

    $updates = [];
    $params = []; $types = '';
    foreach (['full_name','email','phone','department','is_active'] as $f) {
        if (isset($input[$f])) {
            $updates[] = "$f = ?";
            $params[] = $input[$f];
            $types .= ($f === 'is_active') ? 'i' : 's';
        }
    }
    if (isset($input['password']) && $input['password']) {
        $updates[] = 'password = ?';
        $params[] = password_hash($input['password'], PASSWORD_DEFAULT);
        $types .= 's';
    }

    if (!empty($updates)) {
        $params[] = $targetId; $types .= 's';
        $sql = "UPDATE users SET " . implode(', ', $updates) . " WHERE user_id = ?";
        $stmt = $db->prepare($sql);
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $stmt->close();
    }

    // Update year_level in student_profiles
    if (isset($input['year_level'])) {
        $yl = sanitize($input['year_level']);
        $stmt = $db->prepare("UPDATE student_profiles SET year_level = ? WHERE user_id = ?");
        $stmt->bind_param('ss', $yl, $targetId);
        $stmt->execute(); $stmt->close();
    }

    logActivity($userId, 'update_user', 'user', $targetId, 'แก้ไขข้อมูลผู้ใช้');
    sendJSON(['success' => true, 'message' => 'อัปเดตผู้ใช้สำเร็จ']);
}

if ($action === 'delete_user' && $method === 'POST') {
    $input = getInput();
    $targetId = sanitize($input['user_id'] ?? '');
    if ($targetId === $userId) sendJSON(['success' => false, 'message' => 'ไม่สามารถระงับบัญชีของตัวเองได้']);

    $stmt = $db->prepare("SELECT is_active FROM users WHERE user_id = ?");
    $stmt->bind_param('s', $targetId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$row) sendJSON(['success' => false, 'message' => 'ไม่พบผู้ใช้']);

    $newActive = $row['is_active'] ? 0 : 1;
    $stmt = $db->prepare("UPDATE users SET is_active = ? WHERE user_id = ?");
    $stmt->bind_param('is', $newActive, $targetId);
    $stmt->execute();
    $stmt->close();

    $msg = $newActive ? 'เปิดใช้งานบัญชีสำเร็จ' : 'ระงับบัญชีผู้ใช้สำเร็จ';
    logActivity($userId, 'delete_user', 'user', $targetId, $msg);
    sendJSON(['success' => true, 'message' => $msg]);
}

if ($action === 'remove_user' && $method === 'POST') {
    $input = getInput();
    $targetId = sanitize($input['user_id'] ?? '');
    if (!$targetId) sendJSON(['success' => false, 'message' => 'ไม่พบ user_id']);
    if ($targetId === $userId) sendJSON(['success' => false, 'message' => 'ไม่สามารถลบบัญชีของตัวเองได้']);

    $stmt = $db->prepare("DELETE FROM student_profiles WHERE user_id = ?");
    $stmt->bind_param('s', $targetId);
    $stmt->execute();
    $stmt->close();

    $stmt = $db->prepare("DELETE FROM users WHERE user_id = ?");
    $stmt->bind_param('s', $targetId);
    $stmt->execute();
    $stmt->close();

    logActivity($userId, 'remove_user', 'user', $targetId, "ลบผู้ใช้ $targetId ออกจากระบบถาวร");
    sendJSON(['success' => true, 'message' => 'ลบผู้ใช้ออกจากระบบสำเร็จ']);
}

if ($action === 'bulk_remove_users') {
    $input = getInput();
    $targetIds = $input['user_ids'] ?? [];
    if (empty($targetIds)) sendJSON(['success' => false, 'message' => 'ไม่มีรายการที่เลือก']);

    $deleted = 0;
    $skipped = 0;
    $db->autocommit(false);
    foreach ($targetIds as $tid) {
        $tid = sanitize($tid);
        if (!$tid || $tid === $userId) { $skipped++; continue; }

        $tables = [
            "DELETE FROM student_profiles WHERE user_id = ?",
            "DELETE FROM teacher_classrooms WHERE teacher_id = ?",
        ];
        foreach ($tables as $sql) {
            $s = $db->prepare($sql);
            if ($s) { $s->bind_param('s', $tid); $s->execute(); $s->close(); }
        }

        $stmt = $db->prepare("DELETE FROM users WHERE user_id = ?");
        if ($stmt) {
            $stmt->bind_param('s', $tid);
            $stmt->execute();
            if ($stmt->affected_rows > 0) $deleted++;
            $stmt->close();
        }
    }
    $db->commit();
    $db->autocommit(true);

    logActivity($userId, 'bulk_remove_users', 'user', null, "ลบผู้ใช้จำนวน $deleted คนออกจากระบบถาวร");
    $msg = "ลบสำเร็จ $deleted คน" . ($skipped ? " (ข้าม $skipped คน)" : '');
    sendJSON(['success' => true, 'message' => $msg]);
}

// ============================
// CLASSROOMS MANAGEMENT
// ============================
if ($action === 'get_classrooms') {
    $classrooms = $db->query("SELECT c.*,
        COUNT(sp.id) as student_count,
        SUM(CASE WHEN sp.form_status='submitted' THEN 1 ELSE 0 END) as submitted_count,
        SUM(CASE WHEN sp.form_status='not_started' THEN 1 ELSE 0 END) as not_started_count,
        GROUP_CONCAT(DISTINCT u.full_name SEPARATOR ', ') as teachers
        FROM classrooms c
        LEFT JOIN student_profiles sp ON c.id = sp.classroom_id
        LEFT JOIN teacher_classrooms tc ON c.id = tc.classroom_id
        LEFT JOIN users u ON tc.teacher_id = u.user_id
        WHERE c.is_active = 1
        GROUP BY c.id
        ORDER BY c.year_level ASC, c.room_code ASC")->fetch_all(MYSQLI_ASSOC);
    sendJSON(['success' => true, 'data' => $classrooms]);
}

if ($action === 'create_classroom' && $method === 'POST') {
    $input = getInput();
    $roomCode = sanitize($input['room_code'] ?? '');
    $roomName = sanitize($input['room_name'] ?? '');
    $yearLevel = sanitize($input['year_level'] ?? 'pvc1');
    $program = sanitize($input['program'] ?? 'คอมพิวเตอร์ธุรกิจดิจิทัล');
    $academicYear = sanitize($input['academic_year'] ?? '');
    $semester = intval($input['semester'] ?? 1);

    $stmt = $db->prepare("INSERT INTO classrooms (room_code, room_name, year_level, program, academic_year, semester) VALUES (?,?,?,?,?,?)");
    $stmt->bind_param('sssssi', $roomCode, $roomName, $yearLevel, $program, $academicYear, $semester);
    if (!$stmt->execute()) sendJSON(['success' => false, 'message' => 'รหัสห้องนี้มีอยู่แล้ว']);
    $stmt->close();

    logActivity($userId, 'create_classroom', 'classroom', null, "สร้างห้องเรียน: $roomName");
    sendJSON(['success' => true, 'message' => 'สร้างห้องเรียนสำเร็จ']);
}

if ($action === 'update_classroom' && $method === 'POST') {
    $input = getInput();
    $cId = intval($input['id'] ?? 0);
    $stmt = $db->prepare("UPDATE classrooms SET room_name=?, year_level=?, program=?, academic_year=?, semester=?, is_active=? WHERE id=?");
    $rn = sanitize($input['room_name'] ?? '');
    $yl = sanitize($input['year_level'] ?? 'pvc1');
    $pr = sanitize($input['program'] ?? '');
    $ay = sanitize($input['academic_year'] ?? '');
    $sem = intval($input['semester'] ?? 1);
    $active = intval($input['is_active'] ?? 1);
    $stmt->bind_param('sssssii', $rn, $yl, $pr, $ay, $sem, $active, $cId);
    $stmt->execute(); $stmt->close();
    logActivity($userId, 'update_classroom', 'classroom', $cId, 'แก้ไขห้องเรียน');
    sendJSON(['success' => true, 'message' => 'อัปเดตห้องเรียนสำเร็จ']);
}

if ($action === 'delete_classroom' && $method === 'POST') {
    $input = getInput();
    $cId = intval($input['id'] ?? 0);
    $stmt = $db->prepare("UPDATE student_profiles SET classroom_id = NULL WHERE classroom_id = ?");
    $stmt->bind_param('i', $cId);
    $stmt->execute(); $stmt->close();
    $stmt = $db->prepare("DELETE FROM teacher_classrooms WHERE classroom_id = ?");
    $stmt->bind_param('i', $cId);
    $stmt->execute(); $stmt->close();
    $stmt = $db->prepare("DELETE FROM classrooms WHERE id = ?");
    $stmt->bind_param('i', $cId);
    $stmt->execute(); $stmt->close();
    logActivity($userId, 'delete_classroom', 'classroom', $cId, 'ลบห้องเรียน');
    sendJSON(['success' => true, 'message' => 'ลบห้องเรียนสำเร็จ']);
}

if ($action === 'reset_classrooms' && $method === 'POST') {
    $db->query("UPDATE student_profiles SET classroom_id = NULL");
    $db->query("DELETE FROM teacher_classrooms");
    $db->query("DELETE FROM classrooms");
    $db->query("ALTER TABLE classrooms AUTO_INCREMENT = 1");
    logActivity($userId, 'reset_classrooms', 'classroom', 0, 'เคลียร์ห้องเรียนทั้งหมด');
    sendJSON(['success' => true, 'message' => 'เคลียร์ห้องเรียนทั้งหมดสำเร็จ']);
}

// ============================
// TEACHER ASSIGNMENT
// ============================
if ($action === 'get_classroom_teachers') {
    $cId = intval($_GET['classroom_id'] ?? 0);
    if (!$cId) sendJSON(['success' => false, 'message' => 'Missing classroom_id']);
    $stmt = $db->prepare("SELECT tc.teacher_id, u.full_name FROM teacher_classrooms tc JOIN users u ON tc.teacher_id = u.user_id WHERE tc.classroom_id = ?");
    $stmt->bind_param('i', $cId);
    $stmt->execute();
    $teachers = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    sendJSON(['success' => true, 'data' => $teachers]);
}

if ($action === 'assign_teacher' && $method === 'POST') {
    $input = getInput();
    $cId = intval($input['classroom_id'] ?? 0);
    $teacherId = sanitize($input['teacher_id'] ?? '');
    if (!$cId || !$teacherId) sendJSON(['success' => false, 'message' => 'ข้อมูลไม่ครบ']);
    $stmt = $db->prepare("INSERT IGNORE INTO teacher_classrooms (teacher_id, classroom_id) VALUES (?,?)");
    $stmt->bind_param('si', $teacherId, $cId);
    $stmt->execute(); $stmt->close();
    logActivity($userId, 'assign_teacher', 'classroom', $cId, "มอบหมายอาจารย์ $teacherId ให้ห้อง $cId");
    sendJSON(['success' => true, 'message' => 'มอบหมายอาจารย์สำเร็จ']);
}

if ($action === 'unassign_teacher' && $method === 'POST') {
    $input = getInput();
    $cId = intval($input['classroom_id'] ?? 0);
    $teacherId = sanitize($input['teacher_id'] ?? '');
    if (!$cId || !$teacherId) sendJSON(['success' => false, 'message' => 'ข้อมูลไม่ครบ']);
    $stmt = $db->prepare("DELETE FROM teacher_classrooms WHERE teacher_id = ? AND classroom_id = ?");
    $stmt->bind_param('si', $teacherId, $cId);
    $stmt->execute(); $stmt->close();
    logActivity($userId, 'unassign_teacher', 'classroom', $cId, "ยกเลิกมอบหมาย $teacherId จากห้อง $cId");
    sendJSON(['success' => true, 'message' => 'ยกเลิกการมอบหมายสำเร็จ']);
}

if ($action === 'get_all_assignments') {
    $result = $db->query("SELECT tc.classroom_id, tc.teacher_id, u.full_name, c.room_name
                          FROM teacher_classrooms tc
                          JOIN users u ON tc.teacher_id = u.user_id
                          JOIN classrooms c ON tc.classroom_id = c.id
                          ORDER BY c.room_name, u.full_name");
    sendJSON(['success' => true, 'data' => $result->fetch_all(MYSQLI_ASSOC)]);
}

if ($action === 'bulk_assign_teacher' && $method === 'POST') {
    $input = getInput();
    $teacherIds  = $input['teacher_ids']  ?? [];
    $classroomIds = $input['classroom_ids'] ?? [];
    if (empty($teacherIds) || empty($classroomIds)) sendJSON(['success' => false, 'message' => 'ข้อมูลไม่ครบ']);
    $stmt = $db->prepare("INSERT IGNORE INTO teacher_classrooms (teacher_id, classroom_id) VALUES (?,?)");
    $count = 0;
    foreach ($teacherIds as $tid) {
        $tid = sanitize($tid);
        foreach ($classroomIds as $cid) {
            $cid = intval($cid);
            if (!$tid || !$cid) continue;
            $stmt->bind_param('si', $tid, $cid);
            $stmt->execute();
            if ($stmt->affected_rows > 0) $count++;
        }
    }
    $stmt->close();
    logActivity($userId, 'bulk_assign_teacher', 'classroom', 0, "มอบหมายอาจารย์ " . count($teacherIds) . " คน เข้า " . count($classroomIds) . " ห้อง ($count รายการใหม่)");
    sendJSON(['success' => true, 'message' => "มอบหมายสำเร็จ $count รายการ"]);
}

// ============================
// SYSTEM DASHBOARD
// ============================
if ($action === 'dashboard') {
    // Overall stats
    $stats = $db->query("SELECT
        (SELECT COUNT(*) FROM users WHERE role='student' AND is_active=1) as total_students,
        (SELECT COUNT(*) FROM users WHERE role='teacher' AND is_active=1) as total_teachers,
        (SELECT COUNT(*) FROM classrooms WHERE is_active=1) as total_classrooms,
        (SELECT COUNT(*) FROM student_profiles WHERE form_status='submitted') as submitted_forms,
        (SELECT COUNT(*) FROM student_profiles WHERE form_status='not_started') as pending_forms,
        (SELECT COUNT(*) FROM notifications WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as recent_notifications")->fetch_assoc();

    // Monthly submissions trend
    $trend = $db->query("SELECT DATE_FORMAT(form_submitted_at, '%Y-%m') as month, COUNT(*) as count
                         FROM student_profiles WHERE form_status='submitted' AND form_submitted_at IS NOT NULL
                         GROUP BY month ORDER BY month DESC LIMIT 6")->fetch_all(MYSQLI_ASSOC);

    // Status distribution
    $statusDist = $db->query("SELECT form_status, COUNT(*) as cnt FROM student_profiles GROUP BY form_status")->fetch_all(MYSQLI_ASSOC);

    // By province
    $byProvince = $db->query("SELECT province, COUNT(*) as cnt FROM student_profiles WHERE province IS NOT NULL GROUP BY province ORDER BY cnt DESC LIMIT 8")->fetch_all(MYSQLI_ASSOC);

    // By nationality — grouped by country
    $byNationality = $db->query("
        SELECT
          CASE WHEN nationality IN ('ไทย','เวียดนาม','ลาว','กัมพูชา') THEN nationality
               WHEN nationality IS NULL OR nationality='' THEN 'ไม่ระบุ'
               ELSE 'อื่นๆ' END AS nationality,
          COUNT(*) AS cnt
        FROM student_profiles
        GROUP BY 1
        ORDER BY FIELD(nationality,'ไทย','เวียดนาม','ลาว','กัมพูชา','อื่นๆ','ไม่ระบุ')
    ")->fetch_all(MYSQLI_ASSOC);

    // Gender distribution — infer from prefix when gender field is empty/wrong
    $byGender = $db->query("
        SELECT
          CASE WHEN gender='female' OR prefix IN ('นางสาว','นาง') THEN 'female' ELSE 'male' END AS gender,
          COUNT(*) AS cnt
        FROM student_profiles
        GROUP BY 1
    ")->fetch_all(MYSQLI_ASSOC);

    // By year level
    $byYearLevel = $db->query("
        SELECT year_level, COUNT(*) AS cnt
        FROM student_profiles
        WHERE year_level IS NOT NULL AND year_level != ''
        GROUP BY year_level
        ORDER BY FIELD(year_level,'pvc1','pvc2','pvc3','pvs1','pvs2')
    ")->fetch_all(MYSQLI_ASSOC);

    // Activity log recent
    $recentActivity = $db->query("SELECT al.*, u.full_name, u.role FROM activity_logs al LEFT JOIN users u ON al.user_id = u.user_id ORDER BY al.created_at DESC LIMIT 20")->fetch_all(MYSQLI_ASSOC);

    sendJSON(['success' => true, 'data' => compact('stats', 'trend', 'statusDist', 'byProvince', 'byNationality', 'byGender', 'byYearLevel', 'recentActivity')]);
}

// ============================
// ACTIVITY LOGS
// ============================
if ($action === 'get_activity_logs') {
    $limit = intval($_GET['limit'] ?? 50);
    $offset = intval($_GET['offset'] ?? 0);
    $filterRole = $_GET['role'] ?? null;
    $filterAction = $_GET['action_filter'] ?? null;
    $search = $_GET['search'] ?? null;

    $where = ['1=1'];
    $params = []; $types = '';

    if ($filterRole) { $where[] = 'u.role = ?'; $params[] = $filterRole; $types .= 's'; }
    if ($filterAction) { $where[] = 'al.action = ?'; $params[] = $filterAction; $types .= 's'; }
    if ($search) {
        $where[] = '(u.full_name LIKE ? OR al.action LIKE ? OR al.details LIKE ?)';
        $s = "%$search%";
        $params[] = $s; $params[] = $s; $params[] = $s; $types .= 'sss';
    }

    $whereStr = implode(' AND ', $where);
    $countSql = "SELECT COUNT(*) as cnt FROM activity_logs al LEFT JOIN users u ON al.user_id = u.user_id WHERE $whereStr";
    $sql = "SELECT al.*, u.full_name, u.role FROM activity_logs al LEFT JOIN users u ON al.user_id = u.user_id WHERE $whereStr ORDER BY al.created_at DESC LIMIT $limit OFFSET $offset";

    if (!empty($params)) {
        $stmt = $db->prepare($countSql);
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $total = $stmt->get_result()->fetch_assoc()['cnt'];
        $stmt->close();

        $stmt = $db->prepare($sql);
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $logs = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
    } else {
        $total = $db->query($countSql)->fetch_assoc()['cnt'];
        $logs = $db->query($sql)->fetch_all(MYSQLI_ASSOC);
    }

    sendJSON(['success' => true, 'data' => $logs, 'total' => $total]);
}

// ============================
// SYSTEM SETTINGS
// ============================
if ($action === 'get_settings') {
    $settings = $db->query("SELECT * FROM system_settings ORDER BY setting_group ASC, setting_key ASC")->fetch_all(MYSQLI_ASSOC);
    sendJSON(['success' => true, 'data' => $settings]);
}

if ($action === 'save_settings' && $method === 'POST') {
    $input = getInput();
    $settings = $input['settings'] ?? [];
    $stmt = $db->prepare("INSERT INTO system_settings (setting_key, setting_value) VALUES (?,?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
    foreach ($settings as $key => $val) {
        $k = sanitize($key);
        $v = sanitize($val);
        $stmt->bind_param('ss', $k, $v);
        $stmt->execute();
    }
    $stmt->close();
    logActivity($userId, 'save_settings', 'system', null, 'บันทึกการตั้งค่าระบบ');
    sendJSON(['success' => true, 'message' => 'บันทึกการตั้งค่าสำเร็จ']);
}

// ============================
// EXPORT DATA
// ============================
if ($action === 'export_students') {
    $classroomId = $_GET['classroom_id'] ?? null;
    $where = '1=1';
    if ($classroomId) $where .= " AND sp.classroom_id = " . intval($classroomId);

    $students = $db->query("SELECT sp.student_code, CONCAT(sp.prefix, sp.first_name_th, ' ', sp.last_name_th) as name,
                             c.room_name, sp.gender, sp.province, sp.nationality, sp.form_status, sp.phone, sp.email
                             FROM student_profiles sp
                             LEFT JOIN classrooms c ON sp.classroom_id = c.id
                             WHERE $where
                             ORDER BY c.room_code ASC, sp.student_code ASC")->fetch_all(MYSQLI_ASSOC);

    sendJSON(['success' => true, 'data' => $students]);
}

// ============================
// IMPORT STUDENTS FROM EXCEL
// ============================
if ($action === 'import_students' && $method === 'POST') {
    $input = getInput();
    $students    = $input['students']     ?? [];
    $classroomId = intval($input['classroom_id'] ?? 0) ?: null;
    $yearLevel   = sanitize($input['year_level'] ?? 'pvc1');

    if (empty($students)) sendJSON(['success' => false, 'message' => 'ไม่มีข้อมูลนักศึกษา']);

    $defaultPassword = password_hash('irpct1234!', PASSWORD_DEFAULT);
    $results = ['success' => 0, 'failed' => 0, 'errors' => []];

    foreach ($students as $s) {
        $studentCode = sanitize($s['student_code'] ?? '');
        if (!$studentCode) { $results['failed']++; $results['errors'][] = 'ไม่มีรหัสนักศึกษา'; continue; }

        $prefix    = sanitize($s['prefix']       ?? '');
        $firstName = sanitize($s['first_name_th'] ?? '');
        $lastName  = sanitize($s['last_name_th']  ?? '');
        $fullName  = trim($prefix . $firstName . ' ' . $lastName);

        $stmt = $db->prepare("INSERT INTO users (user_id, password, role, full_name) VALUES (?,?,'student',?)");
        $stmt->bind_param('sss', $studentCode, $defaultPassword, $fullName);
        if (!$stmt->execute()) {
            $results['failed']++;
            $results['errors'][] = "รหัส $studentCode มีอยู่แล้ว";
            $stmt->close();
            continue;
        }
        $stmt->close();

        $stmt = $db->prepare("INSERT INTO student_profiles (user_id, student_code, classroom_id, year_level, prefix, first_name_th, last_name_th) VALUES (?,?,?,?,?,?,?)");
        $stmt->bind_param('ssissss', $studentCode, $studentCode, $classroomId, $yearLevel, $prefix, $firstName, $lastName);
        $stmt->execute();
        $stmt->close();

        $results['success']++;
    }

    logActivity($userId, 'import_students', 'user', null,
        "นำเข้านักศึกษา {$results['success']} คน (ซ้ำ/ผิดพลาด {$results['failed']} คน)");

    $msg = "นำเข้าสำเร็จ {$results['success']} คน" . ($results['failed'] ? ", ล้มเหลว {$results['failed']} คน" : '');
    sendJSON(['success' => true, 'results' => $results, 'message' => $msg]);
}

// ============================
// IMPORT TEACHERS FROM EXCEL
// ============================
if ($action === 'import_teachers' && $method === 'POST') {
    $input = getInput();
    $teachers = $input['teachers'] ?? [];
    if (empty($teachers)) sendJSON(['success' => false, 'message' => 'ไม่มีข้อมูลอาจารย์']);

    $results = ['success' => 0, 'failed' => 0, 'errors' => []];

    foreach ($teachers as $t) {
        $newUserId = sanitize($t['user_id'] ?? '');
        if (!$newUserId) { $results['failed']++; $results['errors'][] = 'ไม่มีรหัสผู้ใช้'; continue; }

        $prefix    = sanitize($t['prefix']     ?? 'นาย');
        $firstName = sanitize($t['first_name'] ?? '');
        $lastName  = sanitize($t['last_name']  ?? '');
        $fullName  = trim($prefix . $firstName . ' ' . $lastName);
        $dept     = sanitize($t['department'] ?? '');
        $rawPw    = $t['password'] ?? 'teacher@1234';
        $password = password_hash($rawPw, PASSWORD_DEFAULT);

        $stmt = $db->prepare("INSERT INTO users (user_id, password, role, full_name, department) VALUES (?,?,'teacher',?,?)");
        $stmt->bind_param('ssss', $newUserId, $password, $fullName, $dept);
        if (!$stmt->execute()) {
            $results['failed']++;
            $results['errors'][] = "รหัส $newUserId มีอยู่แล้ว";
            $stmt->close();
            continue;
        }
        $stmt->close();
        $results['success']++;
    }

    logActivity($userId, 'import_teachers', 'user', null,
        "นำเข้าอาจารย์ {$results['success']} คน (ซ้ำ/ผิดพลาด {$results['failed']} คน)");

    $msg = "นำเข้าสำเร็จ {$results['success']} คน" . ($results['failed'] ? ", ล้มเหลว {$results['failed']} คน" : '');
    sendJSON(['success' => true, 'results' => $results, 'message' => $msg]);
}

sendJSON(['success' => false, 'message' => 'Invalid action'], 400);
