////////////////////////////////////////////////////
// db/lineApiKeys.js
////////////////////////////////////////////////////
import pool from "./index.js";
import { nanoid } from "nanoid";

/**
 * line_channel_id からレコード取得
 */
export async function getLineApiKeyByChannelId(channelId) {
  const query = `
    SELECT *
      FROM line_api_keys
     WHERE line_channel_id = $1
     LIMIT 1
  `;
  const { rows } = await pool.query(query, [channelId]);
  return rows[0] || null;
}

/**
 * 企業ごとのAPIキーを登録
 */
export async function createLineApiKey({
  company_id,
  line_channel_id,
  dify_api_url,
  dify_api_key,
  line_channel_access_token,
  line_channel_secret,
  remarks = "",
}) {
  const lineApiKeyId = nanoid(18);

  const query = `
    INSERT INTO line_api_keys
      (line_api_key_id, company_id, line_channel_id,
       dify_api_url, dify_api_key, line_channel_access_token, line_channel_secret,
       remarks, created_at, updated_at)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING *
  `;
  const values = [
    lineApiKeyId,
    company_id,
    line_channel_id,
    dify_api_url,
    dify_api_key,
    line_channel_access_token,
    line_channel_secret,
    remarks,
  ];
  const { rows } = await pool.query(query, values);
  return rows[0];
}
