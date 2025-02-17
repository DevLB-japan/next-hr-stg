////////////////////////////////////////////////////
// services/s3Upload.js
////////////////////////////////////////////////////
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import dotenv from "dotenv";
dotenv.config();

/**
 * 企業のID(companyId) フォルダが無ければ作成し、
 * そこに line_user_id.pdf をアップロードする。
 *
 * @param {Buffer} pdfBuffer - PDFのバイナリデータ
 * @param {string} companyId - companies.company_id (フォルダ名として使用)
 * @param {string} lineUserId - line_users.line_user_id (PDFファイル名として使用)
 * @returns {string} アップロードしたS3オブジェクトキー
 */
export async function uploadPdfToS3(pdfBuffer, companyId, lineUserId) {
  const bucketName = process.env.S3_BUCKET_NAME;
  if (!bucketName) {
    throw new Error("S3_BUCKET_NAME not set");
  }

  const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    // IAMロールなどでS3への権限が設定されている前提
  });

  // S3上のフォルダに相当する "reports/{companyId}/"
  //   → S3では “プレフィックス” と呼ぶ
  const folderPrefix = `reports/${companyId}/`;

  // 1) フォルダ(プレフィックス)が既にあるかどうかを調べる
  try {
    const listCmd = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: folderPrefix,
      MaxKeys: 1, // 1件でもあればフォルダはあるとみなす
    });
    const listData = await s3Client.send(listCmd);

    // listData.Contentsがあればフォルダに相当するオブジェクトがある
    const folderAlreadyExists =
      listData.Contents && listData.Contents.length > 0;

    // 2) 無ければ 空オブジェクト "reports/{companyId}/" を置いてフォルダを作る
    if (!folderAlreadyExists) {
      console.log(
        `[uploadPdfToS3] Creating folder prefix for company ${companyId}...`
      );
      const createFolderCmd = new PutObjectCommand({
        Bucket: bucketName,
        Key: folderPrefix, // 末尾に '/' でフォルダっぽく見える
        Body: "", // 空ファイル
      });
      await s3Client.send(createFolderCmd);
      console.log("[uploadPdfToS3] Folder prefix created:", folderPrefix);
    }
  } catch (err) {
    console.warn("[uploadPdfToS3] Error checking/creating folder prefix:", err);
    // フォルダ作成失敗しても、続行は可能（S3にオブジェクトアップロードすれば擬似的に作られる）
  }

  // 3) lineUserId.pdf という名前でPDFをアップロード
  const pdfKey = `${folderPrefix}${lineUserId}.pdf`;
  console.log(`[uploadPdfToS3] Uploading PDF => s3://${bucketName}/${pdfKey}`);

  const putParams = {
    Bucket: bucketName,
    Key: pdfKey,
    Body: pdfBuffer,
    ContentType: "application/pdf",
  };

  await s3Client.send(new PutObjectCommand(putParams));

  // 4) 完了
  console.log("[uploadPdfToS3] Uploaded to:", pdfKey);
  return pdfKey;
}
