<?php
declare(strict_types=1);

function handleRegister(PDO $pdo): never
{
    $in = body();
    $email = strtolower(trim((string) ($in['email'] ?? '')));
    $password = (string) ($in['password'] ?? '');
    $displayName = trim((string) ($in['displayName'] ?? ''));

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        fail('Enter a valid email address', 422, ['field' => 'email']);
    }
    if (strlen($password) < 8) {
        fail('Password must be at least 8 characters', 422, ['field' => 'password']);
    }

    $exists = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $exists->execute([$email]);
    if ($exists->fetch() !== false) {
        fail('An account with that email already exists', 409, ['field' => 'email']);
    }

    $id = uuid();
    $ts = isoNow();
    $stmt = $pdo->prepare(
        'INSERT INTO users (id, email, password_hash, display_name, settings, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $id, $email, password_hash($password, PASSWORD_DEFAULT),
        $displayName ?: null, json_encode(['defaultSharingLevel' => 'graph_only']), $ts, $ts,
    ]);

    // A pending invite addressed to this email is bound to the new account.
    $claim = $pdo->prepare(
        'UPDATE partnerships SET to_user_id = ?, updated_at = ? WHERE to_email = ? AND to_user_id IS NULL'
    );
    $claim->execute([$id, $ts, $email]);

    $user = $pdo->prepare('SELECT * FROM users WHERE id = ?');
    $user->execute([$id]);

    send(['token' => issueToken($pdo, $id), 'user' => publicUser($user->fetch())], 201);
}

function handleLogin(PDO $pdo): never
{
    $in = body();
    $email = strtolower(trim((string) ($in['email'] ?? '')));
    $password = (string) ($in['password'] ?? '');

    $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    // One message for both cases: never reveal whether an email is registered.
    if ($user === false || !password_verify($password, $user['password_hash'])) {
        fail('Email or password is incorrect', 401);
    }

    send(['token' => issueToken($pdo, $user['id']), 'user' => publicUser($user)]);
}

function handleLogout(PDO $pdo): never
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/^Bearer\s+([a-f0-9]{64})$/i', $header, $m)) {
        $stmt = $pdo->prepare('DELETE FROM tokens WHERE token_hash = ?');
        $stmt->execute([hash('sha256', $m[1])]);
    }
    send(['ok' => true]);
}

function handleMe(PDO $pdo): never
{
    send(['user' => publicUser(requireUser($pdo))]);
}
