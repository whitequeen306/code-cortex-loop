/** Fake DB — SQL injection via string concat (security demo) */
async function query(sql) {
  return [{ id: 1, sql }];
}

module.exports = { query };
