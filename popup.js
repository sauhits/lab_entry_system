// Firebase関連の機能をインポート
import { db, auth } from "./firebase-config.js";
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

document.addEventListener("DOMContentLoaded", () => {
  // --- HTML要素の取得（ログイン画面） ---
  const loginView = document.getElementById("login-view");
  const mainView = document.getElementById("main-view");
  const loginEmail = document.getElementById("login-email");
  const loginPassword = document.getElementById("login-password");
  const loginButton = document.getElementById("login-button");
  const loginError = document.getElementById("login-error");

  // --- ログイン処理 ---
  loginButton.addEventListener("click", () => {
    const email = loginEmail.value;
    const password = loginPassword.value;
    loginError.textContent = ""; // エラーメッセージをクリア

    signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        // ログイン成功
        console.log("ログイン成功:", userCredential.user);
        // UIの切り替えはonAuthStateChangedが自動で行う
      })
      .catch((error) => {
        // ログイン失敗
        console.error("ログインエラー:", error);
        loginError.textContent = "メールアドレスまたはパスワードが違います。";
      });
  });

  // ======================================================================
  // ★★★ 認証状態を監視し、UIを切り替えるリスナー ★★★
  // ======================================================================
  onAuthStateChanged(auth, (user) => {
    if (user) {
      // --- ログインしている場合の処理 ---
      loginView.style.display = "none";
      mainView.style.display = "block";
      initializeMainFeatures(user); // ★メイン機能を呼び出す
    } else {
      // --- ログアウトしている場合の処理 ---
      loginView.style.display = "block";
      mainView.style.display = "none";
    }
  });

  /**
   * メインの機能（研究室リスト取得など）を初期化する関数
   * @param {object} user - ログインしているユーザーの情報
   */
  async function initializeMainFeatures(user) {
    console.log(`${user.email} (${user.uid}) のための機能を開始します。`);

    // --- メイン機能で使うHTML要素の取得 ---
    const userEmailDisplay = document.getElementById("user-email-display");
    const logoutButton = document.getElementById("logout-button");
    const labList = document.getElementById("lab-list");
    const submitButton = document.getElementById("submit-button");
    const entryStatus = document.getElementById("entry-status");
    const userIdInput = document.getElementById("user-id-input");
    const sendSpecialGpaButton = document.getElementById(
      "send-special-gpa-button"
    );
    let selectedLabId = null;
    let selectedLabName = null;

    // ログインユーザー情報を表示
    userEmailDisplay.textContent = user.email;

    // --- イベントリスナーの設定 ---
    logoutButton.addEventListener("click", () => signOut(auth));

    sendSpecialGpaButton.addEventListener("click", async () => {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      // 成績ページかどうかのチェック
      const targetUrl = "https://gakujo.shizuoka.ac.jp/lcu-web/SC_10004B00_01";
      if (tab.url !== targetUrl) {
        alert("この機能は大学の成績ページで実行してください。");
        return;
      }

      // ユーザーID（この場合は認証ユーザーのUIDを使用するのが望ましい）
      // ここでは入力されたIDをそのまま使います
      const customUserId = userIdInput.value.trim();
      if (!customUserId) {
        alert("ユーザIDを入力してください。");
        return;
      }

      const specialGpaDisplay = document.getElementById("special-gpa-display");
      specialGpaDisplay.textContent = "計算・送信中...";

      chrome.tabs.sendMessage(
        tab.id,
        { action: "calculateAndSendSpecialGpa", userId: customUserId },
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

    submitButton.addEventListener("click", async () => {
      if (!selectedLabId) return;
      try {
        const entriesRef = collection(db, "entries");
        const q = query(entriesRef, where("author_uid", "==", user.uid));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          alert("すでにエントリー済みです。一人一件しかエントリーできません。");
          return;
        }

        await addDoc(entriesRef, {
          author_uid: user.uid,
          labId: selectedLabId,
          labName: selectedLabName,
          status: "選考中",
          createdAt: serverTimestamp(),
        });
        alert("エントリーしました！");
        fetchEntryStatus();
      } catch (error) {
        console.error("エントリー処理でエラー:", error);
        alert("エントリーに失敗しました。");
      }
    });

    // --- 関数の定義 ---
    async function fetchEntryStatus() {
      const entriesRef = collection(db, "entries");
      const q = query(entriesRef, where("author_uid", "==", user.uid));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const entryData = querySnapshot.docs[0].data();
        entryStatus.textContent = `研究室: ${entryData.labName}, ステータス: ${entryData.status}`;
        labList.style.pointerEvents = "none";
        labList.style.opacity = 0.5;
        submitButton.disabled = true;
        submitButton.textContent = "エントリー済み";
      } else {
        entryStatus.textContent = "エントリー情報がありません";
        labList.style.pointerEvents = "auto";
        labList.style.opacity = 1;
        submitButton.textContent = "この研究室にエントリーする";
        submitButton.disabled = true;
      }
    }

    async function fetchLabs() {
      labList.textContent = "研究室リストを読み込み中...";
      try {
        const labsCollectionRef = collection(db, "labs");
        const querySnapshot = await getDocs(labsCollectionRef);
        labList.innerHTML = "";

        querySnapshot.forEach((doc) => {
          const lab = doc.data();
          if (lab.isEntryOpen) {
            const li = document.createElement("li");
            li.textContent = lab.name;
            li.addEventListener("click", () => {
              document.querySelectorAll("#lab-list li").forEach((el) => {
                el.style.backgroundColor = "";
              });
              li.style.backgroundColor = "#e0e0e0";
              selectedLabId = lab.id;
              selectedLabName = lab.name;
              submitButton.disabled = false;
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
  }
});
