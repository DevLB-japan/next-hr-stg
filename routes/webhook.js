///////////////////////////////////////////
// routes/webhook.js
///////////////////////////////////////////
import express from "express";
import { handleLineWebhook } from "../controllers/lineWebhookController.js";

const router = express.Router();

// POST /webhook
router.post("/", handleLineWebhook);

// ★ デフォルトエクスポートで「webhook.js」が「router」を返す
export default router;
