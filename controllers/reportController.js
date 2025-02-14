////////////////////////////////////////////////////
// controllers/reportController.js
////////////////////////////////////////////////////
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { nanoid } from "nanoid";

import { generatePdfFromHtml } from "../services/pdfGenerator.js";
import { uploadPdfToS3 } from "../services/s3Upload.js";
import { createReport } from "../db/reports.js";
import { getLineUserByConversation } from "../db/lineUsers.js";
import { getCompanyById } from "../db/companies.js";
import { sendMailWithSes } from "../services/sendMail.js";

/**
 * ESM環境で __dirname 相当を使うための設定
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * POST /report/create
 *
 * 1) まず conversation_id などで lineUser/Company を特定
 * 2) templates/report1.html ~ report5.html の5つを読み込み
 * 3) HTMLを結合（ページ区切り）→ 1つのPDFに変換
 * 4) S3にアップし、メール送信
 */
export async function createReportController(req, res) {
  try {
    // 例: conversation_id で lineUser を探す実装（必要に応じて修正）
    const { conversation_id } = req.body;
    if (!conversation_id) {
      return res.status(400).json({ error: "No conversation_id provided" });
    }

    // 1) DB検索: lineUser
    const lineUser = await getLineUserByConversation(conversation_id);
    if (!lineUser) {
      return res.status(400).json({
        error: `No lineUser found for conversation_id=${conversation_id}`,
      });
    }

    // 2) 企業取得
    const company = await getCompanyById(lineUser.company_id);
    if (!company) {
      return res.status(400).json({
        error: "No company found for that lineUser",
      });
    }

    // 3) 5つのHTMLを順番に読み込み & 結合
    //    それぞれの間に <div style="page-break-before: always;"></div> で改ページ
    const htmlParts = [];
    for (let i = 1; i <= 5; i++) {
      const filePath = join(__dirname, `../templates/report${i}.html`);
      console.log(`[createReportController] Reading: ${filePath}`);
      // ファイル存在しない場合はENOENT → 要注意
      const fileSrc = fs.readFileSync(filePath, "utf-8");
      htmlParts.push(fileSrc);

      // 4ファイルの後には page-break、最後には不要
      if (i < 5) {
        htmlParts.push('<div style="page-break-before: always;"></div>');
      }
    }

    // 結合
    const combinedHtml = htmlParts.join("\n");

    // 4) PDF生成
    //    generatePdfFromHtml は puppeteer等でHTML→PDF (A4ページ)
    const pdfBuffer = await generatePdfFromHtml(combinedHtml);

    // 5) S3にアップロード
    const reportId = nanoid(18);
    const pdfKey = `reports/${reportId}.pdf`;
    await uploadPdfToS3(pdfBuffer, pdfKey);

    // 6) DBに reports レコード生成
    //    ここでは req.body 全体を report_json に格納例
    const newReport = await createReport({
      company_id: lineUser.company_id,
      line_user_id: lineUser.line_user_id,
      report_json: req.body,
      s3_path: pdfKey,
      remarks: "Combined 5 HTML into 1 PDF",
    });

    // 7) メール送信 (PDF添付)
    if (company.email_address) {
      const htmlBody = "<p>5つのHTMLを結合したレポートを添付します。</p>";
      await sendMailWithSes({
        to: company.email_address,
        subject: "複数レポートPDF送付",
        htmlBody,
        pdfBuffer,
      });
      console.log(
        "[createReportController] Mail sent to",
        company.email_address
      );
    } else {
      console.warn(
        `[createReportController] Company ${company.company_id} has no email_address`
      );
    }

    return res.status(200).json({
      message:
        "Report created from 5 HTML files, PDF stored in S3, and mail sent",
      report: newReport,
    });
  } catch (err) {
    console.error("Error in createReportController:", err);
    return res
      .status(500)
      .json({ error: "Failed to create multi-page PDF report" });
  }
}
