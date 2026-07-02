<?php
require_once 'config.php';
$session = checkAuth(['student', 'admin']);
$userId = $session['user_id'];
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

$db = getDB();

// ============================
// GET PROFILE / FORM DATA
// ============================
if ($method === 'GET' && $action === 'get_profile') {
    $targetId = $_GET['user_id'] ?? $userId;
    if ($session['role'] !== 'admin' && $targetId !== $userId) {
        sendJSON(['success' => false, 'message' => 'Permission denied'], 403);
    }

    $stmt = $db->prepare("SELECT sp.*, c.room_name, c.room_code, c.year_level, c.academic_year, c.semester as class_semester,
                           u.full_name, u.email as user_email, u.phone as user_phone
                           FROM student_profiles sp
                           LEFT JOIN classrooms c ON sp.classroom_id = c.id
                           LEFT JOIN users u ON sp.user_id = u.user_id
                           WHERE sp.user_id = ?");
    $stmt->bind_param('s', $targetId);
    $stmt->execute();
    $profile = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$profile) {
        sendJSON(['success' => false, 'message' => 'ไม่พบข้อมูลนักศึกษา']);
    }

    // Get friends
    $stmt = $db->prepare("SELECT * FROM student_friends WHERE user_id = ? ORDER BY sort_order ASC");
    $stmt->bind_param('s', $targetId);
    $stmt->execute();
    $friends = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    // Get health checkups
    $stmt = $db->prepare("SELECT * FROM health_checkups WHERE user_id = ? ORDER BY academic_year ASC, semester ASC");
    $stmt->bind_param('s', $targetId);
    $stmt->execute();
    $checkups = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    // Unread notifications
    $stmt = $db->prepare("SELECT COUNT(*) as cnt FROM notifications WHERE recipient_id = ? AND is_read = 0");
    $stmt->bind_param('s', $targetId);
    $stmt->execute();
    $notifCount = $stmt->get_result()->fetch_assoc()['cnt'];
    $stmt->close();

    sendJSON([
        'success' => true,
        'data' => [
            'profile' => $profile,
            'friends' => $friends,
            'health_checkups' => $checkups,
            'unread_notifications' => $notifCount
        ]
    ]);
}

