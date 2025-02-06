///////////////////////////////////////////
// /routes/report.js
///////////////////////////////////////////
import express from "express";
import { createReportController } from "../controllers/reportController.js";

// 1) ルータ作成
const router = express.Router();

/**
 * POST /report/create
 * body: {
 *   "lineUserId": "...",
 *   "dataA": "...",
 *   "dataB": "..."
 * }
 * → createReportController
 */
router.post("/create", createReportController);

// 2) デフォルトエクスポート
export default router;
