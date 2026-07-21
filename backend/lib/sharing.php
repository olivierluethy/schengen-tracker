<?php
declare(strict_types=1);

/**
 * The 90/180 rule, server side.
 *
 * A deliberate re-implementation of src/engine/schengen.js: the server must be
 * able to compute a partner's curve WITHOUT ever handing the requester the
 * underlying stays. Keep the two in step — the constants and the inclusive
 * window semantics are the contract.
 */

const WINDOW_DAYS = 180;
const LIMIT_DAYS = 90;

/** @return array<string,bool> every ISO day of presence, deduplicated */
function presenceSet(array $stays): array
{
    $present = [];
    foreach ($stays as $s) {
        if ((int) $s['deleted'] === 1) {
            continue;
        }
        $cursor = new DateTimeImmutable($s['start_date'] . ' 12:00:00', new DateTimeZone('UTC'));
        $end = new DateTimeImmutable($s['end_date'] . ' 12:00:00', new DateTimeZone('UTC'));
        // Inclusive of both the entry and the exit day.
        while ($cursor <= $end) {
            $present[$cursor->format('Y-m-d')] = true;
            $cursor = $cursor->modify('+1 day');
        }
    }
    return $present;
}

/**
 * Daily rolling usage across [$from, $to].
 * @return list<array{date:string,used:int,remaining:int}>
 */
function usageCurve(array $stays, string $from, string $to): array
{
    $present = presenceSet($stays);
    $tz = new DateTimeZone('UTC');
    $cursor = new DateTimeImmutable($from . ' 12:00:00', $tz);
    $end = new DateTimeImmutable($to . ' 12:00:00', $tz);

    $curve = [];
    while ($cursor <= $end) {
        $windowStart = $cursor->modify('-' . (WINDOW_DAYS - 1) . ' days')->format('Y-m-d');
        $day = $cursor->format('Y-m-d');
        $used = 0;
        foreach (array_keys($present) as $d) {
            if ($d >= $windowStart && $d <= $day) {
                $used++;
            }
        }
        $curve[] = [
            'date' => $day,
            'used' => $used,
            'remaining' => max(0, LIMIT_DAYS - $used),
        ];
        $cursor = $cursor->modify('+1 day');
    }
    return $curve;
}

/**
 * Build the response payload for a partnership.
 *
 * `graph_only` returns numbers and dates only. Names, countries and individual
 * stay records are never placed in the array, so there is nothing for a client
 * to leak, hide or reconstruct from labels.
 */
function trackingPayload(PDO $pdo, string $ownerId, string $sharingLevel): array
{
    $today = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d');
    $from = (new DateTimeImmutable($today, new DateTimeZone('UTC')))->modify('-180 days')->format('Y-m-d');
    $to = (new DateTimeImmutable($today, new DateTimeZone('UTC')))->modify('+365 days')->format('Y-m-d');

    $stmt = $pdo->prepare('SELECT * FROM stays WHERE owner_id = ? AND deleted = 0');
    $stmt->execute([$ownerId]);
    $stays = $stmt->fetchAll();

    $payload = [
        'sharingLevel' => $sharingLevel,
        'from' => $from,
        'to' => $to,
        'today' => $today,
        'curve' => usageCurve($stays, $from, $to),
    ];

    if ($sharingLevel === 'full') {
        $payload['stays'] = array_map('stayToJson', $stays);
    }

    return $payload;
}
