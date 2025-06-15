// Firebase関連の機能をインポート
// Webpackがビルド時に合体させてくれるので、content_scriptでもimportが使えます
import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

/**
 * 画面に表示されている成績テーブルからデータを抽出し、整形する関数
 */
function scrapeGradeData() {
  const rows = document.querySelectorAll('table[id="02"] tbody tr');
  const formattedData = [];

  rows.forEach((row) => {
    const cells = row.querySelectorAll("td");

    // ユーザーが変更した列のインデックスを反映
    const kamokuId = cells[0]?.textContent.trim();
    let kamokuName = cells[1]?.textContent.trim();
    const tanni = cells[5]?.textContent.trim();
    const gp = cells[8]?.textContent.trim();

    if (kamokuName) {
      // 科目名の先頭にある可能性のある記号（+や-、スペース、タブなど）を削除
      kamokuName = kamokuName.replace(/^[+\-\s\t]+/, "");
    }

    if (kamokuId && kamokuName && gp) {
      formattedData.push({
        科目id: kamokuId,
        科目名: kamokuName,
        単位: parseFloat(tanni),
        GP: parseFloat(gp),
      });
    }
  });
  return formattedData;
}

/**
 * 特殊GPAを計算してFirebaseに送信し、結果を返す非同期関数
 * @param {string} userId - ポップアップから受け取ったユーザID
 * @return {Promise<Object>} 処理結果
 */
async function calculateAndSendSpecialGpa(userId) {
  try {
    // 1. Firebaseに重複ユーザIDがないかチェック
    const specialGpaRef = collection(db, "special_gpa");
    const q = query(specialGpaRef, where("userId", "==", userId));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      console.log("重複IDが見つかりました:", userId);
      return { success: false, message: "duplicate" };
    }

    // 2. 重複がなければ、成績データを取得して特殊GPAを計算
    const specialCourseIds = ["T2-ENG101", "T2-SCI203", "SPEC999"];
    const multiplier = 1.5;

    const grades = scrapeGradeData();
    if (grades.length === 0) {
      return { success: false, message: "成績データが見つかりませんでした。" };
    }

    let totalPoints = 0;
    grades.forEach((grade) => {
      let point = grade.GP;
      if (specialCourseIds.includes(grade.科目id)) {
        point *= multiplier;
      }
      totalPoints += point;
    });

    const specialGpa = (totalPoints / grades.length).toFixed(3);
    console.log(`計算された特殊GPA: ${specialGpa}`);

    // 3. 計算結果をFirebaseに保存
    await addDoc(specialGpaRef, {
      userId: userId,
      specialGpa: parseFloat(specialGpa), // 数値として保存
      submittedAt: serverTimestamp(),
    });

    console.log("特殊GPAの保存に成功");
    return { success: true, message: "送信成功", specialGpa: specialGpa };
  } catch (error) {
    console.error("特殊GPA処理でエラー:", error);
    return { success: false, message: "処理中にエラーが発生しました。" };
  }
}

/**
 * ポップアップからのメッセージを受け取るリスナー
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "calculateAndSendSpecialGpa") {
    console.log(
      "ポップアップから計算依頼を受け取りました。UserID:",
      request.userId
    );
    // calculateAndSendSpecialGpa は Promise を返すので、thenで結果を待ってからsendResponseを呼ぶ
    calculateAndSendSpecialGpa(request.userId).then(sendResponse);
  }
  return true; // 非同期でsendResponseを呼ぶことを示す
});
