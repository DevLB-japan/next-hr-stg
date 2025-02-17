//////////////////////////////////////////////////////////
// lineWebhookController.js (例)
//////////////////////////////////////////////////////////
import fetch from "node-fetch";
import { Client } from "@line/bot-sdk";
import { getLineApiKeyByChannelId } from "../db/lineApiKeys.js";
import { getOrCreateLineUser } from "../db/lineUsers.js";

/**
 * handleLineWebhook
 *   1) 2秒以内にレスポンスを返す -> res.status(200).end()
 *   2) 非同期で重い処理 (Dify呼び出し等) → pushMessage でユーザへ返信
 */
export async function handleLineWebhook(req, res) {
  try {
    const destination = req.body?.destination;
    const events = req.body?.events;

    if (!events || events.length === 0) {
      console.log("[handleLineWebhook] No events => 200 OK");
      return res.status(200).send("No events");
    }

    // DB: line_api_keys
    let lineApiKeyRow = null;
    if (destination) {
      lineApiKeyRow = await getLineApiKeyByChannelId(destination);
    }
    if (!lineApiKeyRow) {
      console.warn(
        `[handleLineWebhook] No lineApiKeys found for destination=${destination}`
      );
      // すぐ終了
      return res.status(200).send("No lineApiKeys found");
    }

    // 2秒以内に返すため: 先に 200 OK を返却
    // => ここで応答したら、LINE はタイムアウトしなくなる
    res.status(200).end();

    // あとはバックグラウンドでイベントを処理 (setImmediateやqueue)
    for (const event of events) {
      if (event.type === "message" && event.message.type === "text") {
        // バックグラウンドで処理する
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
    // とりあえず200で返す
    return res.status(200).end();
  }
}

/**
 * 非同期で実行する重い処理をまとめた関数 (例)
 */
async function processLineTextEvent(lineApiKeyRow, event) {
  console.log("[processLineTextEvent] BG start event=", event.type);

  // 1) LINE Client
  const lineClient = new Client({
    channelAccessToken: lineApiKeyRow.line_channel_access_token,
    channelSecret: lineApiKeyRow.line_channel_secret,
  });

  const userId = event.source.userId;
  const userMessage = event.message.text;

  // 2) DB: line_users
  const lineUserRow = await getOrCreateLineUser(
    lineApiKeyRow.company_id,
    userId
  );
  console.log("[processLineTextEvent] lineUserRow=", lineUserRow);

  // 3) (重い処理例) Dify呼び出し
  //    ここで10秒とかかかる可能性があるなら、
  //    2秒以内に返すのは不可能 → pushMessageで完了通知
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
  } catch (err) {
    console.error("[processLineTextEvent] Dify fetch error:", err);
    difyData = { answer: "Difyへの接続がタイムアウトしました。" };
  }

  // 4) line_user の conversation_id 更新
  if (
    difyData?.conversation_id &&
    difyData.conversation_id !== lineUserRow.conversation_id
  ) {
    // your update function
    // await updateLineUserConversation(...);
  }

  // 5) pushMessage でユーザへ送信 (replyTokenは使えない → 2秒経過している可能性が高い)
  const answerText = difyData?.answer || "No answer from Dify. (非同期処理)";
  console.log(
    "[processLineTextEvent] pushing answer to userId=",
    userId,
    " text=",
    answerText
  );

  await lineClient.pushMessage(userId, {
    type: "text",
    text: answerText,
  });

  console.log("[processLineTextEvent] BG done.");
}
