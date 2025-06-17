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
  // HTML要素の取得（ログイン画面）
  const loginView = document.getElementById("login-view");
  const mainView = document.getElementById("main-view");
  const loginButton = document.getElementById("login-button");

  // ログイン処理
  loginButton.addEventListener("click", () => {
    const loginEmail = document.getElementById("login-email");
    const loginPassword = document.getElementById("login-password");
    const loginError = document.getElementById("login-error");
    const email = loginEmail.value;
    const password = loginPassword.value;
    loginError.textContent = "";
    signInWithEmailAndPassword(auth, email, password).catch((error) => {
      loginError.textContent = "メールアドレスまたはパスワードが違います。";
    });
  });

  // 認証状態を監視し、UIを切り替えるリスナー
  onAuthStateChanged(auth, (user) => {
    if (user) {
      loginView.style.display = "none";
      mainView.style.display = "block";
      initializeMainFeatures(user);
    } else {
      loginView.style.display = "block";
      mainView.style.display = "none";
    }
  });

  /**
   * ログイン後にメイン機能を初期化する関数
   */
  function initializeMainFeatures(user) {
    console.log(`${user.email} (${user.uid}) のための機能を開始します。`);

    // --- メイン機能で使うHTML要素の取得 ---
    const userEmailDisplay = document.getElementById("user-email-display");
    const logoutButton = document.getElementById("logout-button");
    const labList = document.getElementById("lab-list");
    const submitButton = document.getElementById("submit-button");
    const entryStatus = document.getElementById("entry-status");
    const sendSpecialGpaButton = document.getElementById(
      "send-special-gpa-button"
    );
    const specialGpaDisplay = document.getElementById("special-gpa-display");
    let selectedLabId = null;
    let selectedLabName = null;

    userEmailDisplay.textContent = user.email;
    logoutButton.addEventListener("click", () => signOut(auth));

    // --- 「特殊GPAを計算・送信」ボタンの処理 ---
    sendSpecialGpaButton.addEventListener("click", () => {
      specialGpaDisplay.textContent = "成績データ取得中...";
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        const targetUrl =
          "https://gakujo.shizuoka.ac.jp/lcu-web/SC_10004B00_01";
        if (activeTab.url !== targetUrl) {
          alert("この機能は大学の成績ページで実行してください。");
          console.log(
            `現在のURL: ${activeTab.url}、期待されるURL: ${targetUrl}`
          );
          specialGpaDisplay.textContent = "-";
          return;
        }

        chrome.tabs.sendMessage(
          activeTab.id,
          { action: "scrapeGrades" },
          async (response) => {
            if (chrome.runtime.lastError || !response || !response.success) {
              alert(response?.message || "成績データの取得に失敗しました。");
              console.error(
                "成績データ取得のエラー:",
                chrome.runtime.lastError || response
              );
              specialGpaDisplay.textContent = "-";
              return;
            }

            specialGpaDisplay.textContent = "計算・送信中...";
            const grades = response.data;

            try {
              const author_uid = user.uid;
              const specialGpaRef = collection(db, "special_gpa");
              const q = query(
                specialGpaRef,
                where("author_uid", "==", author_uid)
              );
              const querySnapshot = await getDocs(q);

              if (!querySnapshot.empty) {
                specialGpaDisplay.textContent = "すでに書き込まれています";
                return;
              }

              const specialCourseIds = ["T2-ENG101", "T2-SCI203", "SPEC999"];
              const multiplier = 1.5;
              let totalPoints = 0;
              grades.forEach((grade) => {
                let point = grade.GP;
                if (specialCourseIds.includes(grade.科目id)) {
                  point *= multiplier;
                }
                totalPoints += point;
              });
              const specialGpa = (totalPoints / grades.length).toFixed(3);

              await addDoc(specialGpaRef, {
                author_uid: author_uid,
                specialGpa: parseFloat(specialGpa),
                submittedAt: serverTimestamp(),
              });

              specialGpaDisplay.textContent = specialGpa;
              alert("特殊GPAの計算と送信が完了しました！");
            } catch (error) {
              console.error("特殊GPA処理でエラー:", error);
              specialGpaDisplay.textContent = "処理に失敗しました";
              alert("データベースへの書き込み中にエラーが発生しました。");
            }
          }
        );
      });
    });

    // --- 「研究室にエントリー」関連の処理 ---
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

        const labs = [];
        querySnapshot.forEach((doc) => {
          labs.push(doc.data());
        });

        console.log("Firebaseから取得した研究室データ:", labs);

        labList.innerHTML = ""; // リストを一旦空にする

        labs.forEach((lab) => {
          if (lab.isEntryOpen) {
            const li = document.createElement("li");

            if (lab.capacity) {
              li.textContent = `${lab.name} (定員: ${lab.capacity}名)`;
            } else {
              li.textContent = lab.name;
            }

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

    // =======================【ここから関数を追加】=======================
    /**
     * ログインユーザーの特殊GPA登録状況を確認し、UIを更新する関数
     */
    async function fetchSpecialGpaStatus() {
      const specialGpaRef = collection(db, "special_gpa");
      const q = query(specialGpaRef, where("author_uid", "==", user.uid));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // データが存在する場合
        const gpaData = querySnapshot.docs[0].data();
        specialGpaDisplay.textContent = gpaData.specialGpa.toFixed(3); // 取得した値を表示
        sendSpecialGpaButton.disabled = true;
        sendSpecialGpaButton.textContent = "送信済み";
      } else {
        // データが存在しない場合
        specialGpaDisplay.textContent = "-";
        sendSpecialGpaButton.disabled = false;
        sendSpecialGpaButton.textContent = "特殊GPAを計算・送信";
      }
    }
    // =======================【ここまで関数を追加】=======================

    // --- 初期化処理 ---
    fetchLabs();
    fetchEntryStatus();
    fetchSpecialGpaStatus(); // ★★★【追加】初期化時にGPAの状況も確認する
  }
});
