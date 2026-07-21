<?php
declare(strict_types=1);

/**
 * Delta sync: push client changes, pull server changes.
 *
 * Conflict resolution is last-write-wins on the client-authored `updated_at`.
 * The PULL cursor is the server-side `seq` counter, NOT a timestamp: a client
 * with a skewed clock must not be able to write a row that other devices never
 * see. Deletes travel as tombstones (deleted = 1), never as row removal.
 */

function stayToJson(array $r): array
{
    return [
        'id' => $r['id'],
        'name' => $r['name'],
        'country' => $r['country'],
        'startDate' => $r['start_date'],
        'endDate' => $r['end_date'],
        'createdAt' => $r['created_at'],
        'updatedAt' => $r['updated_at'],
        'deleted' => (bool) (int) $r['deleted'],
        'ownerId' => $r['owner_id'],
    ];
}

function validStayPayload(array $s): bool
{
    $iso = '/^\d{4}-\d{2}-\d{2}$/';
    return is_string($s['id'] ?? null)
        && preg_match('/^[0-9a-f-]{36}$/i', $s['id']) === 1
        && is_string($s['name'] ?? null) && trim($s['name']) !== ''
        && preg_match($iso, (string) ($s['startDate'] ?? '')) === 1
        && preg_match($iso, (string) ($s['endDate'] ?? '')) === 1
        && (string) $s['endDate'] >= (string) $s['startDate']
        && is_string($s['updatedAt'] ?? null)
        && is_string($s['createdAt'] ?? null);
}

function handleSync(PDO $pdo): never
{
    $user = requireUser($pdo);
    $in = body();
    $lastSeq = isset($in['lastSeq']) ? (int) $in['lastSeq'] : 0;
    $changes = is_array($in['changes'] ?? null) ? $in['changes'] : [];

    if (count($changes) > 2000) {
        fail('Too many changes in one batch', 413);
    }

    $applied = 0;
    $skipped = 0;
    $rejected = [];

    $pdo->beginTransaction();
    try {
        $find = $pdo->prepare('SELECT updated_at FROM stays WHERE id = ? AND owner_id = ?');
        $insert = $pdo->prepare(
            'INSERT INTO stays (id, owner_id, name, country, start_date, end_date,
                                created_at, updated_at, deleted, seq)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $update = $pdo->prepare(
            'UPDATE stays SET name = ?, country = ?, start_date = ?, end_date = ?,
                              updated_at = ?, deleted = ?, seq = ?
             WHERE id = ? AND owner_id = ?'
        );

        foreach ($changes as $s) {
            if (!is_array($s) || !validStayPayload($s)) {
                $rejected[] = is_array($s) ? ($s['id'] ?? null) : null;
                continue;
            }

            $find->execute([$s['id'], $user['id']]);
            $existing = $find->fetchColumn();

            // Last-write-wins. Equal timestamps are a no-op, keeping sync idempotent.
            if ($existing !== false && (string) $existing >= (string) $s['updatedAt']) {
                $skipped++;
                continue;
            }

            $seq = nextSeq($pdo);
            $deleted = !empty($s['deleted']) ? 1 : 0;

            if ($existing === false) {
                $insert->execute([
                    $s['id'], $user['id'], trim($s['name']), $s['country'] ?? null,
                    $s['startDate'], $s['endDate'], $s['createdAt'], $s['updatedAt'],
                    $deleted, $seq,
                ]);
            } else {
                $update->execute([
                    trim($s['name']), $s['country'] ?? null, $s['startDate'], $s['endDate'],
                    $s['updatedAt'], $deleted, $seq, $s['id'], $user['id'],
                ]);
            }
            $applied++;
        }

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    $pull = $pdo->prepare('SELECT * FROM stays WHERE owner_id = ? AND seq > ? ORDER BY seq ASC');
    $pull->execute([$user['id'], $lastSeq]);
    $rows = $pull->fetchAll();

    $cursor = $pdo->prepare('SELECT COALESCE(MAX(seq), 0) AS n FROM stays WHERE owner_id = ?');
    $cursor->execute([$user['id']]);

    send([
        'serverSeq' => (int) $cursor->fetch()['n'],
        'changes' => array_map('stayToJson', $rows),
        'applied' => $applied,
        'skipped' => $skipped,
        'rejected' => array_values(array_filter($rejected)),
    ]);
}
