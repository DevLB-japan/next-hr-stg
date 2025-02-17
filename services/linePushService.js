/**
 * pushMessageToUser:
 *   - userId ( = lineUserRow.user_id ) へ push
 */

export async function pushMessageToUser(lineClient, userId, text) {
  try {
    await lineClient.pushMessage(userId, {
      type: "text",
      text,
    });
    console.log(`[pushMessageToUser] success. userId=${userId}, text=${text}`);
  } catch (e) {
    console.error("[pushMessageToUser] error:", e);
  }
}
