////////////////////////////////////////////////////
// controllers/reportController.js
////////////////////////////////////////////////////
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { nanoid } from "nanoid";

import { generatePdfFromHtml } from "../services/pdfGenerator.js";
import { uploadPdfToS3, ensureFolderExists } from "../services/s3Upload.js";
import { createReport } from "../db/reports.js";
import { getLineUserByConversation } from "../db/lineUsers.js";
import { getCompanyById } from "../db/companies.js";
import { sendMailWithSes } from "../services/sendMail.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function createReportController(req, res) {
  try {
    // 1) conversation_id から lineUser を取得
    const { conversation_id } = req.body;
    if (!conversation_id) {
      console.warn("[createReportController] no conversation_id provided");
      return res.status(400).json({ error: "No conversation_id" });
    }

    const lineUser = await getLineUserByConversation(conversation_id);
    if (!lineUser) {
      console.warn(
        `[createReportController] no lineUser for conversation_id=${conversation_id}`
      );
      return res.status(400).json({ error: "Invalid conversation_id" });
    }

    // 2) 企業取得
    const company = await getCompanyById(lineUser.company_id);
    if (!company) {
      console.warn(
        `[createReportController] no company for company_id=${lineUser.company_id}`
      );
      return res.status(400).json({ error: "No company found" });
    }

    // 3) 5つのHTMLを結合し PDF化
    const htmlParts = [];
    for (let i = 1; i <= 5; i++) {
      const filePath = join(__dirname, `../templates/report${i}.html`);
      console.log("[createReportController] reading file=", filePath);
      const fileSrc = fs.readFileSync(filePath, "utf-8");
      htmlParts.push(fileSrc);

      if (i < 5) {
        htmlParts.push('<div style="page-break-before: always;"></div>');
      }
    }
    const combinedHtml = htmlParts.join("\n");
    const pdfBuffer = await generatePdfFromHtml(combinedHtml);

    // 4) 企業IDのフォルダ(プレフィックス)をチェックし、無ければ作成
    //    （services/s3Upload.js 側で ensureFolderExists を実装）
    const folderPrefix = `reports/${company.company_id}/`;
    await ensureFolderExists(folderPrefix);

    // 5) line_user_id.pdf という名前で PDF アップロード
    const pdfKey = `${folderPrefix}${lineUser.line_user_id}.pdf`;
    console.log("[createReportController] pdfKey =", pdfKey);
    await uploadPdfToS3(pdfBuffer, pdfKey);

    // 6) DBレコードを作成
    const reportId = nanoid(18); // 既存の仕様通り、DB上で一意IDを利用する
    const newReport = await createReport({
      company_id: lineUser.company_id,
      line_user_id: lineUser.line_user_id,
      report_json: req.body,
      s3_path: pdfKey,
      remarks: "multi-page PDF from 5 HTML",
      // DB に reportId を入れたいなら: report_id: reportId,
    });

    // 7) 企業にメール送信 (ある場合)
    if (company.email_address) {
      await sendMailWithSes({
        to: company.email_address,
        subject: "レポート作成完了",
        htmlBody: "<p>レポートを添付します</p>",
        pdfBuffer,
      });
      console.log(
        "[createReportController] Mail sent to",
        company.email_address
      );
    }

    return res.status(200).json({
      message: "Report created successfully",
      report: newReport,
    });
  } catch (err) {
    console.error("[createReportController] Error:", err);
    return res.status(500).json({ error: "Failed to create report" });
  }
}
