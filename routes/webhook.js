import express from "express";
import { handleLineWebhook } from "../controllers/lineWebhookController.js";

const router = express.Router();

// GET /webhook for verification
router.get("/", (req, res) => {
  console.log("[WebhookRouter] GET /webhook => 200 OK");
  res.status(200).send("OK (GET /webhook verified)");
});

// POST /webhook
router.post("/", async (req, res) => {
  // 1) まずは即座に200を返す
  res.status(200).send("OK");
  // 2) この後、非同期で処理
  handleLineWebhook(req.body).catch((err) => {
    console.error("[webhookRouter] handleLineWebhook error:", err);
  });
});

export default router;
