<?php
declare(strict_types=1);

const SHARING_LEVELS = ['graph_only', 'full'];

function partnershipToJson(array $r, string $viewerId): array
{
    return [
        'id' => $r['id'],
        'direction' => $r['from_user_id'] === $viewerId ? 'outgoing' : 'incoming',
        'fromUserId' => $r['from_user_id'],
        // The invitee needs a label for the sharer. Populated by the JOIN in
        // handleListPartners; absent (null) elsewhere, which the UI tolerates.
        'fromEmail' => $r['from_email'] ?? null,
        'toEmail' => $r['to_email'],
        'toUserId' => $r['to_user_id'],
        'status' => $r['status'],
        'sharingLevel' => $r['sharing_level'],
        'createdAt' => $r['created_at'],
        'updatedAt' => $r['updated_at'],
    ];
}

function handleInvite(PDO $pdo): never
{
    $user = requireUser($pdo);
    $in = body();
    $email = strtolower(trim((string) ($in['email'] ?? '')));
    $level = (string) ($in['sharingLevel'] ?? 'graph_only');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        fail('Enter a valid email address', 422, ['field' => 'email']);
    }
    if ($email === strtolower($user['email'])) {
        fail('You cannot invite yourself', 422, ['field' => 'email']);
    }
    if (!in_array($level, SHARING_LEVELS, true)) {
        fail('Unknown sharing level', 422, ['field' => 'sharingLevel']);
    }

    $dupe = $pdo->prepare(
        "SELECT id FROM partnerships
         WHERE from_user_id = ? AND to_email = ? AND status IN ('pending','accepted')"
    );
    $dupe->execute([$user['id'], $email]);
    if ($dupe->fetch() !== false) {
        fail('You have already invited that person', 409);
    }

    // Bind immediately if they already have an account, so acceptance can find it.
    $target = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $target->execute([$email]);
    $toUserId = $target->fetchColumn() ?: null;

    $id = uuid();
    $ts = isoNow();
    $stmt = $pdo->prepare(
        'INSERT INTO partnerships
         (id, from_user_id, to_email, to_user_id, status, sharing_level, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([$id, $user['id'], $email, $toUserId ?: null, 'pending', $level, $ts, $ts]);

    $row = $pdo->prepare('SELECT * FROM partnerships WHERE id = ?');
    $row->execute([$id]);
    send(['partnership' => partnershipToJson($row->fetch(), $user['id'])], 201);
}

function handleRespond(PDO $pdo): never
{
    $user = requireUser($pdo);
    $in = body();
    $id = (string) ($in['id'] ?? '');
    $accept = (bool) ($in['accept'] ?? false);

    // Only the invitee may respond, matched by bound id OR by email address.
    $stmt = $pdo->prepare(
        'SELECT * FROM partnerships WHERE id = ? AND (to_user_id = ? OR to_email = ?)'
    );
    $stmt->execute([$id, $user['id'], strtolower($user['email'])]);
    $p = $stmt->fetch();
    if ($p === false) {
        fail('Invite not found', 404);
    }
    if ($p['status'] !== 'pending') {
        fail('That invite has already been answered', 409);
    }

    $upd = $pdo->prepare(
        'UPDATE partnerships SET status = ?, to_user_id = ?, updated_at = ? WHERE id = ?'
    );
    $upd->execute([$accept ? 'accepted' : 'declined', $user['id'], isoNow(), $id]);

    $row = $pdo->prepare('SELECT * FROM partnerships WHERE id = ?');
    $row->execute([$id]);
    send(['partnership' => partnershipToJson($row->fetch(), $user['id'])]);
}

function handleRevoke(PDO $pdo): never
{
    $user = requireUser($pdo);
    $id = (string) (body()['id'] ?? '');

    // Either side can end the arrangement at any time.
    $stmt = $pdo->prepare(
        'UPDATE partnerships SET status = ?, updated_at = ?
         WHERE id = ? AND (from_user_id = ? OR to_user_id = ?)'
    );
    $stmt->execute(['revoked', isoNow(), $id, $user['id'], $user['id']]);
    if ($stmt->rowCount() === 0) {
        fail('Partnership not found', 404);
    }
    send(['ok' => true]);
}

/** The SHARER controls visibility — only from_user_id may change the level. */
function handleSetSharing(PDO $pdo): never
{
    $user = requireUser($pdo);
    $in = body();
    $id = (string) ($in['id'] ?? '');
    $level = (string) ($in['sharingLevel'] ?? '');

    if (!in_array($level, SHARING_LEVELS, true)) {
        fail('Unknown sharing level', 422, ['field' => 'sharingLevel']);
    }

    $stmt = $pdo->prepare(
        'UPDATE partnerships SET sharing_level = ?, updated_at = ? WHERE id = ? AND from_user_id = ?'
    );
    $stmt->execute([$level, isoNow(), $id, $user['id']]);
    if ($stmt->rowCount() === 0) {
        fail('Partnership not found', 404);
    }

    $row = $pdo->prepare('SELECT * FROM partnerships WHERE id = ?');
    $row->execute([$id]);
    send(['partnership' => partnershipToJson($row->fetch(), $user['id'])]);
}

function handleListPartners(PDO $pdo): never
{
    $user = requireUser($pdo);

    $out = $pdo->prepare("SELECT * FROM partnerships WHERE from_user_id = ? AND status != 'revoked'");
    $out->execute([$user['id']]);

    // Join the sharer's email so the invitee has something to display. This is
    // the sharer's own identity, not their trip data — no privacy level applies.
    $inc = $pdo->prepare(
        "SELECT p.*, u.email AS from_email
         FROM partnerships p
         JOIN users u ON u.id = p.from_user_id
         WHERE (p.to_user_id = ? OR p.to_email = ?) AND p.status != 'revoked'"
    );
    $inc->execute([$user['id'], strtolower($user['email'])]);

    send([
        'outgoing' => array_map(fn($r) => partnershipToJson($r, $user['id']), $out->fetchAll()),
        'incoming' => array_map(fn($r) => partnershipToJson($r, $user['id']), $inc->fetchAll()),
    ]);
}

/**
 * A partner's tracking data, filtered to the level THEY chose.
 *
 * The requester is the invitee; the data belongs to `from_user_id`. The level
 * is read from the stored partnership, never from the request — a client
 * cannot ask for more than it was granted.
 */
function handlePartnerTracking(PDO $pdo, string $id): never
{
    $user = requireUser($pdo);

    $stmt = $pdo->prepare(
        "SELECT * FROM partnerships
         WHERE id = ? AND status = 'accepted' AND (to_user_id = ? OR to_email = ?)"
    );
    $stmt->execute([$id, $user['id'], strtolower($user['email'])]);
    $p = $stmt->fetch();
    if ($p === false) {
        fail('Not shared with you', 403);
    }

    send(['tracking' => trackingPayload($pdo, $p['from_user_id'], $p['sharing_level'])]);
}
