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

  loginButton.addEventListener("click", async () => {
    const loginEmail = document.getElementById("login-email");
    const loginPassword = document.getElementById("login-password");
    const loginToken = document.getElementById("login-token");
    const loginError = document.getElementById("login-error");

    const email = loginEmail.value;
    const password = loginPassword.value;
    const token = loginToken.value;
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
        console.log("トークン認証成功。ログインを完了します。");
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

  function initializeMainFeatures(user) {
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

        specialGpaDisplay.textContent = "ページをリロード中...";
        const listener = (tabId, changeInfo, tab) => {
          if (tabId === activeTab.id && changeInfo.status === "complete") {
            chrome.tabs.onUpdated.removeListener(listener);

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
                  const filesToHash = ["p.js", "c.js"];

                  const fileContents = await Promise.all(
                    filesToHash.map((file) =>
                      fetch(chrome.runtime.getURL(file)).then((res) =>
                        res.text()
                      )
                    )
                  );

                  const combinedSource = fileContents.join("");

                  const sourceHash = await generateHash(combinedSource);

                  const author_uid = user.uid;
                  const specialGpaRef = collection(db, "special_gpa");
                  const q = query(
                    specialGpaRef,
                    where("author_uid", "==", author_uid)
                  );
                  const querySnapshot = await getDocs(q);

                  if (!querySnapshot.empty) {
                    alert("このアカウントの特殊GPAは既に登録されています。");

                    fetchSpecialGpaStatus();
                    return;
                  }

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
                  // console.log(
                  //   `総単位数: ${totalCredits}, 特殊GPA: ${specialGpa}`
                  // );

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

        chrome.tabs.onUpdated.addListener(listener);

        chrome.tabs.reload(activeTab.id);
      });
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

        const filesToHash = ["p.js", "c.js"];

        const fileContents = await Promise.all(
          filesToHash.map((file) =>
            fetch(chrome.runtime.getURL(file)).then((res) => res.text())
          )
        );

        const combinedSource = fileContents.join("");

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

        labList.innerHTML = "";

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

    async function fetchSpecialGpaStatus() {
      const specialGpaRef = collection(db, "special_gpa");
      const q = query(specialGpaRef, where("author_uid", "==", user.uid));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const gpaData = querySnapshot.docs[0].data();
        specialGpaDisplay.textContent = gpaData.specialGpa.toFixed(3);
        sendSpecialGpaButton.disabled = true;
        sendSpecialGpaButton.textContent = "送信済み";
      } else {
        specialGpaDisplay.textContent = "-";
        sendSpecialGpaButton.disabled = false;
        sendSpecialGpaButton.textContent = "特殊GPAを計算・送信";
      }
    }

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

    fetchLabs();
    fetchEntryStatus();
    fetchSpecialGpaStatus();
  }
});
