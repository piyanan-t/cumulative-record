<?php
require_once 'config.php';
$session = checkAuth(['admin']);
$userId  = $session['user_id'];
$db      = getDB();

$input     = getInput() ?? [];
$targetIds = $input['user_ids'] ?? [];

if (empty($targetIds)) {
    sendJSON(['success' => false, 'message' => 'ไม่มีรายการที่เลือก']);
}

$deleted = 0;
$skipped = 0;

foreach ($targetIds as $tid) {
    $tid = sanitize($tid);
    if (!$tid || $tid === $userId) { $skipped++; continue; }

    $s = $db->prepare("DELETE FROM student_profiles WHERE user_id = ?");
    if ($s) { $s->bind_param('s', $tid); $s->execute(); $s->close(); }

    $s = $db->prepare("DELETE FROM teacher_classrooms WHERE teacher_id = ?");
    if ($s) { $s->bind_param('s', $tid); $s->execute(); $s->close(); }

    $stmt = $db->prepare("DELETE FROM users WHERE user_id = ?");
    if ($stmt) {
        $stmt->bind_param('s', $tid);
        $stmt->execute();
        if ($stmt->affected_rows > 0) $deleted++;
        $stmt->close();
    }
}

logActivity($userId, 'bulk_remove_users', 'user', null, "ลบผู้ใช้จำนวน $deleted คนออกจากระบบถาวร");
$msg = "ลบสำเร็จ $deleted คน" . ($skipped ? " (ข้าม $skipped คน)" : '');
sendJSON(['success' => $deleted > 0 || $skipped > 0, 'message' => $msg]);
