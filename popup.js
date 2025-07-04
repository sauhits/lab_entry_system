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
      sendSpecialGpaButton.disabled = true;
      specialGpaDisplay.textContent = "成績データ取得中...";
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        const targetUrl =
          "https://gakujo.shizuoka.ac.jp/lcu-web/SC_10004B00_01";
        if (activeTab.url !== targetUrl) {
          alert("この機能は大学の成績ページで実行してください。");
          specialGpaDisplay.textContent = "-";
          sendSpecialGpaButton.disabled = false;
          return;
        }

        console.log("ページをリロードします...");
        specialGpaDisplay.textContent = "ページをリロード中...";

        // リロード完了を監視するリスナー関数
        const listener = (tabId, changeInfo, tab) => {
          // 目的のタブのリロードが完了したかチェック
          if (tabId === activeTab.id && changeInfo.status === "complete") {
            // リスナーを一度実行したらすぐに削除する（重要）
            chrome.tabs.onUpdated.removeListener(listener);

            console.log("リロード完了。スクレイピングを開始します。");
            specialGpaDisplay.textContent = "成績データ取得中...";

            chrome.tabs.sendMessage(
              activeTab.id,
              { action: "scrapeGrades" },
              async (response) => {
                if (
                  chrome.runtime.lastError ||
                  !response ||
                  !response.success
                ) {
                  alert(
                    response?.message || "成績データの取得に失敗しました。"
                  );
                  console.error(
                    "成績データ取得のエラー:",
                    chrome.runtime.lastError || response
                  );
                  specialGpaDisplay.textContent = "-";
                  sendSpecialGpaButton.disabled = false;
                  return;
                }

                specialGpaDisplay.textContent = "計算・送信中...";
                const grades = response.data;

                try {
                  // 1. ハッシュ値を生成する
                  const filesToHash = ["popup.js", "content_script.js"];

                  // Promise.allを使って、全ファイルの読み込みを並列で実行
                  const fileContents = await Promise.all(
                    filesToHash.map((file) =>
                      fetch(chrome.runtime.getURL(file)).then((res) =>
                        res.text()
                      )
                    )
                  );

                  // 読み込んだファイルの中身をすべて結合
                  const combinedSource = fileContents.join("");
                  // 結合したソースコードからハッシュ値を生成
                  const sourceHash = await generateHash(combinedSource);

                  const author_uid = user.uid;
                  const specialGpaRef = collection(db, "special_gpa");
                  const q = query(
                    specialGpaRef,
                    where("author_uid", "==", author_uid)
                  );
                  const querySnapshot = await getDocs(q);

                  if (!querySnapshot.empty) {
                    // 重複が見つかった場合
                    alert("このアカウントの特殊GPAは既に登録されています。");
                    // 登録済みのGPAを取得・表示してUIを更新する
                    fetchSpecialGpaStatus();
                    return;
                  }

                  // 特殊GPAの計算
                  /**
                   * 1年次：1.2
                   * 2年次：1.4
                   *
                   * 必修科目：1.2
                   * 選択必修科目：1.4
                   * 選択科目：1.6
                   *
                   */
                  const firstYearIds = [
                    "76010050",
                    "76010070",
                    "76010010",
                    "76010030",
                    "76020090",
                    "77451010",
                    "77451020",
                    "77453010",
                    "77405020",
                    "77405010",
                  ];
                  const secondYearIds = [
                    "77401100",
                    "77451070",
                    "77451040",
                    "77401130",
                    "77401150",
                    "77451080",
                    "77401180",
                    "77451100",
                    "77451120",
                    "77451110",
                    "77453100",
                    "76020110",
                    "77403040",
                    "77453050",
                    "77453060",
                    "77453070",
                    "77453080",
                    "77403030",
                    "77453090",
                    "77405090",
                    "77405100",
                    "77455020",
                    "77455050",
                    "77405290",
                    "77455070",
                    "77455080",
                  ];
                  const R_courseIds = [
                    "76010050",
                    "76010010",
                    "76010030",
                    "76020090",
                    "77451010",
                    "77451020",
                    "77401100",
                    "77451070",
                    "77451040",
                    "77401130",
                    "77401150",
                    "77451080",
                    "77401180",
                    "77451100",
                    "77451120",
                    "77451110",
                  ];
                  const RS_courseIds = [
                    "76010070",
                    "77453010",
                    "77405020",
                    "77453100",
                    "76020110",
                    "77403040",
                    "77453050",
                    "77453060",
                    "77453070",
                    "77453080",
                    "77403030",
                    "77453090",
                  ];
                  const S_courseIds = [
                    "77405010",
                    "77405090",
                    "77405100",
                    "77455020",
                    "77455050",
                    "77405290",
                    "77455070",
                    "77455080",
                  ];

                  const multi_firstYear = 1.2;
                  const multi_secondYear = 1.4;
                  const multi_R = 1.0;
                  const multi_RS = 1.2;
                  const multi_S = 1.4;
                  let totalGp_credit = 0;
                  let totalCredits = 0;
                  grades.forEach((grade) => {
                    let gp = grade.GP;
                    let credit = grade.単位;

                    if (firstYearIds.includes(grade.科目id)) {
                      gp *= multi_firstYear;
                    } else if (secondYearIds.includes(grade.科目id)) {
                      gp *= multi_secondYear;
                    }

                    if (R_courseIds.includes(grade.科目id)) {
                      gp *= multi_R;
                    } else if (RS_courseIds.includes(grade.科目id)) {
                      gp *= multi_RS;
                    } else if (S_courseIds.includes(grade.科目id)) {
                      gp *= multi_S;
                    }
                    console.log(`${grade.科目名}:  ${grade.GP} -> ${gp}`);
                    totalCredits += credit;
                    totalGp_credit += gp * credit;
                  });
                  const specialGpa = (totalGp_credit / totalCredits).toFixed(3);
                  console.log(
                    `総単位数: ${totalCredits}, 特殊GPA: ${specialGpa}`
                  );

                  await addDoc(specialGpaRef, {
                    author_uid: author_uid,
                    specialGpa: parseFloat(specialGpa),
                    submittedAt: serverTimestamp(),
                    sec_hash: sourceHash,
                  });

                  specialGpaDisplay.textContent = specialGpa;
                  alert("特殊GPAの計算と送信が完了しました！");
                  fetchSpecialGpaStatus();
                } catch (error) {
                  console.error("特殊GPA処理でエラー:", error);
                  specialGpaDisplay.textContent = "処理に失敗しました";
                  alert("データベースへの書き込み中にエラーが発生しました。");
                  sendSpecialGpaButton.disabled = false;
                }
              }
            );
          }
        };
        // タブの更新を監視するリスナーを登録
        chrome.tabs.onUpdated.addListener(listener);
        // タブをリロード
        chrome.tabs.reload(activeTab.id);
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
        // 1. ハッシュ値を生成する
        const filesToHash = ["popup.js", "content_script.js"];

        // Promise.allを使って、全ファイルの読み込みを並列で実行
        const fileContents = await Promise.all(
          filesToHash.map((file) =>
            fetch(chrome.runtime.getURL(file)).then((res) => res.text())
          )
        );

        // 読み込んだファイルの中身をすべて結合
        const combinedSource = fileContents.join("");
        // 結合したソースコードからハッシュ値を生成
        const sourceHash = await generateHash(combinedSource);

        await addDoc(entriesRef, {
          author_uid: user.uid,
          labId: selectedLabId,
          labName: selectedLabName,
          status: "選考中",
          createdAt: serverTimestamp(),
          sec_hash: sourceHash,
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
            // capacityフィールドが存在すれば、定員も一緒に表示する
            if (lab.capacity) {
              li.textContent = `${lab.name} (定員: ${lab.capacity}名)`;
            } else {
              li.textContent = lab.name;
            }

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

    /**
     * 文字列をSHA-256ハッシュ化し、16進数文字列として返す非同期関数
     * @param {string} str - ハッシュ化する文字列
     * @returns {Promise<string>} - 計算されたハッシュ値
     */
    async function generateHash(str) {
      const encoder = new TextEncoder();
      const data = encoder.encode(str);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return hashHex;
    }

    // --- 初期化処理 ---
    fetchLabs();
    fetchEntryStatus();
    fetchSpecialGpaStatus(); // ★★★【追加】初期化時にGPAの状況も確認する
  }
});
