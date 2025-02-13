////////////////////////////////////////////////////
// lineWebhookController.js (例)
////////////////////////////////////////////////////
import {
  getOrCreateLineUser,
  updateLineUserConversation,
} from "../db/lineUsers.js";
import { getLineApiKeyByChannelId } from "../db/lineApiKeys.js";
import fetch from "node-fetch";

export async function handleLineWebhook(req, res) {
  try {
    const destination = req.body.destination;
    const events = req.body.events;

    console.log(
      "[handleLineWebhook] destination=",
      destination,
      " events=",
      JSON.stringify(events)
    );

    if (!events || events.length === 0) {
      console.log("[handleLineWebhook] No events => 200 OK");
      return res.status(200).send("No events found.");
    }

    // DBで lineApiKeyRow を取得
    const lineApiKeyRow = await getLineApiKeyByChannelId(destination);
    if (!lineApiKeyRow) {
      console.log(
        "[handleLineWebhook] No lineApiKeys found for destination=",
        destination
      );
      return res
        .status(400)
        .send("No lineApiKeys found for destination=" + destination);
    }

    // Loop events
    for (const event of events) {
      console.log(
        "[handleLineWebhook] eventType=",
        event.type,
        " messageType=",
        event.message?.type
      );

      // 1) もし message.text の場合のみ処理
      if (event.type === "message" && event.message.type === "text") {
        const userMessage = event.message.text;
        const userId = event.source.userId;

        console.log(
          "[handleLineWebhook] userId=",
          userId,
          " userMessage=",
          userMessage
        );

        // 2) getOrCreate line user
        const lineUserRow = await getOrCreateLineUser(
          lineApiKeyRow.company_id,
          userId
        );
        console.log("[handleLineWebhook] lineUserRow=", lineUserRow);

        const conversationId = lineUserRow.conversation_id;

        // 3) Call Dify
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

        // Check response
        if (!difyResponse.ok) {
          const errText = await difyResponse.text();
          console.error(
            "[handleLineWebhook] Dify API Error. status=",
            difyResponse.status,
            "body=",
            errText
          );
          // You can decide to reply a fallback message or just skip
          continue;
        }

        const difyData = await difyResponse.json();
        console.log("[handleLineWebhook] difyData=", difyData);

        // 4) if new conversation_id => update DB
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

        // 5) Reply to user
        await lineApiKeyRow.client.replyMessage(event.replyToken, {
          type: "text",
          text: difyData.answer || "Dify error or no answer",
        });

        console.log("[handleLineWebhook] reply done.");
      } else {
        // 何もしない(ログだけ)
        console.log(
          "[handleLineWebhook] Skip event, not text message or not message type"
        );
      }
    }

    return res.status(200).send("Success");
  } catch (err) {
    console.error("[handleLineWebhook] error:", err);
    return res.status(500).send("Internal Server Error");
  }
}
