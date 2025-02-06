/////////////////////////////////////////////
// db/companies.js
/////////////////////////////////////////////
import pool from "./index.js";

/**
 * シンプルに company_idで1レコード取得
 */
export async function getCompanyById(companyId) {
  const query = `
    SELECT *
      FROM companies
     WHERE company_id = $1
     LIMIT 1
  `;
  const { rows } = await pool.query(query, [companyId]);
  return rows[0] || null;
}

/**
 * createCompany (手動登録用)
 */
export async function createCompany({
  company_id,
  company_name,
  email_address,
  remarks = "",
}) {
  const query = `
    INSERT INTO companies
      (company_id, company_name, remarks, created_at, updated_at)
    VALUES
      ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING *
  `;
  const { rows } = await pool.query(query, [company_id, company_name, remarks]);
  return rows[0];
}
