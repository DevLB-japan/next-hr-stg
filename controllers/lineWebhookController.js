////////////////////////////////////////////////////
// controllers/lineWebhookController.js
////////////////////////////////////////////////////
import { getLineApiKeyByChannelId } from "../db/lineApiKeys.js";
import {
  getOrCreateLineUser,
  updateLineUserConversation,
} from "../db/lineUsers.js";
import { Client as LineClient, validateSignature } from "@line/bot-sdk";
import fetch from "node-fetch";

export async function handleLineWebhook(req, res) {
  try {
    // 1) x-line-signature
    const signature = req.headers["x-line-signature"];
    const bodyString = JSON.stringify(req.body);

    // 2) destinationを取得
    const destination = req.body.destination || null;

    // DBから line_api_keys
    const lineApiKey = await getLineApiKeyByChannelId(
      destination || "DEFAULT_CHANNEL"
    );
    if (!lineApiKey) {
      console.error(`No line_api_keys found for destination=${destination}`);
      return res.status(400).send("No channel config");
    }

    // 3) 署名検証
    const isValid = validateSignature(
      bodyString,
      lineApiKey.line_channel_secret,
      signature
    );
    if (!isValid) {
      console.warn("Invalid signature");
      return res.status(403).send("Invalid signature");
    }

    const events = req.body.events;
    if (!events || events.length === 0) {
      return res.status(200).send("No events");
    }

    const client = new LineClient({
      channelAccessToken: lineApiKey.line_channel_access_token,
      channelSecret: lineApiKey.line_channel_secret,
    });

    // メッセージイベントの簡易例
    for (const event of events) {
      if (event.type === "message" && event.message.type === "text") {
        await handleMessageEvent(event, lineApiKey, client);
      }
      // follow/unfollow等も追加可能
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("Error handling webhook:", err);
    res.status(500).send("Internal Server Error");
  }
}

async function handleMessageEvent(event, lineApiKey, client) {
  try {
    const userId = event.source.userId; // actual LINE userId
    const userMessage = event.message.text;
    const companyId = lineApiKey.company_id; // from line_api_keys

    // 1) getOrCreateLineUser
    const lineUser = await getOrCreateLineUser(companyId, userId);
    let conversationId = lineUser.conversation_id || null;

    // 2) Dify API call
    const requestBody = {
      inputs: {},
      query: userMessage,
      response_mode: "blocking",
      user: "line-bot",
    };
    if (conversationId) requestBody.conversation_id = conversationId;

    let difyResp;
    try {
      const resp = await fetch(lineApiKey.dify_api_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lineApiKey.dify_api_key}`,
        },
        body: JSON.stringify(requestBody),
      });
      difyResp = await resp.json();
    } catch (e) {
      console.error("Dify fetch error:", e);
      difyResp = { answer: "Dify API call failed" };
    }

    // 3) update conversationId
    if (!conversationId && difyResp?.conversation_id) {
      await updateLineUserConversation(
        lineUser.line_user_id,
        difyResp.conversation_id
      );
    }

    // 4) reply to user
    const answerText = difyResp?.answer || "Error or no answer.";
    await client.replyMessage(event.replyToken, {
      type: "text",
      text: answerText,
    });
  } catch (err) {
    console.error("Error in handleMessageEvent:", err);
  }
}
