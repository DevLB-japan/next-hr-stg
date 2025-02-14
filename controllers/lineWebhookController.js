////////////////////////////////////////////////////
// controllers/lineWebhookController.js
////////////////////////////////////////////////////
import { Client } from "@line/bot-sdk";
import fetch from "node-fetch";
import { getLineApiKeyByChannelId } from "../db/lineApiKeys.js";
import {
  getOrCreateLineUser,
  updateLineUserConversation,
} from "../db/lineUsers.js";

// メモリキャッシュ for multiple line accounts
const lineClientMap = {};

export async function handleLineWebhook(req, res) {
  try {
    const { destination, events } = req.body;
    console.log(
      "[handleLineWebhook] destination=",
      destination,
      " events=",
      events
    );

    if (!events || events.length === 0) {
      console.log("[handleLineWebhook] No events => 200 OK");
      return res.status(200).send("No events found.");
    }

    // DB: line_api_keys -> { line_channel_access_token, line_channel_secret, dify_api_url, dify_api_key }
    const lineApiKeyRow = await getLineApiKeyByChannelId(destination);
    if (!lineApiKeyRow) {
      console.log(
        "[handleLineWebhook] No lineApiKey found for destination=",
        destination
      );
      return res.status(400).send("No lineApiKey for this channel");
    }

    // client インスタンス取得 or 作成
    let client = lineClientMap[destination];
    if (!client) {
      console.log("[handleLineWebhook] Creating new LINE Client");
      client = new Client({
        channelAccessToken: lineApiKeyRow.line_channel_access_token,
        channelSecret: lineApiKeyRow.line_channel_secret,
      });
      lineClientMap[destination] = client;
    }

    for (const event of events) {
      console.log(
        "[handleLineWebhook] eventType=",
        event.type,
        " messageType=",
        event.message?.type
      );

      // テキストメッセージだけ処理
      if (event.type === "message" && event.message.type === "text") {
        const userMessage = event.message.text;
        const userId = event.source.userId;
        console.log(
          "[handleLineWebhook] userId=",
          userId,
          " userMessage=",
          userMessage
        );

        // DB: line_users
        const lineUserRow = await getOrCreateLineUser(
          lineApiKeyRow.company_id,
          userId
        );
        console.log("[handleLineWebhook] lineUserRow=", lineUserRow);

        const conversationId = lineUserRow.conversation_id;

        // === 1) sanitize userMessage to avoid Dify parse errors ===
        // Convert possible \r\n, \u2028, \u2029, etc.
        const sanitizedMessage = userMessage
          .replace(/\r\n/g, "\n") // unify Windows line endings
          .replace(/\r/g, "\n") // old Mac
          .replace(/\u2028/g, "\\u2028") // line separator
          .replace(/\u2029/g, "\\u2029"); // paragraph separator
        // optional: also escape double quotes if needed
        // .replace(/"/g, '\\"')
        // === 2) Prepare Dify request body ===
        const requestBody = {
          inputs: {},
          query: sanitizedMessage, // pass sanitized text
          response_mode: "blocking",
          user: "line-bot",
        };
        if (conversationId) {
          requestBody.conversation_id = conversationId;
        }

        console.log("[handleLineWebhook] Dify requestBody=", requestBody);

        // === 3) Call Dify API ===
        // JSON.stringify で改行等は適切にエスケープされる
        const difyResponse = await fetch(lineApiKeyRow.dify_api_url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lineApiKeyRow.dify_api_key}`,
          },
          body: JSON.stringify(requestBody),
        });

        if (!difyResponse.ok) {
          const errBody = await difyResponse.text();
          console.error(
            "[handleLineWebhook] Dify API error. status=",
            difyResponse.status,
            "body=",
            errBody
          );
          // skip reply or handle gracefully
          continue;
        }

        const difyData = await difyResponse.json();
        console.log("[handleLineWebhook] difyData=", difyData);

        // === 4) update conversation_id if needed
        if (!conversationId && difyData.conversation_id) {
          await updateLineUserConversation(
            lineUserRow.line_user_id,
            difyData.conversation_id
          );
          console.log(
            "[handleLineWebhook] updated conversationId=",
            difyData.conversation_id
          );
        }

        // === 5) Reply to user
        await client.replyMessage(event.replyToken, {
          type: "text",
          text: difyData.answer || "No answer from Dify",
        });
        console.log("[handleLineWebhook] Replied to user.");
      } else {
        console.log("[handleLineWebhook] Skip event (not text).");
      }
    }

    return res.status(200).send("Success");
  } catch (err) {
    console.error("[handleLineWebhook] error:", err);
    return res.status(500).send("Internal Server Error");
  }
}
