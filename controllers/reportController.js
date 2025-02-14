////////////////////////////////////////////////////
// controllers/reportController.js
////////////////////////////////////////////////////
import fs from "fs";
import path from "path";
import Handlebars from "handlebars";
import { nanoid } from "nanoid";

import { generatePdfFromHtml } from "../services/pdfGenerator.js";
import { uploadPdfToS3 } from "../services/s3Upload.js";
import { createReport } from "../db/reports.js";
import { getLineUserByConversation } from "../db/lineUsers.js"; // ★要：conversation_idからlineUser取得
import { getCompanyById } from "../db/companies.js";
import { sendMailWithSes } from "../services/sendMail.js";

/**
 * POST /report/create
 * Difyなどから会話の情報とレポートデータを受け取り、PDF生成・S3保存・メール送信する。
 *
 * 期待するJSON例:
 * {
 *   "conversation_id": "97e33f11-67b5-4dd4-80ba-98c17e8ad1f5",
 *   "basic_info": {...},
 *   "ai_questions": {...},
 *   "match_analysis": {...},
 *   "personality_analysis": {...},
 *   "recommended_actions": {...}
 *   // 必要な追加フィールドもOK
 * }
 *
 * ここでは例として "dataA, dataB" のようなフィールドを使う場合を記載。
 * 実際にはDifyから送られるJSONを適宜パースして使用してください。
 */
export async function createReportController(req, res) {
  try {
    // 1) リクエストボディから conversation_id を取得
    const {
      conversation_id,
      basic_info,
      ai_questions,
      match_analysis,
      personality_analysis,
      recommended_actions,
    } = req.body;

    // ★ conversation_id が無い場合はエラー
    if (!conversation_id) {
      return res.status(400).json({ error: "No conversation_id provided" });
    }

    // 2) lineUser を conversation_id で検索
    //    ここでは line_users テーブルに 'conversation_id' カラムがある前提です
    const lineUser = await getLineUserByConversation(conversation_id);
    if (!lineUser) {
      return res
        .status(400)
        .json({ error: "No lineUser found for the given conversation_id" });
    }

    // 3) 企業（company） を取得
    const company = await getCompanyById(lineUser.company_id);
    if (!company) {
      return res
        .status(400)
        .json({ error: "No company found for that lineUser" });
    }

    // 4) テンプレートHTML読み込み
    //    テンプレファイル (reportTemplate.html) は適宜準備してください
    const templatePath = path.join(
      process.cwd(),
      "templates",
      "reportTemplate.html"
    );
    const templateSrc = fs.readFileSync(templatePath, "utf-8");
    const template = Handlebars.compile(templateSrc);

    // ★ 必要に応じて Difyからのデータ(basic_infoなど) をHTMLに差し込み
    const htmlContext = {
      basic_info,
      ai_questions,
      match_analysis,
      personality_analysis,
      recommended_actions,
    };
    const htmlString = template(htmlContext);

    // 5) PDF生成
    const pdfBuffer = await generatePdfFromHtml(htmlString); // puppeteer等でHTML→PDF

    // 6) S3にアップロード (例: /services/s3Upload.js)
    const reportId = nanoid(18);
    const pdfKey = `reports/${reportId}.pdf`;
    await uploadPdfToS3(pdfBuffer, pdfKey);

    // 7) DBにレポートを登録
    //    ここでは sampleとして match_analysis などをまとめて JSONに入れる例
    const newReport = await createReport({
      company_id: lineUser.company_id,
      line_user_id: lineUser.line_user_id, // line_usersのPK
      report_json: {
        basic_info,
        ai_questions,
        match_analysis,
        personality_analysis,
        recommended_actions,
      },
      s3_path: pdfKey,
      remarks: "レポート生成 & S3格納 with conversation_id",
    });

    // 8) メール送信 (SESでPDF添付)
    if (company.email_address) {
      const htmlBody = "<p>レポートを添付いたします。</p>";
      await sendMailWithSes({
        to: company.email_address,
        subject: "レポート作成完了",
        htmlBody,
        pdfBuffer,
      });
      console.log(
        "[createReportController] Mail sent to",
        company.email_address
      );
    } else {
      console.warn(
        `[createReportController] Company ${company.company_id} has no email_address, skipping mail.`
      );
    }

    return res.status(200).json({
      message: "Report created, PDF stored in S3, and mail sent",
      report: newReport,
    });
  } catch (err) {
    console.error("Error in createReportController:", err);
    return res.status(500).json({ error: "Failed to create report" });
  }
}
