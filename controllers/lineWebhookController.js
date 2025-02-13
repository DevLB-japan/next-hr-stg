////////////////////////////////////////////////////
// controllers/lineWebhookController.js
////////////////////////////////////////////////////
import { Client } from "@line/bot-sdk";
import fetch from "node-fetch";
import dotenv from "dotenv";

// DB Access
import { getLineApiKeyByChannelId } from "../db/lineApiKeys.js";
import {
  getOrCreateLineUser,
  updateLineUserConversation,
} from "../db/lineUsers.js";

dotenv.config();

// メモリで destination -> Clientインスタンス をキャッシュ
const lineClientMap = {};

export async function handleLineWebhook(req, res) {
  try {
    const { destination, events } = req.body;

    console.log(
      "[handleLineWebhook] destination=",
      destination,
      " events=",
      JSON.stringify(events)
    );

    // イベントが無ければ200で終わり
    if (!events || events.length === 0) {
      console.log("[handleLineWebhook] No events => 200 OK");
      return res.status(200).send("No events found.");
    }

    // DBで line_api_key を取得
    const lineApiKeyRow = await getLineApiKeyByChannelId(destination);
    if (!lineApiKeyRow) {
      console.log(
        "[handleLineWebhook] No lineApiKeys found for destination=",
        destination
      );
      return res
        .status(400)
        .send("No lineApiKey for destination=" + destination);
    }

    // clientインスタンスをキャッシュから取得 or 新規作成
    let client = lineClientMap[destination];
    if (!client) {
      console.log(
        "[handleLineWebhook] Creating new Client for destination=",
        destination
      );
      client = new Client({
        channelAccessToken: lineApiKeyRow.line_channel_access_token,
        channelSecret: lineApiKeyRow.line_channel_secret,
      });
      lineClientMap[destination] = client;
    }

    // 複数イベントを処理
    for (const event of events) {
      console.log(
        "[handleLineWebhook] eventType=",
        event.type,
        " messageType=",
        event.message?.type
      );

      // ここでは メッセージ + テキスト以外はスキップする例
      if (event.type === "message" && event.message.type === "text") {
        const userMessage = event.message.text;
        const userId = event.source.userId;

        console.log(
          "[handleLineWebhook] userId=",
          userId,
          " userMessage=",
          userMessage
        );

        // DB上の line_users を getOrCreate
        const lineUserRow = await getOrCreateLineUser(
          lineApiKeyRow.company_id,
          userId
        );
        console.log("[handleLineWebhook] lineUserRow=", lineUserRow);

        // conversation_idを取得
        const conversationId = lineUserRow.conversation_id;

        // Dify API 呼び出し
        const requestBody = {
          inputs: {},
          query: userMessage,
          response_mode: "blocking",
          user: "line-bot",
        };
        if (conversationId) {
          requestBody.conversation_id = conversationId;
        }

        console.log("[handleLineWebhook] Dify requestBody=", requestBody);

        const difyResponse = await fetch(lineApiKeyRow.dify_api_url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lineApiKeyRow.dify_api_key}`,
          },
          body: JSON.stringify(requestBody),
        });

        if (!difyResponse.ok) {
          const errorText = await difyResponse.text();
          console.error(
            "[handleLineWebhook] Dify API error. status=",
            difyResponse.status,
            "body=",
            errorText
          );
          // 失敗時はログのみでスキップする例
          continue;
        }

        const difyData = await difyResponse.json();
        console.log("[handleLineWebhook] difyData=", difyData);

        // もし会話IDが無く、Difyから新たにconversation_idが返ってきたら更新
        if (!conversationId && difyData.conversation_id) {
          await updateLineUserConversation(
            lineUserRow.line_user_id,
            difyData.conversation_id
          );
          console.log(
            "[handleLineWebhook] updated conversation_id=",
            difyData.conversation_id
          );
        }

        // LINE返信
        await client.replyMessage(event.replyToken, {
          type: "text",
          text: difyData.answer || "Dify error or no answer",
        });

        console.log("[handleLineWebhook] Replied to user.");
      } else {
        // それ以外のイベントはログのみ
        console.log("[handleLineWebhook] Skip non-text event.");
      }
    }

    return res.status(200).send("Success");
  } catch (err) {
    console.error("[handleLineWebhook] error:", err);
    return res.status(500).send("Internal Server Error");
  }
}
