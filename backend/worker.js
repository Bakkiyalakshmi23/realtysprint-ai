const { executeTasks, recoverStaleTasks } = require('../agents/client-acquisition/capabilities');
const { pool } = require('./db/pool');

let isRunning = true;
let currentLoopPromise = null;

// Handle graceful shutdown
function shutdown() {
  console.log('\n[worker] Shutdown signal received. Finishing current execution cycle...');
  isRunning = false;
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('message', (msg) => {
  if (msg === 'shutdown') {
    shutdown();
  }
});

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function startWorker() {
  console.log('[worker] Starting local worker pilot loop...');
  let cycle = 0;

  while (isRunning) {
    cycle++;
    try {
      // 1. Recover stale tasks first
      const recoverRes = await recoverStaleTasks({ traceId: `worker-recover-${cycle}` });
      if (recoverRes.status === 'completed' && recoverRes.output && recoverRes.output.recoveredCount > 0) {
        console.log(`[worker] Recovered ${recoverRes.output.recoveredCount} stale task(s).`);
      }

      // 2. Execute pending or eligible retry tasks
      const executeRes = await executeTasks({ traceId: `worker-execute-${cycle}` });
      if (executeRes.status === 'failed') {
        console.error(`[worker] Task execution cycle failed:`, executeRes.error);
      } else if (executeRes.output && executeRes.output.executedCount > 0) {
        // We'll just rely on what executeTasks returns if we updated it, or we just log silently if idle.
        // executeTasks currently returns executedTasks or similar?
        // Let's just log silently if idle, or we can check executedTasks length if it was returned.
      }

    } catch (err) {
      console.error('[worker] Unexpected error in worker loop:', err);
    }

    // Sleep before next cycle
    if (isRunning) {
      await sleep(1000);
    }
  }

  console.log('[worker] Execution loop stopped cleanly.');
  // If run independently, we would call process.exit(0) but pool.end() might be better
  // to allow tests to spawn it and kill it cleanly.
}

// Support running directly from CLI: `node worker.js`
if (require.main === module) {
  startWorker().then(() => {
    pool.end();
    console.log('[worker] Database pool closed. Exiting.');
    process.exit(0);
  });
}

module.exports = { startWorker, shutdown };
