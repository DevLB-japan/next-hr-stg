////////////////////////////////////////////////////
// db/lineUsers.js
////////////////////////////////////////////////////
import pool from "./index.js";
import { nanoid } from "nanoid";

/**
 * DB: line_users
 *
 * Assumes table structure something like:
 *  line_users(
 *    line_user_id char(18) PK,
 *    company_id   char(18),
 *    user_id      text,            // actual LINE userId
 *    conversation_id text,         // Dify conversationId
 *    remarks text,
 *    created_at timestamp,
 *    updated_at timestamp
 *  )
 */

/**
 * GET or CREATE line_user by (company_id, user_id)
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
 * CREATE a new line_users record
 */
export async function createLineUser(companyId, userId, remarks = "") {
  const lineUserId = nanoid(18);
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
 * GET line_users by conversation_id
 *
 * Used for the scenario where Dify's conversation_id is stored in line_users.conversation_id
 */
export async function getLineUserByConversation(convId) {
  const query = `
    SELECT *
      FROM line_users
     WHERE conversation_id = $1
     LIMIT 1
  `;
  const values = [convId];

  try {
    const { rows } = await pool.query(query, values);
    return rows[0] || null;
  } catch (err) {
    console.error("Error in getLineUserByConversation:", err);
    throw err;
  }
}
