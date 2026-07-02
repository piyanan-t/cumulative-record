<?php
require_once 'config.php';
startSession();

if (isset($_SESSION['user_id'])) {
    logActivity($_SESSION['user_id'], 'logout', 'auth', null, 'ออกจากระบบ');
}

session_destroy();
sendJSON(['success' => true, 'message' => 'ออกจากระบบสำเร็จ']);
