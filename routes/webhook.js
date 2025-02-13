////////////////////////////////////////////////////
// routes/webhook.js
////////////////////////////////////////////////////
import { Router } from "express";
import { handleLineWebhook } from "../controllers/lineWebhookController.js";

const router = Router();

/**
 * GET /webhook
 *
 * LINE の Webhook URL 検証時（GETリクエスト）に対応し、
 * 200 OK を返すだけのルートを追加します。
 * これが無いと検証時に 404 や 405 が返る場合があります。
 */
router.get("/", (req, res) => {
  // 検証用に単純に200を返す
  res.status(200).send("LINE Webhook GET check OK");
});

/**
 * POST /webhook
 *
 * 実際のLINE Messaging APIイベント (POST) が届くルート。
 * handleLineWebhook は controllers/lineWebhookController.js で実装。
 */
router.post("/", handleLineWebhook);

export default router;
