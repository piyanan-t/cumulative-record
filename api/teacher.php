<?php
require_once 'config.php';
$session = checkAuth(['teacher', 'admin']);
$userId = $session['user_id'];
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$db = getDB();

function getTeacherClassroomIds($db, $userId) {
    $stmt = $db->prepare("SELECT classroom_id FROM teacher_classrooms WHERE teacher_id = ?");
    $stmt->bind_param('s', $userId);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    return array_column($rows, 'classroom_id');
}

// ============================
// GET STUDENTS LIST
// ============================
if ($method === 'GET' && $action === 'get_students') {
    $classroomId = $_GET['classroom_id'] ?? null;
    $yearLevel = $_GET['year_level'] ?? null;
    $formStatus = $_GET['form_status'] ?? null;
    $province = $_GET['province'] ?? null;
    $district = $_GET['district'] ?? null;
    $subdistrict = $_GET['subdistrict'] ?? null;
    $nationality = $_GET['nationality'] ?? null;
    $search = $_GET['search'] ?? null;

    $where = ['1=1'];
    $params = [];
    $types = '';

    // Teachers can only see their own classrooms (unless admin)
    if ($session['role'] === 'teacher') {
        $tcIds = getTeacherClassroomIds($db, $userId);
        if (!empty($tcIds)) {
            $placeholders = implode(',', array_fill(0, count($tcIds), '?'));
            $where[] = "sp.classroom_id IN ($placeholders)";
            foreach ($tcIds as $id) { $params[] = $id; $types .= 'i'; }
        } else {
            sendJSON(['success' => true, 'data' => [], 'total' => 0]);
        }
    }

    if ($classroomId) {
        $where[] = 'sp.classroom_id = ?';
        $params[] = $classroomId;
        $types .= 'i';
    }
    if ($yearLevel) {
        $where[] = 'c.year_level = ?';
        $params[] = $yearLevel;
        $types .= 's';
    }
    if ($formStatus) {
        $where[] = 'sp.form_status = ?';
        $params[] = $formStatus;
        $types .= 's';
    }
    if ($province) {
        $where[] = 'sp.province LIKE ?';
        $params[] = "%$province%";
        $types .= 's';
    }
    if ($district) {
        $where[] = 'sp.district LIKE ?';
        $params[] = "%$district%";
        $types .= 's';
    }
    if ($subdistrict) {
        $where[] = 'sp.subdistrict LIKE ?';
        $params[] = "%$subdistrict%";
        $types .= 's';
    }
    if ($nationality) {
        $where[] = 'sp.nationality = ?';
        $params[] = $nationality;
        $types .= 's';
    }
    if ($search) {
        $where[] = '(sp.first_name_th LIKE ? OR sp.last_name_th LIKE ? OR sp.student_code LIKE ? OR u.full_name LIKE ?)';
        $s = "%$search%";
        $params[] = $s; $params[] = $s; $params[] = $s; $params[] = $s;
        $types .= 'ssss';
    }

    $whereStr = implode(' AND ', $where);
    $sql = "SELECT sp.user_id, sp.student_code, sp.prefix, sp.first_name_th, sp.last_name_th,
                   sp.gender, sp.date_of_birth, sp.nationality, sp.province, sp.district, sp.subdistrict,
                   sp.phone, sp.email, sp.form_status, sp.form_submitted_at,
                   sp.id_card_number, sp.address_no, sp.father_name, sp.mother_name,
                   c.room_name, c.room_code, c.year_level,
                   u.full_name, u.last_login,
                   (SELECT COUNT(*) FROM notifications WHERE recipient_id = sp.user_id AND is_read = 0) as unread_notifs
            FROM student_profiles sp
            LEFT JOIN classrooms c ON sp.classroom_id = c.id
            LEFT JOIN users u ON sp.user_id = u.user_id
            WHERE $whereStr
            ORDER BY c.year_level ASC, c.room_code ASC, sp.student_code ASC";

    if (!empty($params)) {
        $stmt = $db->prepare($sql);
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $students = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
    } else {
        $students = $db->query($sql)->fetch_all(MYSQLI_ASSOC);
    }

    // Stats summary
    $total = count($students);
    $submitted = count(array_filter($students, fn($s) => $s['form_status'] === 'submitted'));
    $notStarted = count(array_filter($students, fn($s) => $s['form_status'] !== 'submitted'));

    sendJSON([
        'success' => true,
        'data' => $students,
        'total' => $total,
        'stats' => [
            'submitted' => $submitted,
            'not_started' => $notStarted
        ]
    ]);
}

