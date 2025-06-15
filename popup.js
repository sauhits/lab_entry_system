// Firebase関連の機能をインポート
import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

document.addEventListener("DOMContentLoaded", async () => {
  console.log(
    "ポップアップのDOM準備完了。Firebaseモードでメイン処理を開始します。"
  );
  const targetUrl = "https://gakujo.shizuoka.ac.jp/lcu-web/SC_10004B00_01";

  // 現在アクティブなタブの情報を取得
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // 現在のページのURLが、対象のURLと異なる場合
  if (tab.url !== targetUrl) {
    alert("この機能は大学の成績ページでのみ利用できます。");
    window.close(); // ポップアップを閉じる
    return; // これ以降の処理をすべて中断する
  }

  // --- URLが正しい場合のみ、以下の処理が実行される ---

  console.log("成績ページです。メイン機能を初期化します。");

  // --- HTML要素の取得 ---
  const labList = document.getElementById("lab-list");
  const submitButton = document.getElementById("submit-button");
  const entryStatus = document.getElementById("entry-status");
  const userIdInput = document.getElementById("user-id-input");
  const sendSpecialGpaButton = document.getElementById(
    "send-special-gpa-button"
  );

  let selectedLabId = null;
  let selectedLabName = null; // 選択した研究室名を保持する変数

  // --- イベントリスナーの設定 ---

  // 「特殊GPAを送信」ボタンのイベントリスナー（これは次のステップで修正）
  sendSpecialGpaButton.addEventListener("click", () => {
    const userId = userIdInput.value.trim();
    if (!userId) {
      alert("ユーザIDを入力してください。");
      return;
    }

    const specialGpaDisplay = document.getElementById("special-gpa-display");
    specialGpaDisplay.textContent = "計算・送信中...";

    chrome.tabs.sendMessage(
      tab.id, // 現在のタブIDを渡す
      {
        action: "calculateAndSendSpecialGpa",
        userId: userId,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError.message);
          specialGpaDisplay.textContent = "エラー";
          alert(
            "スクリプトとの通信に失敗しました。ページをリロードしてみてください。"
          );
          return;
        }

        if (response.success) {
          specialGpaDisplay.textContent = response.specialGpa;
          alert("特殊GPAの計算と送信が完了しました！");
        } else if (response.message === "duplicate") {
          specialGpaDisplay.textContent = "すでに書き込まれています";
        } else {
          specialGpaDisplay.textContent = "処理に失敗しました";
          alert(response.message || "不明なエラーが発生しました。");
        }
      }
    );
  });

  // 「この研究室にエントリーする」ボタンの処理
  submitButton.addEventListener("click", async () => {
    if (!selectedLabId) return;

    const studentId = "B123456"; // 本来は動的に取得

    try {
      // 1. 既にエントリー済みかFirebaseに問い合わせてチェック
      const entriesRef = collection(db, "entries");
      const q = query(entriesRef, where("studentId", "==", studentId));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // ドキュメントが1件でも見つかったら、それは重複
        alert("すでにエントリー済みです。一人一件しかエントリーできません。");
        fetchEntryStatus(); // UIを最新の状態に更新
        return;
      }

      // 2. エントリー情報をFirebaseに書き込み
      await addDoc(entriesRef, {
        studentId: studentId,
        labId: selectedLabId,
        labName: selectedLabName,
        status: "選考中",
        createdAt: serverTimestamp(), // 保存時のサーバー時刻を記録
      });

      alert("エントリーしました！");
      fetchEntryStatus(); // UIを最新の状態に更新
    } catch (error) {
      console.error("エントリー処理でエラー:", error);
      alert("エントリーに失敗しました。");
    }
  });

  // --- 関数の定義 ---

  async function fetchEntryStatus() {
    const studentId = "B123456";
    const entriesRef = collection(db, "entries");
    const q = query(entriesRef, where("studentId", "==", studentId));

    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      // エントリー情報が見つかった場合
      const entryData = querySnapshot.docs[0].data();
      entryStatus.textContent = `研究室: ${entryData.labName}, ステータス: ${entryData.status}`;
      // UIを操作不能にする
      labList.style.pointerEvents = "none";
      labList.style.opacity = 0.5;
      submitButton.disabled = true;
      submitButton.textContent = "エントリー済み";
    } else {
      // まだエントリーしていない場合
      entryStatus.textContent = "エントリー情報がありません";
      // UIを操作可能にする
      labList.style.pointerEvents = "auto";
      labList.style.opacity = 1;
      submitButton.textContent = "この研究室にエントリーする";
      submitButton.disabled = true;
    }
  }

  /**
   * Firebaseから研究室リストを取得して画面に表示する非同期関数
   */
  async function fetchLabs() {
    labList.textContent = "研究室リストを読み込み中...";
    try {
      // 'labs'コレクションへの参照を取得
      const labsCollectionRef = collection(db, "labs");

      // 'labs'コレクションのすべてのドキュメントを取得
      const querySnapshot = await getDocs(labsCollectionRef);

      labList.innerHTML = ""; // リストを一旦空にする

      querySnapshot.forEach((doc) => {
        const lab = doc.data(); // ドキュメントのデータを取得

        if (lab.isEntryOpen) {
          const li = document.createElement("li");
          li.textContent = lab.name;
          li.dataset.labId = lab.id;
          li.addEventListener("click", () => {
            // すべてのli要素の背景色をリセット
            document.querySelectorAll("#lab-list li").forEach((el) => {
              el.style.backgroundColor = "";
            });
            // クリックされたli要素の背景色を変更
            li.style.backgroundColor = "#e0e0e0";
            // 選択された研究室の情報を変数に保存
            selectedLabId = lab.id;
            selectedLabName = lab.name;
            // エントリーボタンを有効化
            submitButton.disabled = false;
            console.log(`選択した研究室: ${lab.name} (ID: ${lab.id})`);
          });
          labList.appendChild(li);
        }
      });

      if (labList.innerHTML === "") {
        labList.textContent = "エントリー可能な研究室はありません。";
      }
    } catch (error) {
      console.error("Firebaseからの研究室リスト取得エラー:", error);
      labList.textContent = "リストの読み込みに失敗しました。";
    }
  }

  // --- 初期化処理 ---
  fetchLabs();
  fetchEntryStatus();
});