// ============================
// SAVE FORM DATA
// ============================
if ($method === 'POST' && $action === 'save_profile') {
    $input = getInput();
    $targetId = $input['user_id'] ?? $userId;
    if ($session['role'] !== 'admin' && $targetId !== $userId) {
        sendJSON(['success' => false, 'message' => 'Permission denied'], 403);
    }

    $fields = [
        'prefix','first_name_th','last_name_th','first_name_en','last_name_en','nickname',
        'gender','date_of_birth','race','nationality','religion','blood_type','id_card_number',
        'address_no','village_no','alley','road','subdistrict','district','province','postal_code',
        'phone','email',
        'siblings_same_both','siblings_younger_same_both','siblings_diff_father','siblings_younger_diff',
        'father_name','father_alive','father_deceased_when','father_occupation','father_workplace',
        'father_income','father_education','father_address','father_phone','father_email','father_other',
        'mother_name','mother_alive','mother_deceased_when','mother_occupation','mother_workplace',
        'mother_income','mother_education','mother_address','mother_phone','mother_email','mother_other',
        'parent_status','parent_status_detail',
        'current_address','current_phone','current_email','address_type','nearby_place','living_with','living_relation',
        'guardian_name','guardian_occupation','guardian_workplace','guardian_education',
        'guardian_address','guardian_phone','guardian_email',
        'counselor_name','counselor_relation','counselor_address','counselor_postal','counselor_phone',
        'chronic_disease','past_disease','allergy','surgery_history',
        'vision_condition','hearing_condition','dental_condition','mental_behavior',
        'special_abilities','route_map','student_code_pvs'
    ];

    $updates = [];
    $params = [];
    $types = '';

    foreach ($fields as $field) {
        if (isset($input[$field])) {
            $updates[] = "`$field` = ?";
            $params[] = $input[$field];
            $types .= (in_array($field, ['siblings_same_both','siblings_younger_same_both','siblings_diff_father','siblings_younger_diff'])) ? 'i' : 's';
        }
    }

    // Handle form_status
    $status = $input['form_status'] ?? 'not_started';
    $updates[] = '`form_status` = ?';
    $params[] = $status;
    $types .= 's';

    if ($status === 'submitted') {
        $updates[] = '`form_submitted_at` = NOW()';
    }

    $params[] = $targetId;
    $types .= 's';

    $sql = "UPDATE student_profiles SET " . implode(', ', $updates) . " WHERE user_id = ?";
    $stmt = $db->prepare($sql);
    $stmt->bind_param($types, ...$params);
    $stmt->execute();
    $stmt->close();

    // Save friends
    if (isset($input['friends']) && is_array($input['friends'])) {
        $db->query("DELETE FROM student_friends WHERE user_id = '$targetId'");
        $stmt = $db->prepare("INSERT INTO student_friends (user_id, friend_name, friend_school, friend_phone, sort_order) VALUES (?,?,?,?,?)");
        foreach ($input['friends'] as $i => $friend) {
            $name = $friend['friend_name'] ?? '';
            $school = $friend['friend_school'] ?? '';
            $phone = $friend['friend_phone'] ?? '';
            $order = $i;
            if (!empty($name)) {
                $stmt->bind_param('ssssi', $targetId, $name, $school, $phone, $order);
                $stmt->execute();
            }
        }
        $stmt->close();
    }

    // Save health checkups
    if (isset($input['health_checkups']) && is_array($input['health_checkups'])) {
        $db->query("DELETE FROM health_checkups WHERE user_id = '$targetId'");
        $stmt = $db->prepare("INSERT INTO health_checkups (user_id, academic_year, semester, checkup_date, height, weight, vision_left, vision_right, blood_pressure, notes) VALUES (?,?,?,?,?,?,?,?,?,?)");
        foreach ($input['health_checkups'] as $checkup) {
            $ay = $checkup['academic_year'] ?? '';
            $sem = $checkup['semester'] ?? 1;
            $date = $checkup['checkup_date'] ?? null;
            $h = $checkup['height'] ?? null;
            $w = $checkup['weight'] ?? null;
            $vl = $checkup['vision_left'] ?? '';
            $vr = $checkup['vision_right'] ?? '';
            $bp = $checkup['blood_pressure'] ?? '';
            $notes = $checkup['notes'] ?? '';
            $stmt->bind_param('sissddssss', $targetId, $ay, $sem, $date, $h, $w, $vl, $vr, $bp, $notes);
            $stmt->execute();
        }
        $stmt->close();
    }

    logActivity($targetId, 'submit_form', 'record', null, "ส่งระเบียนสะสม สถานะ: $status");

    sendJSON(['success' => true, 'message' => $status === 'submitted' ? 'ส่งระเบียนสะสมสำเร็จ!' : 'บันทึกข้อมูลสำเร็จ!']);
}

// ============================
// GET NOTIFICATIONS
// ============================
if ($method === 'GET' && $action === 'get_notifications') {
    $stmt = $db->prepare("SELECT n.*, u.full_name as sender_name FROM notifications n
                           LEFT JOIN users u ON n.sender_id = u.user_id
                           WHERE n.recipient_id = ? ORDER BY n.created_at DESC LIMIT 20");
    $stmt->bind_param('s', $userId);
    $stmt->execute();
    $notifications = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    // Mark as read
    $db->query("UPDATE notifications SET is_read = 1 WHERE recipient_id = '$userId'");

    sendJSON(['success' => true, 'data' => $notifications]);
}

// ============================
// CHECK SESSION
// ============================
if ($method === 'GET' && $action === 'check_session') {
    sendJSON(['success' => true, 'data' => [
        'user_id' => $session['user_id'],
        'role' => $session['role'],
        'full_name' => $session['full_name']
    ]]);
}

sendJSON(['success' => false, 'message' => 'Invalid action'], 400);
