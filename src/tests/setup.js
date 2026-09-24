const mysql = require('mysql2/promise');

const config = require('../config');

beforeAll(async () => {
  const connection = await mysql.createConnection({
    host: config.db.connection.host,
    user: config.db.connection.user,
    password: config.db.connection.password,
    connectTimeout: config.db.connection.connectTimeout,
  });

  await connection.query(`DROP DATABASE IF EXISTS pizza_test`);
  await connection.end();
})