// ============================
// GET ALL CLASSROOMS (for dropdown when selecting advisory room)
// ============================
if ($method === 'GET' && $action === 'get_all_classrooms') {
    $classrooms = $db->query("SELECT id, room_code, room_name, year_level, academic_year
                              FROM classrooms
                              WHERE is_active = 1
                              ORDER BY year_level ASC, room_code ASC")->fetch_all(MYSQLI_ASSOC);
    sendJSON(['success' => true, 'data' => $classrooms]);
}

// ============================
// GET MY CLASSROOMS
// ============================
if ($method === 'GET' && $action === 'get_classrooms') {
    if ($session['role'] === 'admin') {
        $classrooms = $db->query("SELECT c.*,
            COUNT(sp.id) as student_count,
            SUM(CASE WHEN sp.form_status='submitted' THEN 1 ELSE 0 END) as submitted_count
            FROM classrooms c
            LEFT JOIN student_profiles sp ON c.id = sp.classroom_id
            WHERE c.is_active = 1
            GROUP BY c.id
            ORDER BY c.year_level ASC, c.room_code ASC")->fetch_all(MYSQLI_ASSOC);
    } else {
        $stmt = $db->prepare("SELECT c.*,
            COUNT(sp.id) as student_count,
            SUM(CASE WHEN sp.form_status='submitted' THEN 1 ELSE 0 END) as submitted_count
            FROM classrooms c
            JOIN teacher_classrooms tc ON c.id = tc.classroom_id
            LEFT JOIN student_profiles sp ON c.id = sp.classroom_id
            WHERE tc.teacher_id = ? AND c.is_active = 1
            GROUP BY c.id
            ORDER BY c.year_level ASC, c.room_code ASC");
        $stmt->bind_param('s', $userId);
        $stmt->execute();
        $classrooms = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
    }
    sendJSON(['success' => true, 'data' => $classrooms]);
}

// ============================
// ADD CLASSROOM (teacher's advisory room)
// ============================
if ($method === 'POST' && $action === 'add_advisory_room') {
    $input = getInput();
    if ($session['role'] !== 'admin' && $session['role'] !== 'teacher') {
        sendJSON(['success' => false, 'message' => 'Permission denied'], 403);
    }

    // Check if classroom exists
    $classroomId = intval($input['classroom_id'] ?? 0);
    if (!$classroomId) {
        // Create new classroom
        $roomCode = sanitize($input['room_code'] ?? '');
        $roomName = sanitize($input['room_name'] ?? '');
        $yearLevel = sanitize($input['year_level'] ?? 'pvc1');
        $program = sanitize($input['program'] ?? 'คอมพิวเตอร์ธุรกิจดิจิทัล');
        $academicYear = sanitize($input['academic_year'] ?? '');
        $semester = intval($input['semester'] ?? 1);

        $stmt = $db->prepare("INSERT INTO classrooms (room_code, room_name, year_level, program, academic_year, semester) VALUES (?,?,?,?,?,?)");
        $stmt->bind_param('sssssi', $roomCode, $roomName, $yearLevel, $program, $academicYear, $semester);
        if (!$stmt->execute()) {
            $stmt->close();
            // room_code ซ้ำ — ค้นหาห้องที่มีอยู่แล้วมา link แทน
            $findStmt = $db->prepare("SELECT id FROM classrooms WHERE room_code = ? AND is_active = 1");
            $findStmt->bind_param('s', $roomCode);
            $findStmt->execute();
            $existing = $findStmt->get_result()->fetch_assoc();
            $findStmt->close();
            if (!$existing) {
                sendJSON(['success' => false, 'message' => 'รหัสห้องนี้มีอยู่แล้วและไม่พบในระบบ']);
            }
            $classroomId = $existing['id'];
        } else {
            $classroomId = $db->insert_id;
            $stmt->close();
        }
    }

    // Assign teacher
    $teacherId = ($session['role'] === 'admin' && isset($input['teacher_id'])) ? $input['teacher_id'] : $userId;
    $stmt = $db->prepare("INSERT IGNORE INTO teacher_classrooms (teacher_id, classroom_id) VALUES (?,?)");
    $stmt->bind_param('si', $teacherId, $classroomId);
    $stmt->execute();
    $stmt->close();

    logActivity($userId, 'add_advisory_room', 'classroom', $classroomId, "เพิ่มห้องที่ปรึกษา ID: $classroomId");
    sendJSON(['success' => true, 'message' => 'เพิ่มห้องที่ปรึกษาสำเร็จ', 'classroom_id' => $classroomId]);
}

// ============================
// ADD STUDENT TO CLASSROOM
// ============================
if ($method === 'POST' && $action === 'add_student_to_classroom') {
    $input = getInput();
    $studentId = sanitize($input['student_id'] ?? '');
    $classroomId = intval($input['classroom_id'] ?? 0);

    if (!$studentId || !$classroomId) {
        sendJSON(['success' => false, 'message' => 'ข้อมูลไม่ครบ']);
    }

    $stmt = $db->prepare("SELECT sp.year_level AS student_year, c.year_level AS room_year FROM student_profiles sp, classrooms c WHERE sp.user_id = ? AND c.id = ?");
    $stmt->bind_param('si', $studentId, $classroomId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$row || $row['student_year'] !== $row['room_year']) {
        sendJSON(['success' => false, 'message' => 'ระดับชั้นของนักศึกษาไม่ตรงกับห้องเรียน ไม่สามารถเพิ่มได้']);
    }

    $stmt = $db->prepare("UPDATE student_profiles SET classroom_id = ? WHERE user_id = ?");
    $stmt->bind_param('is', $classroomId, $studentId);
    $stmt->execute();
    $stmt->close();

    logActivity($userId, 'add_student_to_classroom', 'student', $studentId, "เพิ่มนักศึกษา $studentId เข้าห้อง $classroomId");
    sendJSON(['success' => true, 'message' => 'เพิ่มนักศึกษาเข้าห้องสำเร็จ']);
}

// ============================
// SEND NOTIFICATION
// ============================
if ($method === 'POST' && $action === 'send_notification') {
    $input = getInput();
    $title = sanitize($input['title'] ?? 'แจ้งเตือน');
    $message = sanitize($input['message'] ?? '');
    $recipientIds = $input['recipient_ids'] ?? [];
    $classroomId = $input['classroom_id'] ?? null;
    $type = sanitize($input['type'] ?? 'reminder');

    if ($classroomId) {
        // Send to entire classroom
        $stmt = $db->prepare("SELECT user_id FROM student_profiles WHERE classroom_id = ? AND form_status != 'submitted'");
        $stmt->bind_param('i', $classroomId);
        $stmt->execute();
        $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
        $recipientIds = array_column($rows, 'user_id');
    }

    if (empty($recipientIds)) {
        sendJSON(['success' => false, 'message' => 'ไม่มีนักศึกษาที่ต้องการแจ้งเตือน']);
    }

    $stmt = $db->prepare("INSERT INTO notifications (sender_id, recipient_id, title, message, type) VALUES (?,?,?,?,?)");
    $count = 0;
    foreach ($recipientIds as $rid) {
        $stmt->bind_param('sssss', $userId, $rid, $title, $message, $type);
        if ($stmt->execute()) $count++;
    }
    $stmt->close();

    logActivity($userId, 'send_notification', 'notification', null, "ส่งแจ้งเตือน '$title' ถึง $count คน");
    sendJSON(['success' => true, 'message' => "ส่งการแจ้งเตือนถึง $count คนสำเร็จ", 'sent_count' => $count]);
}

// ============================
// DASHBOARD DATA
// ============================
if ($method === 'GET' && $action === 'dashboard') {
    $classroomFilter = '';
    $params = [];
    $types = '';

    if ($session['role'] === 'teacher') {
        $tcIds = getTeacherClassroomIds($db, $userId);
        if (empty($tcIds)) {
            sendJSON(['success' => true, 'data' => ['status_counts' => [], 'by_classroom' => [], 'by_province' => []]]);
        }
        $placeholders = implode(',', array_fill(0, count($tcIds), '?'));
        $classroomFilter = "AND sp.classroom_id IN ($placeholders)";
        foreach ($tcIds as $id) { $params[] = $id; $types .= 'i'; }
    }

    // Status counts
    $sql = "SELECT form_status, COUNT(*) as cnt FROM student_profiles sp WHERE 1=1 $classroomFilter GROUP BY form_status";
    if (!empty($params)) {
        $stmt = $db->prepare($sql);
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $statusCounts = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
    } else {
        $statusCounts = $db->query($sql)->fetch_all(MYSQLI_ASSOC);
    }

    // By classroom
    $sql2 = "SELECT c.id, c.room_name, c.year_level,
              COUNT(sp.id) as total,
              SUM(CASE WHEN sp.form_status='submitted' THEN 1 ELSE 0 END) as submitted,
              SUM(CASE WHEN sp.form_status='not_started' THEN 1 ELSE 0 END) as not_started
              FROM classrooms c
              LEFT JOIN student_profiles sp ON c.id = sp.classroom_id
              WHERE c.is_active = 1";
    if ($session['role'] === 'teacher' && !empty($tcIds)) {
        $placeholders2 = implode(',', array_fill(0, count($tcIds), '?'));
        $sql2 .= " AND c.id IN ($placeholders2)";
        $stmt2 = $db->prepare($sql2 . " GROUP BY c.id ORDER BY c.year_level ASC, c.room_code ASC");
        $types2 = str_repeat('i', count($tcIds));
        $stmt2->bind_param($types2, ...$tcIds);
        $stmt2->execute();
        $byClassroom = $stmt2->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt2->close();
    } else {
        $byClassroom = $db->query($sql2 . " GROUP BY c.id ORDER BY c.year_level ASC, c.room_code ASC")->fetch_all(MYSQLI_ASSOC);
    }

    // By province
    $sql3 = "SELECT sp.province, COUNT(*) as cnt FROM student_profiles sp WHERE sp.province IS NOT NULL $classroomFilter GROUP BY sp.province ORDER BY cnt DESC LIMIT 10";
    if (!empty($params)) {
        $stmt = $db->prepare($sql3);
        $stmt->bind_param($types, ...$params);
        $stmt->execute();
        $byProvince = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
        $stmt->close();
    } else {
        $byProvince = $db->query($sql3)->fetch_all(MYSQLI_ASSOC);
    }

    sendJSON(['success' => true, 'data' => ['status_counts' => $statusCounts, 'by_classroom' => $byClassroom, 'by_province' => $byProvince]]);
}

// ============================
// GET ALL TEACHERS (for admin assigning)
// ============================
if ($method === 'GET' && $action === 'get_teachers') {
    $teachers = $db->query("SELECT user_id, full_name, email FROM users WHERE role = 'teacher' AND is_active = 1 ORDER BY full_name ASC")->fetch_all(MYSQLI_ASSOC);
    sendJSON(['success' => true, 'data' => $teachers]);
}

// ============================
// VIEW STUDENT DETAIL (teacher)
// ============================
if ($method === 'GET' && $action === 'view_student') {
    $studentId = $_GET['student_id'] ?? '';
    if (!$studentId) sendJSON(['success' => false, 'message' => 'Missing student_id']);

    // Check teacher has access
    if ($session['role'] === 'teacher') {
        $stmt = $db->prepare("SELECT sp.classroom_id FROM student_profiles sp WHERE sp.user_id = ?");
        $stmt->bind_param('s', $studentId);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        $tcIds = $session['teacher_classrooms'] ?? [];
        if ($row && !in_array($row['classroom_id'], $tcIds)) {
            sendJSON(['success' => false, 'message' => 'ไม่มีสิทธิ์เข้าถึงข้อมูลนักศึกษานี้'], 403);
        }
    }

    $stmt = $db->prepare("SELECT sp.*, c.room_name, c.room_code, c.year_level, u.full_name, u.last_login
                           FROM student_profiles sp
                           LEFT JOIN classrooms c ON sp.classroom_id = c.id
                           LEFT JOIN users u ON sp.user_id = u.user_id
                           WHERE sp.user_id = ?");
    $stmt->bind_param('s', $studentId);
    $stmt->execute();
    $profile = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    $stmt = $db->prepare("SELECT * FROM student_friends WHERE user_id = ? ORDER BY sort_order ASC");
    $stmt->bind_param('s', $studentId);
    $stmt->execute();
    $friends = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    $stmt = $db->prepare("SELECT * FROM health_checkups WHERE user_id = ? ORDER BY academic_year ASC");
    $stmt->bind_param('s', $studentId);
    $stmt->execute();
    $checkups = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    sendJSON(['success' => true, 'data' => ['profile' => $profile, 'friends' => $friends, 'health_checkups' => $checkups]]);
}

// ============================
// SEARCH STUDENTS (for adding to room)
// ============================
if ($method === 'GET' && $action === 'search_students') {
    $search = trim($_GET['search'] ?? '');
    $excludeClassroom = intval($_GET['exclude_classroom'] ?? 0);
    $roomYearLevel = sanitize($_GET['room_year_level'] ?? '');

    if (strlen($search) < 1) {
        sendJSON(['success' => true, 'data' => []]);
    }

    $s = "%$search%";
    $params = [$s, $s, $s, $s];
    $types = 'ssss';
    $extraWhere = '';

    if ($excludeClassroom) {
        $extraWhere .= " AND (sp.classroom_id IS NULL OR sp.classroom_id != ?)";
        $params[] = $excludeClassroom;
        $types .= 'i';
    }

    if ($roomYearLevel) {
        $extraWhere .= " AND sp.year_level = ?";
        $params[] = $roomYearLevel;
        $types .= 's';
    }

    $sql = "SELECT u.user_id, u.full_name, sp.student_code, sp.prefix, sp.first_name_th, sp.last_name_th,
                   sp.gender, sp.classroom_id, sp.year_level, c.room_name
            FROM users u
            LEFT JOIN student_profiles sp ON u.user_id = sp.user_id
            LEFT JOIN classrooms c ON sp.classroom_id = c.id
            WHERE u.role = 'student' AND u.is_active = 1
              AND (sp.student_code LIKE ? OR sp.first_name_th LIKE ? OR sp.last_name_th LIKE ? OR u.full_name LIKE ?)
              $extraWhere
            ORDER BY sp.student_code ASC
            LIMIT 25";

    $stmt = $db->prepare($sql);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $students = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    sendJSON(['success' => true, 'data' => $students]);
}

// ============================
// DELETE ADVISORY ROOM
// ============================
if ($method === 'DELETE' && $action === 'delete_room') {
    $roomId = intval($_GET['room_id'] ?? 0);
    if (!$roomId) sendJSON(['success' => false, 'message' => 'ไม่พบ room_id']);

    if ($session['role'] === 'teacher') {
        $stmt = $db->prepare("SELECT id FROM teacher_classrooms WHERE classroom_id = ? AND teacher_id = ?");
        $stmt->bind_param('is', $roomId, $userId);
        $stmt->execute();
        if (!$stmt->get_result()->fetch_assoc()) {
            sendJSON(['success' => false, 'message' => 'ไม่มีสิทธิ์ลบห้องนี้'], 403);
        }
        $stmt->close();
    }

    $stmt = $db->prepare("DELETE FROM teacher_classrooms WHERE classroom_id = ? AND teacher_id = ?");
    $stmt->bind_param('is', $roomId, $userId);
    $stmt->execute();
    $stmt->close();

    // ถ้าไม่มีอาจารย์คนอื่นในห้องนี้แล้ว ให้ soft-delete classroom และ unassign นักศึกษา
    $stmt = $db->prepare("SELECT COUNT(*) as cnt FROM teacher_classrooms WHERE classroom_id = ?");
    $stmt->bind_param('i', $roomId);
    $stmt->execute();
    $remaining = $stmt->get_result()->fetch_assoc()['cnt'];
    $stmt->close();

    if ($remaining == 0) {
        $stmt = $db->prepare("UPDATE student_profiles SET classroom_id = NULL WHERE classroom_id = ?");
        $stmt->bind_param('i', $roomId);
        $stmt->execute(); $stmt->close();
        $stmt = $db->prepare("DELETE FROM classrooms WHERE id = ?");
        $stmt->bind_param('i', $roomId);
        $stmt->execute(); $stmt->close();
    }

    logActivity($userId, 'delete_advisory_room', 'classroom', $roomId, "ลบห้องที่ปรึกษา ID: $roomId");
    sendJSON(['success' => true, 'message' => 'ลบห้องที่ปรึกษาแล้ว']);
}

// ============================
// REMOVE STUDENT FROM ROOM
// ============================
if ($method === 'DELETE' && $action === 'delete_student') {
    $studentId = $_GET['user_id'] ?? '';
    if (!$studentId) sendJSON(['success' => false, 'message' => 'ไม่พบ user_id']);

    $stmt = $db->prepare("UPDATE student_profiles SET classroom_id = NULL WHERE user_id = ?");
    $stmt->bind_param('s', $studentId);
    $stmt->execute();
    $stmt->close();

    logActivity($userId, 'remove_student_from_room', 'student', $studentId, "ลบนักศึกษา $studentId ออกจากห้อง");
    sendJSON(['success' => true, 'message' => 'ลบนักศึกษาออกจากห้องแล้ว']);
}

sendJSON(['success' => false, 'message' => 'Invalid action'], 400);
