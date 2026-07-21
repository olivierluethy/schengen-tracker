<?php
declare(strict_types=1);

const TOKEN_TTL_DAYS = 90;

function issueToken(PDO $pdo, string $userId): string
{
    $token = bin2hex(random_bytes(32));
    $expires = (new DateTimeImmutable('now', new DateTimeZone('UTC')))
        ->modify('+' . TOKEN_TTL_DAYS . ' days')
        ->format('Y-m-d\TH:i:s.v\Z');

    $stmt = $pdo->prepare(
        'INSERT INTO tokens (id, user_id, token_hash, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?)'
    );
    // Tokens are high-entropy random values, so a fast hash is correct here —
    // password_hash is for low-entropy secrets and would only slow every request.
    $stmt->execute([uuid(), $userId, hash('sha256', $token), isoNow(), $expires]);

    return $token;
}

function currentUser(PDO $pdo): ?array
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/^Bearer\s+([a-f0-9]{64})$/i', $header, $m)) {
        return null;
    }
    $stmt = $pdo->prepare(
        'SELECT u.* FROM tokens t
         JOIN users u ON u.id = t.user_id
         WHERE t.token_hash = ? AND t.expires_at > ?'
    );
    $stmt->execute([hash('sha256', $m[1]), isoNow()]);
    $user = $stmt->fetch();
    return $user === false ? null : $user;
}

function requireUser(PDO $pdo): array
{
    $user = currentUser($pdo);
    if ($user === null) {
        fail('Not signed in', 401);
    }
    return $user;
}

function publicUser(array $row): array
{
    return [
        'id' => $row['id'],
        'email' => $row['email'],
        'displayName' => $row['display_name'],
        'settings' => json_decode($row['settings'] ?: '{}', true),
    ];
}
