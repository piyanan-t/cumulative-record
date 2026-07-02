<?php
require_once 'config.php';
startSession();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJSON(['success' => false, 'message' => 'Method not allowed'], 405);
}

$input = getInput();
$userId = sanitize($input['user_id'] ?? '');
$password = $input['password'] ?? '';

if (empty($userId) || empty($password)) {
    sendJSON(['success' => false, 'message' => 'กรุณากรอกรหัสผู้ใช้และรหัสผ่าน']);
}

$db = getDB();
$stmt = $db->prepare("SELECT id, user_id, password, role, full_name, email, phone, is_active FROM users WHERE user_id = ?");
$stmt->bind_param('s', $userId);
$stmt->execute();
$result = $stmt->get_result();
$user = $result->fetch_assoc();
$stmt->close();

if (!$user) {
    sendJSON(['success' => false, 'message' => 'ไม่พบรหัสผู้ใช้นี้ในระบบ']);
}

if (!$user['is_active']) {
    sendJSON(['success' => false, 'message' => 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ']);
}

// Verify password (support plain text for demo, bcrypt for production)
$isValid = password_verify($password, $user['password']) || $password === $user['password'];

if (!$isValid) {
    sendJSON(['success' => false, 'message' => 'รหัสผ่านไม่ถูกต้อง']);
}

// Update last login
$db->query("UPDATE users SET last_login = NOW() WHERE user_id = '{$user['user_id']}'");

// Set session
$_SESSION['user_id'] = $user['user_id'];
$_SESSION['role'] = $user['role'];
$_SESSION['full_name'] = $user['full_name'];
$_SESSION['email'] = $user['email'];

// Get additional info for student
$extraData = [];
if ($user['role'] === 'student') {
    $stmt = $db->prepare("SELECT sp.*, c.room_name, c.year_level, c.room_code
                          FROM student_profiles sp
                          LEFT JOIN classrooms c ON sp.classroom_id = c.id
                          WHERE sp.user_id = ?");
    $stmt->bind_param('s', $user['user_id']);
    $stmt->execute();
    $profile = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if ($profile) {
        $extraData['student_code'] = $profile['student_code'];
        $extraData['classroom'] = $profile['room_name'];
        $extraData['year_level'] = $profile['year_level'];
        $extraData['form_status'] = $profile['form_status'];
        $_SESSION['student_code'] = $profile['student_code'];
        $_SESSION['classroom_id'] = $profile['classroom_id'];
    }
} elseif ($user['role'] === 'teacher') {
    $stmt = $db->prepare("SELECT c.id, c.room_name, c.room_code, c.year_level
                          FROM teacher_classrooms tc
                          JOIN classrooms c ON tc.classroom_id = c.id
                          WHERE tc.teacher_id = ?");
    $stmt->bind_param('s', $user['user_id']);
    $stmt->execute();
    $classrooms = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    $extraData['classrooms'] = $classrooms;
    $_SESSION['teacher_classrooms'] = array_column($classrooms, 'id');
}

logActivity($user['user_id'], 'login', 'auth', null, 'เข้าสู่ระบบสำเร็จ');

sendJSON([
    'success' => true,
    'message' => 'เข้าสู่ระบบสำเร็จ',
    'data' => array_merge([
        'user_id' => $user['user_id'],
        'role' => $user['role'],
        'full_name' => $user['full_name'],
        'email' => $user['email']
    ], $extraData)
]);
