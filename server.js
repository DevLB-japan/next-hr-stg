///////////////////////////////////////////
// server.js
///////////////////////////////////////////
import express from "express";
import dotenv from "dotenv";
import webhookRouter from "./routes/webhook.js";
import reportRouter from "./routes/report.js";
// もしメール用など他のルーターがあれば追記

dotenv.config();

const app = express();

/**
 * 1) JSONパーサをグローバルに設定
 *    （※ limitを大きめにしたい場合は { limit: "10mb" }など）
 *    ここ以外で raw-body 等を使わないか注意
 */
app.use(express.json({ limit: "10mb" }));

/**
 * 3) 各ルートの設定
 */
app.use("/webhook", webhookRouter);
// 例: Dify からのレポート用
app.use("/report", reportRouter);
// もし他にも /mail などあればまとめる

/**
 * 4) テスト用のルート(ヘルスチェック等)
 */
app.get("/", (req, res) => {
  res.status(200).send("OK from root path");
});

/**
 * 5) グローバルエラーハンドリング（オプション）
 *    stream.not.readable や JSON parse error をキャッチ
 */
app.use((err, req, res, next) => {
  console.error("[GlobalErrorHandler] error:", err);

  // body-parser の JSON parse 失敗時
  // err.type === 'entity.parse.failed' か err.type === 'stream.not.readable'
  if (
    err.type === "entity.parse.failed" ||
    err.type === "stream.not.readable"
  ) {
    return res.status(400).json({ error: "Invalid JSON payload" });
  }

  // その他のエラーを一括でInternalServerError扱い
  return res.status(500).json({ error: "Internal Server Error" });
});

/**
 * 6) サーバ起動
 */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
