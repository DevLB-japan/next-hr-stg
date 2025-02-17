import fetch from "node-fetch";
import { AbortController } from "abort-controller";
import { updateLineUserConversation } from "../db/lineUsers.js";
import { pushMessageToUser } from "../services/linePushService.js";

/**
 * 長めの処理を非同期で行い、ユーザには push で返す
 */
export async function processLineTextEvent({
  lineClient,
  lineApiKeyRow,
  lineUserRow,
  userMessage,
  replyToken,
}) {
  try {
    // 1) Difyに問い合わせ
    const requestBody = {
      inputs: {},
      query: userMessage,
      response_mode: "blocking",
      user: "line-bot",
    };
    if (lineUserRow.conversation_id) {
      requestBody.conversation_id = lineUserRow.conversation_id;
    }

    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), 10000); // 10秒でタイムアウト
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
          "[processLineTextEvent] Dify error. status=",
          response.status,
          errText
        );
        // push error msg to user
        await pushMessageToUser(
          lineClient,
          lineUserRow.user_id,
          "Difyでエラーが発生しました。"
        );
        return;
      }
      difyData = await response.json();
    } catch (err) {
      if (err.name === "AbortError") {
        console.error("[processLineTextEvent] Dify fetch timed out");
        await pushMessageToUser(
          lineClient,
          lineUserRow.user_id,
          "Difyへの接続がタイムアウトしました。"
        );
      } else {
        console.error("[processLineTextEvent] Unexpected fetch error:", err);
        await pushMessageToUser(
          lineClient,
          lineUserRow.user_id,
          "Dify連携時にエラーが発生しました。"
        );
      }
      return;
    } finally {
      clearTimeout(timerId);
    }

    console.log("[processLineTextEvent] difyData=", difyData);

    // 2) conversation_id更新
    if (
      difyData?.conversation_id &&
      difyData.conversation_id !== lineUserRow.conversation_id
    ) {
      await updateLineUserConversation(
        lineUserRow.line_user_id,
        difyData.conversation_id
      );
    }

    // 3) difyDataのanswer をユーザへ push
    const answer = difyData?.answer || "No answer from Dify.";
    await pushMessageToUser(lineClient, lineUserRow.user_id, answer);

    // 4) もし面接終了を判定しているなら
    if (answer.includes("【面接終了】")) {
      // ここで非同期にレポート作成など
      // createReportControllerを直接呼ぶ or キューに登録して別途処理 etc
    }

    console.log("[processLineTextEvent] done");
  } catch (err) {
    console.error("[processLineTextEvent] top-level error:", err);
  }
}
