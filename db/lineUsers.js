////////////////////////////////////////////////////
// /db/lineUsers.js
////////////////////////////////////////////////////
import pool from "./index.js";
import { nanoid } from "nanoid";

/**
 * GET or CREATE line_users row by (company_id, user_id)
 * user_id = 実際のLINE userId
 */
export async function getOrCreateLineUser(companyId, userId) {
  let row = await getLineUserByCompanyAndUserId(companyId, userId);
  if (!row) {
    row = await createLineUser(companyId, userId);
  }
  return row;
}

/**
 * SELECT by (company_id, user_id)
 */
export async function getLineUserByCompanyAndUserId(companyId, userId) {
  const query = `
    SELECT *
      FROM line_users
     WHERE company_id = $1
       AND user_id = $2
     LIMIT 1
  `;
  const values = [companyId, userId];
  try {
    const { rows } = await pool.query(query, values);
    return rows[0] || null;
  } catch (err) {
    console.error("Error in getLineUserByCompanyAndUserId:", err);
    throw err;
  }
}

/**
 * CREATE a new line_users record with random line_user_id (CHAR(18))
 */
export async function createLineUser(companyId, userId, remarks = "") {
  const lineUserId = nanoid(18); // PK in line_users
  const query = `
    INSERT INTO line_users
      (line_user_id, company_id, user_id, conversation_id, remarks,
       created_at, updated_at)
    VALUES
      ($1, $2, $3, NULL, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING *
  `;
  const values = [lineUserId, companyId, userId, remarks];

  try {
    const { rows } = await pool.query(query, values);
    return rows[0];
  } catch (err) {
    console.error("Error in createLineUser:", err);
    throw err;
  }
}

/**
 * conversation_id を更新
 * (line_user_idを PK で取得)
 */
export async function updateLineUserConversation(lineUserId, conversationId) {
  const query = `
    UPDATE line_users
       SET conversation_id = $2,
           updated_at = CURRENT_TIMESTAMP
     WHERE line_user_id = $1
    RETURNING *
  `;
  const values = [lineUserId, conversationId];

  try {
    const { rows } = await pool.query(query, values);
    return rows[0] || null;
  } catch (err) {
    console.error("Error in updateLineUserConversation:", err);
    throw err;
  }
}

/**
 * SELECT by line_user_id (PK)
 */
export async function getLineUserById(lineUserId) {
  const query = `
    SELECT *
      FROM line_users
     WHERE line_user_id = $1
     LIMIT 1
  `;
  try {
    const { rows } = await pool.query(query, [lineUserId]);
    return rows[0] || null;
  } catch (err) {
    console.error("Error in getLineUserById:", err);
    throw err;
  }
}
