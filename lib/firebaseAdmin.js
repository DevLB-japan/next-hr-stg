// lib/firebaseAdmin.js

import admin from "firebase-admin";

// 環境変数からサービスアカウントJSONをパース
const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY || "{}"
);

// すでに初期化されていない場合のみ初期化
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// Firestoreインスタンスを取得
const db = admin.firestore();

// 必要があれば他のサービス (Storage 等) もここで取得できる
// const storage = admin.storage();

export { db };
