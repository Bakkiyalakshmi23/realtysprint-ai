const { pool } = require("./db/pool");

async function check() {
  const result = await pool.query(`
    SELECT pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conname = 'leads_status_check'
  `);

  console.log(result.rows);
  await pool.end();
}

check().catch(async error => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
