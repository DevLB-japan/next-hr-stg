//////////////////////////////////////////////////////////
// lineWebhookController.js
//////////////////////////////////////////////////////////
import fetch from "node-fetch";
import { Client } from "@line/bot-sdk";
import { getLineApiKeyByChannelId } from "../db/lineApiKeys.js";
import {
  getOrCreateLineUser,
  updateLineUserConversation,
} from "../db/lineUsers.js";

/**
 * handleLineWebhook:
 *  1) 受け取ったら即座に res.status(200).end()
 *  2) 非同期タスクで Dify呼び出し → conversation_id更新 → pushMessage
 */
export async function handleLineWebhook(req, res) {
  try {
    const destination = req.body?.destination;
    const events = req.body?.events;

    if (!events || events.length === 0) {
      console.log("[handleLineWebhook] No events => 200 OK");
      return res.status(200).send("No events");
    }

    // 1) DB: line_api_keys (destination => channel_id)
    let lineApiKeyRow = null;
    if (destination) {
      lineApiKeyRow = await getLineApiKeyByChannelId(destination);
    }
    if (!lineApiKeyRow) {
      console.warn(
        `[handleLineWebhook] No lineApiKeys found for destination=${destination}`
      );
      return res.status(200).send("No lineApiKeys found");
    }

    // 2秒以内に返すため、先に 200 OK
    res.status(200).end();

    // 非同期でイベントを処理
    for (const event of events) {
      // テキストメッセージのみ処理
      if (event.type === "message" && event.message.type === "text") {
        // BG タスクとして処理を委譲
        processLineTextEvent(lineApiKeyRow, event).catch((err) => {
          console.error("[handleLineWebhook] BG error:", err);
        });
      } else {
        console.log(
          "[handleLineWebhook] skip event=",
          event.type,
          event?.message?.type
        );
      }
    }
  } catch (err) {
    console.error("[handleLineWebhook] error:", err);
    // LINE的には200でOK (エラー時も再送し過ぎないように)
    return res.status(200).end();
  }
}

/**
 * 非同期で重い処理を行う関数:
 *  1) DBから line_user を取得 or 作成
 *  2) Dify呼び出し (会話継続には conversation_id が必須)
 *  3) DBに conversation_id を更新
 *  4) pushMessage でユーザへ回答送信
 */
async function processLineTextEvent(lineApiKeyRow, event) {
  try {
    const lineClient = new Client({
      channelAccessToken: lineApiKeyRow.line_channel_access_token,
      channelSecret: lineApiKeyRow.line_channel_secret,
    });

    const userId = event.source.userId;
    const userMessage = event.message.text;

    console.log(
      "[processLineTextEvent] userId=",
      userId,
      "message=",
      userMessage
    );

    // 1) DB: line_users
    const lineUserRow = await getOrCreateLineUser(
      lineApiKeyRow.company_id,
      userId
    );
    console.log("[processLineTextEvent] lineUserRow=", lineUserRow);

    // 2) Dify呼び出し
    const requestBody = {
      inputs: {},
      query: userMessage,
      response_mode: "blocking",
      user: "line-bot",
    };
    if (lineUserRow.conversation_id) {
      requestBody.conversation_id = lineUserRow.conversation_id;
    }

    let difyData = null;
    try {
      const response = await fetch(lineApiKeyRow.dify_api_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lineApiKeyRow.dify_api_key}`,
        },
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) {
        const errText = await response.text();
        console.error(
          "[processLineTextEvent] Dify error. status=",
          response.status,
          errText
        );
        difyData = { answer: "Difyでエラーが発生しました。" };
      } else {
        difyData = await response.json();
      }
    } catch (fetchErr) {
      console.error("[processLineTextEvent] Dify fetch error:", fetchErr);
      difyData = { answer: "Difyへの接続でエラーが起きました。" };
    }

    // 3) DBに conversation_id を更新
    if (
      difyData?.conversation_id &&
      difyData.conversation_id !== lineUserRow.conversation_id
    ) {
      console.log(
        `[processLineTextEvent] Updating conversation_id => ${difyData.conversation_id}`
      );
      await updateLineUserConversation(
        lineUserRow.line_user_id,
        difyData.conversation_id
      );
    }

    // 4) pushMessageでユーザに回答送信
    const answerText = difyData?.answer || "No answer from Dify. (push)";
    console.log(
      "[processLineTextEvent] pushMessage userId=",
      userId,
      " =>",
      answerText
    );

    await lineClient.pushMessage(userId, {
      type: "text",
      text: answerText,
    });

    console.log("[processLineTextEvent] done");
  } catch (err) {
    // ここでのエラーはログに出して終わり
    console.error("[processLineTextEvent] Unexpected error:", err);
  }
}
