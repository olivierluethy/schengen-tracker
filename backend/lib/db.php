<?php
declare(strict_types=1);

/**
 * PDO factory and migration runner.
 *
 * SQLite is the default. Point SCHENGEN_DB_DSN at MySQL to switch drivers —
 * every query in this codebase is portable ANSI SQL, and the two schema files
 * are 1:1 ports of each other.
 */
function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = getenv('SCHENGEN_DB_DSN') ?: 'sqlite:' . __DIR__ . '/../data/app.sqlite';
    $user = getenv('SCHENGEN_DB_USER') ?: null;
    $pass = getenv('SCHENGEN_DB_PASS') ?: null;

    if (str_starts_with($dsn, 'sqlite:')) {
        $path = substr($dsn, 7);
        $dir = dirname($path);
        if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
            fail('Cannot create the database directory', 500);
        }
    }

    try {
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (PDOException $e) {
        fail('Database unavailable', 500);
    }

    if ($pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') {
        $pdo->exec('PRAGMA foreign_keys = ON');
        $pdo->exec('PRAGMA journal_mode = WAL');
    }

    migrate($pdo);
    return $pdo;
}

function migrate(PDO $pdo): void
{
    $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
    $file = __DIR__ . '/../' . ($driver === 'mysql' ? 'schema.mysql.sql' : 'schema.sql');
    $sql = file_get_contents($file);
    if ($sql === false) {
        fail('Schema file missing', 500);
    }
    foreach (array_filter(array_map('trim', explode(';', $sql))) as $statement) {
        if ($statement !== '') {
            $pdo->exec($statement);
        }
    }
}

/**
 * Next monotonic cursor for a stays write.
 *
 * A server-side counter rather than a timestamp: clients set their own
 * `updated_at`, so a skewed client clock must never be able to hide a row from
 * another device's pull.
 */
function nextSeq(PDO $pdo): int
{
    $row = $pdo->query('SELECT COALESCE(MAX(seq), 0) + 1 AS n FROM stays')->fetch();
    return (int) $row['n'];
}
