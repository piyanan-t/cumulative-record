<?php
// =====================================================
// Database Configuration & Helper Functions
// =====================================================

define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'cumulative_db');

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

function getDB() {
    static $conn = null;
    if ($conn === null) {
        $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
        if ($conn->connect_error) {
            sendJSON(['success' => false, 'message' => 'Database connection failed: ' . $conn->connect_error], 500);
        }
        $conn->set_charset('utf8mb4');
        $conn->query("SET time_zone = '+07:00'");
    }
    return $conn;
}

function sendJSON($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function startSession() {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }
}

function checkAuth($roles = []) {
    startSession();
    if (!isset($_SESSION['user_id'])) {
        sendJSON(['success' => false, 'message' => 'Unauthorized: Please login', 'redirect' => '../index.html'], 401);
    }
    if (!empty($roles) && !in_array($_SESSION['role'], $roles)) {
        sendJSON(['success' => false, 'message' => 'Forbidden: Insufficient permissions'], 403);
    }
    return $_SESSION;
}

function logActivity($userId, $action, $entityType = null, $entityId = null, $details = null) {
    $db = getDB();
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $stmt = $db->prepare("INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->bind_param('ssssss', $userId, $action, $entityType, $entityId, $details, $ip);
    $stmt->execute();
    $stmt->close();
}

function getInput() {
    $input = json_decode(file_get_contents('php://input'), true);
    if ($input === null) {
        $input = $_POST;
    }
    return $input;
}

function sanitize($str) {
    if ($str === null) return null;
    return htmlspecialchars(strip_tags(trim($str)), ENT_QUOTES, 'UTF-8');
}
