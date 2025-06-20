// このファイルは、Firestoreに関する共通の操作をまとめたユーティリティです。

import { db } from "./firebase-config.js";
import { collection, getDocs, query, where, addDoc } from "firebase/firestore";

/**
 * 指定されたコレクション内で、特定のフィールドが指定された値を持つドキュメントが存在するかチェックします。
 * @param {string} collectionName - チェックするコレクションの名前
 * @param {string} fieldName - チェックするフィールドの名前
 * @param {any} value - チェックする値
 * @returns {Promise<boolean>} - 重複が存在すればtrue、しなければfalseを返す
 */
export async function doesDocumentExist(collectionName, fieldName, value) {
  const collectionRef = collection(db, collectionName);
  const q = query(collectionRef, where(fieldName, "==", value));
  const querySnapshot = await getDocs(q);
  return !querySnapshot.empty; // ドキュメントが1件でもあればtrue
}

/**
 * 指定されたコレクションに新しいドキュメントを追加します。
 * @param {string} collectionName - 追加先のコレクションの名前
 * @param {object} data - 追加するデータオブジェクト
 * @returns {Promise<DocumentReference>} - 追加されたドキュメントへの参照
 */
export async function addData(collectionName, data) {
  const collectionRef = collection(db, collectionName);
  return await addDoc(collectionRef, data);
}
