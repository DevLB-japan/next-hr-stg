///////////////////////////////////////////
// routes/mail.js
///////////////////////////////////////////
import express from "express";
import { mailController } from "../controllers/mailController.js";

const router = express.Router();

// POST /mail/send
router.post("/send", mailController);

// ★ デフォルトエクスポート
export default router;
