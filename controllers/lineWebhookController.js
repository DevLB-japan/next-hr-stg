////////////////////////////////////////////////////
// controllers/lineWebhookController.js (or routes)
////////////////////////////////////////////////////
import { Client } from "@line/bot-sdk";
import fetch from "node-fetch";
import { AbortController } from "abort-controller";
// ...import db modules etc.

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
      return res.status(200).send("No events");
    }

    // DB: get lineApiKeyRow by destination
    const lineApiKeyRow = await getLineApiKeyByChannelId(destination);
    if (!lineApiKeyRow) {
      console.log(
        "[handleLineWebhook] No lineApiKey found for destination=",
        destination
      );
      return res.status(400).send("No lineApiKey for this channel");
    }

    // reuse or create line client
    let client = lineClientMap[destination];
    if (!client) {
      client = new Client({
        channelAccessToken: lineApiKeyRow.line_channel_access_token,
        channelSecret: lineApiKeyRow.line_channel_secret,
      });
      lineClientMap[destination] = client;
    }

    for (const event of events) {
      // text message only
      if (event.type === "message" && event.message.type === "text") {
        const userId = event.source.userId;
        const userMessage = event.message.text;

        // get line_user from DB...
        const lineUserRow = await getOrCreateLineUser(
          lineApiKeyRow.company_id,
          userId
        );

        const conversationId = lineUserRow.conversation_id;

        // Dify request body
        const requestBody = {
          inputs: {},
          query: userMessage,
          response_mode: "blocking",
          user: "line-bot",
        };
        if (conversationId) {
          requestBody.conversation_id = conversationId;
        }

        // === fetch with timeout via AbortController ===
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10sec
        let difyData;
        try {
          const difyResponse = await fetch(lineApiKeyRow.dify_api_url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${lineApiKeyRow.dify_api_key}`,
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          });

          if (!difyResponse.ok) {
            const errText = await difyResponse.text();
            console.error(
              "[handleLineWebhook] Dify API error. status=",
              difyResponse.status,
              "body=",
              errText
            );
            continue; // or handle error
          }

          difyData = await difyResponse.json();
        } catch (err) {
          if (err.name === "AbortError") {
            console.error("[handleLineWebhook] Timed out calling Dify");
            // reply user: "sorry, system is busy..." etc.
            await client.replyMessage(event.replyToken, {
              type: "text",
              text: "申し訳ありません。処理が混雑しています。少し待ってからもう一度お試しください。",
            });
            continue;
          } else {
            console.error("[handleLineWebhook] fetch error:", err);
            continue;
          }
        } finally {
          clearTimeout(timeoutId);
        }

        console.log("[handleLineWebhook] difyData=", difyData);

        // if conversation_id is newly returned
        if (!conversationId && difyData.conversation_id) {
          await updateLineUserConversation(
            lineUserRow.line_user_id,
            difyData.conversation_id
          );
        }

        // reply to user
        const answerText = difyData.answer || "No answer.";
        await client.replyMessage(event.replyToken, {
          type: "text",
          text: answerText,
        });
        console.log("[handleLineWebhook] Replied to user:", answerText);
      }
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("[handleLineWebhook] error:", err);
    return res.status(500).send("Server Error");
  }
}
