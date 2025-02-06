////////////////////////////////////////////////////
// db/reports.js
////////////////////////////////////////////////////
import pool from "./index.js";
import { nanoid } from "nanoid";

/**
 * レポートテーブルにINSERT
 */
export async function createReport({
  company_id,
  line_user_id,
  report_json,
  s3_path = "",
  remarks = "",
}) {
  const reportId = nanoid(18);
  const query = `
    INSERT INTO reports
      (report_id, company_id, line_user_id, report_json, s3_path, remarks,
       created_at, updated_at)
    VALUES
      ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING *
  `;
  const values = [
    reportId,
    company_id,
    line_user_id,
    report_json,
    s3_path,
    remarks,
  ];
  const { rows } = await pool.query(query, values);
  return rows[0];
}
