////////////////////////////////////////////////////
// /services/s3Upload.js
////////////////////////////////////////////////////
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
dotenv.config();

/**
 * S3にPDFをアップロード
 * @param {Buffer} pdfBuffer - PDFのバイナリ
 * @param {string} key - S3オブジェクトキー (例: "reports/report-xxx.pdf")
 * @returns {string} アップロードしたオブジェクトキー
 */
export async function uploadPdfToS3(pdfBuffer, key) {
  const bucketName = process.env.S3_BUCKET_NAME;
  if (!bucketName) {
    throw new Error("S3_BUCKET_NAME not set");
  }

  const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    // IAMロールに権限がある前提
  });

  const params = {
    Bucket: bucketName,
    Key: key,
    Body: pdfBuffer,
    ContentType: "application/pdf",
  };

  await s3Client.send(new PutObjectCommand(params));
  return key;
}
