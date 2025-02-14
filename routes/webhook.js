//////////////////////////////////////////////////////////
// routes/webhook.js
//////////////////////////////////////////////////////////
import express from "express";
import { handleLineWebhook } from "../controllers/lineWebhookController.js";

const router = express.Router();

/**
 * LINE公式のWebhook URL:
 *   POST /webhook
 *   - イベントが無ければOKを返す
 *   - Verify用に GET /webhook が飛んでくるケースもある
 */

// [A] GET /webhook → Verify用 (200返す)
router.get("/", (req, res) => {
  console.log("[WebhookRouter] GET /webhook => Just 200 OK for verification");
  return res.status(200).send("OK (GET /webhook verified)");
});

// [B] POST /webhook → LINE Messaging API
router.post("/", handleLineWebhook);

export default router;
