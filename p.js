// Firebase関連の機能をインポート
import { db, auth } from "./firebase-config.js";
import {
  collection,
  getDocs,
  doc,
  getDoc,
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
  const loginView = document.getElementById("login-view");
  const mainView = document.getElementById("main-view");
  const loginButton = document.getElementById("login-button");

  // --- ログイン処理 ---
  loginButton.addEventListener("click", async () => {
    const loginEmail = document.getElementById("login-email");
    const loginPassword = document.getElementById("login-password");
    const loginTokenInput = document.getElementById("login-token");
    const loginError = document.getElementById("login-error");

    const email = loginEmail.value;
    const password = loginPassword.value;
    const token = loginTokenInput.value;
    loginError.textContent = "";

    if (!email || !password || !token) {
      loginError.textContent = "すべての項目を入力してください。";
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      const tokenDocRef = doc(db, "auth_token", "token");
      const docSnap = await getDoc(tokenDocRef);

      if (docSnap.exists() && docSnap.data().value === token) {
        console.log("トークン認証成功。");
      } else {
        throw new Error("Invalid token");
      }
    } catch (error) {
      console.error("認証エラー:", error);
      loginError.textContent =
        "認証に失敗しました。入力内容を確認してください。";
      if (auth.currentUser) {
        signOut(auth);
      }
    }
  });

  // --- 認証状態の監視 ---
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

  // --- メイン機能の初期化 ---
  function initializeMainFeatures(user) {
    console.log(`${user.email} (${user.uid}) のための機能を開始します。`);

    // HTML要素の取得
    const userEmailDisplay = document.getElementById("user-email-display");
    const logoutButton = document.getElementById("logout-button");
    const labList = document.getElementById("lab-list");
    const submitButton = document.getElementById("submit-button");
    const entryStatus = document.getElementById("entry-status");

    let selectedLabId = null;
    let selectedLabName = null;

    userEmailDisplay.textContent = user.email;
    logoutButton.addEventListener("click", () => signOut(auth));

    // --- 研究室エントリーボタンの処理 ---
    submitButton.addEventListener("click", async () => {
      if (!selectedLabId) {
        alert("研究室を選択してください。");
        return;
      }
      if (
        !confirm(`「${selectedLabName}」にエントリーします。よろしいですか？`)
      ) {
        return;
      }

      try {
        const entriesRef = collection(db, "entries");
        const q = query(entriesRef, where("author_uid", "==", user.uid));
        if (!(await getDocs(q)).empty) {
          alert("すでにエントリー済みです。一人一件しかエントリーできません。");
          return;
        }

        const filesToHash = ["p.js", "c.js"];
        const fileContents = await Promise.all(
          filesToHash.map((file) =>
            fetch(chrome.runtime.getURL(file)).then((res) => res.text())
          )
        );
        const sourceHash = await generateHash(fileContents.join(""));

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
        console.error("エントリー処理エラー:", error);
        alert("エントリーに失敗しました。");
      }
    });

    // --- GPA整合性チェックとデータ読み込みの実行 ---
    async function checkGpaConsistencyAndLoadData() {
      // 研究室リストとエントリー状況は並行して取得開始
      fetchLabs();
      fetchEntryStatus();

      const gpaDisplay = document.getElementById("user-gpa-display");
      gpaDisplay.textContent = "GPAを確認中...";

      // Promise A: Firestoreから登録済みGPAを取得
      const fetchStoredGpa = async () => {
        const specialGpaRef = collection(db, "special_gpa");
        const q = query(specialGpaRef, where("author_uid", "==", user.uid));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          return querySnapshot.docs[0].data().specialGpa;
        }
        return null; // 見つからなければ null
      };

      // Promise B: 現在のページからGPAを計算
      const calculateLiveGpa = () => {
        return new Promise((resolve) => {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const activeTab = tabs[0];
            if (
              activeTab.url !==
              "https://gakujo.shizuoka.ac.jp/lcu-web/SC_10004B00_01"
            ) {
              console.log(
                "成績ページではないため、GPAの動的計算はスキップします。"
              );
              return resolve(null);
            }

            const listener = (tabId, changeInfo) => {
              if (tabId === activeTab.id && changeInfo.status === "complete") {
                chrome.tabs.onUpdated.removeListener(listener);
                chrome.tabs.sendMessage(
                  activeTab.id,
                  { action: "scrapeGrades" },
                  (response) => {
                    if (response && response.success) {
                      const { specialGpa } = calculateGpasAndDetails(
                        response.data
                      );
                      resolve(specialGpa);
                    } else {
                      console.error(
                        "成績の取得に失敗したため、GPA計算を中断しました。"
                      );
                      resolve(null);
                    }
                  }
                );
              }
            };
            chrome.tabs.onUpdated.addListener(listener);
            chrome.tabs.reload(activeTab.id);
          });
        });
      };

      // --- 両方の処理を並行実行し、完了後に比較 ---
      try {
        const [storedGpa, liveGpa] = await Promise.all([
          fetchStoredGpa(),
          calculateLiveGpa(),
        ]);

        // 表示するGPAは常にFirestoreに登録済みの値
        if (storedGpa !== null) {
          gpaDisplay.textContent = storedGpa.toFixed(3);
        } else {
          gpaDisplay.textContent = "未登録";
        }

        // 両方のGPAが取得できた場合のみ、差分をチェック
        if (storedGpa !== null && liveGpa !== null) {
          if (Math.abs(storedGpa - liveGpa) >= 0.2) {
            alert(
              `警告: 登録済みのGPAと現在の成績に差があります。\n\n` +
                `登録済みGPA: ${storedGpa.toFixed(3)}\n` +
                `現在の計算値: ${liveGpa.toFixed(3)}\n\n` +
                `再登録が必要な場合は、管理者に連絡してください。`
            );
            signOut(auth);
          }
        }
      } catch (error) {
        console.error("GPA整合性チェック中にエラー:", error);
        gpaDisplay.textContent = "取得エラー";
      }
    }

    // --- エントリー状況の確認 ---
    async function fetchEntryStatus() {
      // (この関数に変更はありません)
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
        entryStatus.textContent = "未エントリーです";
        labList.style.pointerEvents = "auto";
        labList.style.opacity = 1;
        submitButton.textContent = "この研究室にエントリーする";
      }
    }

    // --- 研究室リストの取得・表示 ---
    async function fetchLabs() {
      // (この関数に変更はありません)
      labList.textContent = "";
      const liLoading = document.createElement("li");
      liLoading.textContent = "研究室リストを読み込み中...";
      labList.appendChild(liLoading);

      try {
        const labsCollectionRef = collection(db, "labs");
        const querySnapshot = await getDocs(labsCollectionRef);

        const labs = [];
        querySnapshot.forEach((doc) => {
          labs.push({ id: doc.id, ...doc.data() });
        });

        labList.innerHTML = "";

        labs.forEach((lab) => {
          if (lab.isEntryOpen) {
            const li = document.createElement("li");
            li.textContent = lab.capacity
              ? `${lab.name} (定員: ${lab.capacity}名)`
              : lab.name;
            li.dataset.labId = lab.id;

            li.addEventListener("click", () => {
              document.querySelectorAll("#lab-list li").forEach((el) => {
                el.style.backgroundColor = "";
                el.style.fontWeight = "normal";
              });
              li.style.backgroundColor = "#e0e0e0";
              li.style.fontWeight = "bold";
              selectedLabId = lab.id;
              selectedLabName = lab.name;
              submitButton.disabled = false;
            });
            labList.appendChild(li);
          }
        });

        if (labList.innerHTML === "") {
          liLoading.textContent = "エントリー可能な研究室はありません。";
          labList.appendChild(liLoading);
        }
      } catch (error) {
        console.error("研究室リスト取得エラー:", error);
        liLoading.textContent = "リストの読み込みに失敗しました。";
        labList.innerHTML = "";
        labList.appendChild(liLoading);
      }
    }

    // --- GPA計算ロジック (再追加) ---
    function calculateGpasAndDetails(grades) {
      const YEAR_MULTIPLIERS = { first: 1.1, second: 1.2 };
      const COURSE_TYPE_MULTIPLIERS = {
        required: 1.0,
        requiredSelective: 1.1,
        selective: 1.2,
      };
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

      let weightedGpSum = 0;
      let totalEarnedCredits = 0;

      grades.forEach((grade) => {
        const originalGp = grade.GP;
        const credit = grade.単位;
        if (isNaN(originalGp) || isNaN(credit) || credit === 0) return;

        let weightedGp = originalGp;
        if (firstYearIds.includes(grade.科目id)) {
          weightedGp *= YEAR_MULTIPLIERS.first;
        } else if (secondYearIds.includes(grade.科目id)) {
          weightedGp *= YEAR_MULTIPLIERS.second;
        }

        if (R_courseIds.includes(grade.科目id)) {
          weightedGp *= COURSE_TYPE_MULTIPLIERS.required;
          totalEarnedCredits += credit;
        } else if (RS_courseIds.includes(grade.科目id)) {
          weightedGp *= COURSE_TYPE_MULTIPLIERS.requiredSelective;
          if (originalGp > 0) {
            totalEarnedCredits += credit;
          }
        } else if (S_courseIds.includes(grade.科目id)) {
          weightedGp *= COURSE_TYPE_MULTIPLIERS.selective;
          if (originalGp > 0) {
            totalEarnedCredits += credit;
          }
        } else {
          totalEarnedCredits += credit;
        }
        weightedGpSum += weightedGp * credit;
      });

      if (totalEarnedCredits === 0) return { specialGpa: 0 };

      const specialGpa = weightedGpSum / totalEarnedCredits;
      return { specialGpa };
    }

    // --- ハッシュ生成関数 ---
    async function generateHash(str) {
      const encoder = new TextEncoder();
      const data = encoder.encode(str);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }

    // --- 初期化処理の呼び出し ---
    checkGpaConsistencyAndLoadData();
  }
});
