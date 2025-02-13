////////////////////////////////////////////////////
// db/index.js
////////////////////////////////////////////////////
import dotenv from "dotenv";
dotenv.config();

import pkg from "pg";
const { Pool } = pkg; // ← CommonJSモジュール 'pg' から Pool を取得

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
  // ssl: { rejectUnauthorized: false } // if needed
});

export default pool;
