<?php
declare(strict_types=1);

/**
 * Front controller. Also serves as the router script for PHP's built-in server:
 *   php -S 127.0.0.1:8080 backend/index.php
 */

require __DIR__ . '/lib/json.php';
require __DIR__ . '/lib/db.php';
require __DIR__ . '/lib/auth.php';
require __DIR__ . '/lib/sharing.php';
require __DIR__ . '/api/auth.php';
require __DIR__ . '/api/sync.php';
require __DIR__ . '/api/partners.php';

cors();

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$path = '/' . trim($path, '/');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

set_exception_handler(static function (Throwable $e): void {
    error_log((string) $e);
    send(['error' => 'Server error'], 500);
});

$pdo = db();

if ($path === '/api/health' && $method === 'GET') {
    send(['ok' => true, 'driver' => $pdo->getAttribute(PDO::ATTR_DRIVER_NAME)]);
}

$routes = [
    'POST /api/auth/register' => fn() => handleRegister($pdo),
    'POST /api/auth/login'    => fn() => handleLogin($pdo),
    'POST /api/auth/logout'   => fn() => handleLogout($pdo),
    'GET /api/auth/me'        => fn() => handleMe($pdo),
    'POST /api/sync'          => fn() => handleSync($pdo),
    // Task 14: partner routes
];

$key = "$method $path";
if (isset($routes[$key])) {
    $routes[$key]();
}

// Task 14: handlePartnerTracking preg_match block

fail('Not found', 404);
