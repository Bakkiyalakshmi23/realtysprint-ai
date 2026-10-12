const { pool } = require('../db/pool');

/**
 * Enqueues a job into the persistent background_jobs table.
 * @param {string} queueName - Name of the queue
 * @param {Object} payload - JSON payload for the job
 * @param {Object} options - { runAt: Date, maxAttempts: number, idempotencyKey: string }
 * @returns {Promise<string|null>} Job ID or null if duplicate idempotency key
 */
async function enqueue(queueName, payload, options = {}) {
  const { runAt = new Date(), maxAttempts = 3, idempotencyKey = null } = options;
  const client = await pool.connect();
  try {
    const res = await client.query(
      `INSERT INTO background_jobs (queue_name, payload, run_at, max_attempts, idempotency_key)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING id`,
      [queueName, JSON.stringify(payload), runAt, maxAttempts, idempotencyKey]
    );
    return res.rows[0] ? res.rows[0].id : null;
  } finally {
    client.release();
  }
}

/**
 * Dequeues a job using FOR UPDATE SKIP LOCKED.
 * Safe for concurrent workers.
 */
async function dequeue(queueName) {
  const client = await pool.connect();
  try {
    const res = await client.query(
      `UPDATE background_jobs
       SET status = 'running', locked_at = NOW(), attempts = attempts + 1
       WHERE id = (
         SELECT id FROM background_jobs
         WHERE queue_name = $1 AND status IN ('pending', 'failed') AND run_at <= NOW()
         ORDER BY run_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       RETURNING *`,
      [queueName]
    );
    return res.rows[0] || null;
  } finally {
    client.release();
  }
}

async function completeJob(jobId) {
  await pool.query(
    `UPDATE background_jobs SET status = 'completed', updated_at = NOW(), locked_at = NULL WHERE id = $1`,
    [jobId]
  );
}

async function failJob(jobId, errorMsg) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query('SELECT attempts, max_attempts FROM background_jobs WHERE id = $1 FOR UPDATE', [jobId]);
    if (!res.rows[0]) {
      await client.query('ROLLBACK');
      return;
    }
    const { attempts, max_attempts } = res.rows[0];

    if (attempts >= max_attempts) {
      await client.query(
        `UPDATE background_jobs SET status = 'dead', last_error = $2, updated_at = NOW(), locked_at = NULL WHERE id = $1`,
        [jobId, errorMsg]
      );
    } else {
      // Exponential backoff: 2^attempts seconds (fast backoff for tests)
      const backoffSeconds = Math.pow(2, attempts);
      await client.query(
        `UPDATE background_jobs
         SET status = 'failed', last_error = $2, run_at = NOW() + INTERVAL '1 second' * $3, updated_at = NOW(), locked_at = NULL
         WHERE id = $1`,
        [jobId, errorMsg, backoffSeconds]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Recovers jobs that have been stuck in 'running' state for too long (e.g., worker crashed).
 * @param {number} timeoutMs - Timeout in ms before a running job is considered stuck
 */
async function recoverStuckJobs(timeoutMs = 60000) {
  const res = await pool.query(`
    UPDATE background_jobs
    SET status = 'failed', last_error = 'Worker timeout / crashed', locked_at = NULL, updated_at = NOW()
    WHERE status = 'running' AND locked_at < NOW() - INTERVAL '1 millisecond' * $1
    RETURNING id
  `, [timeoutMs]);
  return res.rows.length;
}

/**
 * Starts a background worker loop for a specific queue.
 */
function processJobs(queueName, handler, pollIntervalMs = 1000) {
  let isProcessing = true;
  const workerPromise = (async () => {
    while (isProcessing) {
      let jobProcessed = false;
      try {
        const job = await dequeue(queueName);
        if (job) {
          jobProcessed = true;
          try {
            await handler(job);
            await completeJob(job.id);
          } catch (err) {
            await failJob(job.id, err.message || err.toString());
          }
        }
      } catch (err) {
        console.error(`[QueueWorker] Error in queue ${queueName}:`, err);
      }

      // If no job was processed or we are shutting down, sleep.
      // If we did process a job, immediately try to dequeue the next one.
      if (!jobProcessed && isProcessing) {
        await new Promise(r => setTimeout(r, pollIntervalMs));
      }
    }
  })();

  return {
    stop: () => { isProcessing = false; },
    promise: workerPromise
  };
}

module.exports = { enqueue, dequeue, completeJob, failJob, recoverStuckJobs, processJobs };
