/////////////////////////////////////////////////////////////
// controllers/lineWebhookController.js
/////////////////////////////////////////////////////////////
import fetch from "node-fetch";
import { AbortController } from "abort-controller";
import { Client } from "@line/bot-sdk";

import { getLineApiKeyByChannelId } from "../db/lineApiKeys.js";
import {
  getOrCreateLineUser,
  updateLineUserConversation,
} from "../db/lineUsers.js";

/**
 * handleLineWebhook:
 *   - Receives LINE events
 *   - Calls Dify with the existing or new conversation_id
 *   - Updates DB with the latest conversation_id
 *   - Replies to user
 */
export async function handleLineWebhook(req, res) {
  try {
    const destination = req.body?.destination;
    const events = req.body?.events;

    if (!events || events.length === 0) {
      console.log("[handleLineWebhook] No events => 200 OK");
      return res.status(200).send("No events");
    }

    // 1) DB: line_api_keys  (destination => channel_id)
    let lineApiKeyRow = null;
    if (destination) {
      lineApiKeyRow = await getLineApiKeyByChannelId(destination);
    }
    if (!lineApiKeyRow) {
      console.warn(
        `[handleLineWebhook] No lineApiKeys found for destination=${destination}`
      );
      // 200 で終了: LINE には失敗を返したくない
      return res.status(200).send("No lineApiKeys found");
    }

    // 2) create LINE client
    const lineClient = new Client({
      channelAccessToken: lineApiKeyRow.line_channel_access_token,
      channelSecret: lineApiKeyRow.line_channel_secret,
    });

    // 3) process events
    for (const event of events) {
      console.log(
        "[handleLineWebhook] eventType=",
        event.type,
        "messageType=",
        event?.message?.type
      );

      if (event.type === "message" && event.message.type === "text") {
        const userId = event.source.userId;
        const userMessage = event.message.text;
        console.log(
          "[handleLineWebhook] userId=",
          userId,
          " userMessage=",
          userMessage
        );

        // line_users
        const lineUserRow = await getOrCreateLineUser(
          lineApiKeyRow.company_id,
          userId
        );
        console.log("[handleLineWebhook] lineUserRow=", lineUserRow);

        // prepare request to Dify
        const requestBody = {
          inputs: {},
          query: userMessage,
          response_mode: "blocking",
          user: "line-bot",
        };
        if (lineUserRow.conversation_id) {
          requestBody.conversation_id = lineUserRow.conversation_id;
        }

        // 4) fetch with 10sec timeout
        const controller = new AbortController();
        const timerId = setTimeout(() => controller.abort(), 120000);

        let difyData;
        try {
          const response = await fetch(lineApiKeyRow.dify_api_url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${lineApiKeyRow.dify_api_key}`,
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          });
          if (!response.ok) {
            const errText = await response.text();
            console.error(
              `[handleLineWebhook] Dify error: status=${response.status}, body=${errText}`
            );
            // skip or reply error
            await lineClient.replyMessage(event.replyToken, {
              type: "text",
              text: "Difyでエラーが発生しました。しばらくお待ちください。",
            });
            continue;
          }
          difyData = await response.json();
        } catch (err) {
          if (err.name === "AbortError") {
            console.error("[handleLineWebhook] Dify fetch timed out");
            await lineClient.replyMessage(event.replyToken, {
              type: "text",
              text: "Difyへの接続がタイムアウトしました。再度お試しください。",
            });
          } else {
            console.error("[handleLineWebhook] Unexpected fetch error:", err);
            await lineClient.replyMessage(event.replyToken, {
              type: "text",
              text: "Dify連携時にエラーが発生しました。",
            });
          }
          continue;
        } finally {
          clearTimeout(timerId);
        }

        console.log("[handleLineWebhook] difyData=", difyData);

        // 5) update conversation_id always if difyData has it
        if (difyData?.conversation_id) {
          // ここでは毎回上書きしておく
          if (difyData.conversation_id !== lineUserRow.conversation_id) {
            console.log(
              `[handleLineWebhook] Updating conversation_id from '${lineUserRow.conversation_id}' -> '${difyData.conversation_id}'`
            );
            await updateLineUserConversation(
              lineUserRow.line_user_id,
              difyData.conversation_id
            );
          }
        }

        // 6) reply to user
        const answer = difyData?.answer || "No answer from Dify.";
        await lineClient.replyMessage(event.replyToken, {
          type: "text",
          text: answer,
        });
        console.log("[handleLineWebhook] Replied to user.");
      } else {
        // skip non-text
        console.log(
          "[handleLineWebhook] skip event=",
          event.type,
          event?.message?.type
        );
      }
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("[handleLineWebhook] error:", err);
    // return 200 to avoid massive retries from LINE
    return res.status(200).send("Error handled");
  }
}
