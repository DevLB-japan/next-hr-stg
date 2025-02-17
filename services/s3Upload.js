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

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
});

// “フォルダ”= "reports/{company_id}/" のようなS3プレフィックスがあるか確認し、
// なければ空オブジェクトをアップロードして作成する
export async function ensureFolderExists(folderPrefix) {
  try {
    const bucketName = process.env.S3_BUCKET_NAME;
    if (!bucketName) {
      throw new Error("S3_BUCKET_NAME not set");
    }

    // 1) フォルダが存在するか確かめる
    const listCmd = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: folderPrefix,
      MaxKeys: 1,
    });
    const listResp = await s3Client.send(listCmd);

    const folderAlreadyExists =
      listResp.Contents && listResp.Contents.length > 0;
    if (!folderAlreadyExists) {
      console.log("[ensureFolderExists] Creating folder:", folderPrefix);

      // 2) フォルダらしく見せるための空オブジェクト
      const putCmd = new PutObjectCommand({
        Bucket: bucketName,
        Key: folderPrefix, // 末尾が '/' でもOK
        Body: "",
      });
      await s3Client.send(putCmd);
    }
  } catch (err) {
    console.warn(
      "[ensureFolderExists] Something went wrong, but continuing:",
      err
    );
  }
}

// PDFをアップロード
export async function uploadPdfToS3(pdfBuffer, key) {
  const bucketName = process.env.S3_BUCKET_NAME;
  if (!bucketName) {
    throw new Error("S3_BUCKET_NAME not set");
  }
  const putParams = {
    Bucket: bucketName,
    Key: key,
    Body: pdfBuffer,
    ContentType: "application/pdf",
  };
  await s3Client.send(new PutObjectCommand(putParams));
  console.log("[uploadPdfToS3] Uploaded =>", `s3://${bucketName}/${key}`);
  return key;
}
