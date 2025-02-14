//////////////////////////////////////////////////////////
// controllers/lineWebhookController.js
//////////////////////////////////////////////////////////
import fetch from "node-fetch";
// 例: line-bot-sdk の replyMessage を使うなら
import { Client } from "@line/bot-sdk";
import { getLineApiKeyByChannelId } from "../db/lineApiKeys.js";
import { getOrCreateLineUser } from "../db/lineUsers.js";

/**
 * 環境変数使わないパターンの場合:
 *  - DB から channelAccessToken / channelSecret を取得する
 */

export async function handleLineWebhook(req, res) {
  try {
    // 1) events チェック
    const destination = req.body?.destination;
    const events = req.body?.events;
    if (!events || events.length === 0) {
      console.log("[handleLineWebhook] No events => 200 OK");
      return res.status(200).send("No events");
    }

    // 2) DB から line_api_keys を引く (channel_id = destination)
    if (!destination) {
      console.log(
        "[handleLineWebhook] destination= undefined ??? continuing anyway..."
      );
    }
    const lineApiKeysRow = destination
      ? await getLineApiKeyByChannelId(destination)
      : null;
    if (!lineApiKeysRow) {
      console.warn(
        `[handleLineWebhook] No line_api_keys found for destination=${destination}`
      );
      // ない場合でも一応 200返す (LINEにはエラーにしない)
      // あるいは 400でもいい
      // ここでは 200 で終了
      return res.status(200).send("No line_api_keys found");
    }

    // 3) create client
    const lineClient = new Client({
      channelAccessToken: lineApiKeysRow.line_channel_access_token,
      channelSecret: lineApiKeysRow.line_channel_secret,
    });

    // 4) イベントを順番に処理
    for (const event of events) {
      // 4-1) messageイベント + text
      if (event.type === "message" && event.message.type === "text") {
        const userId = event.source.userId;
        const userMessage = event.message.text;
        console.log(
          "[handleLineWebhook] eventType=",
          event.type,
          " messageType=",
          event.message.type
        );
        console.log(
          "[handleLineWebhook] userId=",
          userId,
          " userMessage=",
          userMessage
        );

        // 4-2) line_users
        const lineUserRow = await getOrCreateLineUser(
          lineApiKeysRow.company_id,
          userId
        );
        console.log("[handleLineWebhook] lineUserRow=", lineUserRow);

        // 4-3) Dify呼び出し
        //     例: conversation_id= lineUserRow.conversation_id
        const requestBody = {
          inputs: {},
          query: userMessage,
          response_mode: "blocking",
          user: "line-bot",
        };
        if (lineUserRow.conversation_id) {
          requestBody.conversation_id = lineUserRow.conversation_id;
        }

        // 簡易タイムアウト
        const controller = new AbortController();
        const timerId = setTimeout(() => controller.abort(), 10000); //10秒

        let difyData;
        try {
          const difyResp = await fetch(lineApiKeysRow.dify_api_url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${lineApiKeysRow.dify_api_key}`,
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          });
          difyData = await difyResp.json();
        } catch (error) {
          if (error.name === "AbortError") {
            console.error("[handleLineWebhook] Dify fetch TIMEOUT");
            // 返信 (Timeout)
            await lineClient.replyMessage(event.replyToken, {
              type: "text",
              text: "Dify連携がタイムアウトしました。しばらく待ってから再度お願いします。",
            });
            continue;
          }
          console.error("[handleLineWebhook] Dify API error:", error);
          await lineClient.replyMessage(event.replyToken, {
            type: "text",
            text: "エラーが発生しました。(Dify API fetch error)",
          });
          continue;
        } finally {
          clearTimeout(timerId);
        }

        console.log("[handleLineWebhook] difyData=", difyData);

        // conversation_id を保存し直す
        if (!lineUserRow.conversation_id && difyData?.conversation_id) {
          // ...
          // updateLineUserConversation(...)
        }

        // Dify回答
        let replyText = difyData?.answer || "エラーまたは空の回答です";
        // 返信
        await lineClient.replyMessage(event.replyToken, {
          type: "text",
          text: replyText,
        });
        console.log("[handleLineWebhook] Replied to user.");
      } else {
        // 未対応イベント
        console.log("[handleLineWebhook] event.type=", event.type, " => skip");
      }
    }

    return res.status(200).send("Success");
  } catch (err) {
    console.error("[handleLineWebhook] ERROR:", err);
    // LINEには 200 を返す: 失敗すると再送が大量に来るため
    return res.status(200).send("Error handled internally");
  }
}
