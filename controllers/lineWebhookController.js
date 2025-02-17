import fetch from "node-fetch";
import { AbortController } from "abort-controller";
import { Client } from "@line/bot-sdk";
import { getLineApiKeyByChannelId } from "../db/lineApiKeys.js";
import {
  getOrCreateLineUser,
  updateLineUserConversation,
} from "../db/lineUsers.js";
import { pushMessageToUser } from "../services/linePushService.js";
import { processLineTextEvent } from "./processLineTextEvent.js";

// ここでは関数にして「即時return」ではなく、呼び出し側が非同期実行する
export async function handleLineWebhook(body) {
  const { destination, events } = body || {};
  if (!events || events.length === 0) {
    console.log("[handleLineWebhook] No events => skip");
    return;
  }

  // 1) line_api_keys
  let lineApiKeyRow = null;
  if (destination) {
    lineApiKeyRow = await getLineApiKeyByChannelId(destination);
  }
  if (!lineApiKeyRow) {
    console.warn(
      "[handleLineWebhook] no lineApiKeys for destination=",
      destination
    );
    return;
  }

  // 2) create line client
  const lineClient = new Client({
    channelAccessToken: lineApiKeyRow.line_channel_access_token,
    channelSecret: lineApiKeyRow.line_channel_secret,
  });

  // 3) process events
  for (const event of events) {
    if (event.type === "message" && event.message.type === "text") {
      const userId = event.source.userId;
      const userMessage = event.message.text;
      console.log(
        "[handleLineWebhook] textEvent userId=",
        userId,
        "msg=",
        userMessage
      );

      // DB
      const lineUserRow = await getOrCreateLineUser(
        lineApiKeyRow.company_id,
        userId
      );

      // Dify呼び出しなど長時間かかるので、別の関数へ
      processLineTextEvent({
        lineClient,
        lineApiKeyRow,
        lineUserRow,
        userMessage,
        replyToken: event.replyToken, // もしかしたら数秒で使うかもしれない
      }).catch((err) => console.error("[processLineTextEvent] error:", err));
    } else {
      console.log("[handleLineWebhook] skip event=", event.type);
    }
  }
}
