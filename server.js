///////////////////////////////////////////
// server.js
///////////////////////////////////////////
import express from "express";
import dotenv from "dotenv";

// Routes
import webhookRouter from "./routes/webhook.js";
import mailRouter from "./routes/mail.js";
import reportRouter from "./routes/report.js";

dotenv.config();
const app = express();
app.use(express.json());

// Line Webhook
app.use("/webhook", webhookRouter);

// Mail sending route
app.use("/mail", mailRouter);

// Report route (for Dify to POST, for instance)
app.use("/report", reportRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
