console.log("成績データ取得用のContent Scriptが読み込まれました。");

/**
 * 画面に表示されている成績テーブルからデータを抽出し、整形する関数
 */
function scrapeGradeData() {
  const rows = document.querySelectorAll('table[id="02"] tbody tr');
  const formattedData = [];

  rows.forEach((row) => {
    const cells = row.querySelectorAll("td");

    // セルの存在をチェックしてから処理
    if (cells.length > 8) {
      const kamokuId = cells[0]?.textContent.trim();
      let kamokuName = cells[1]?.textContent.trim();
      const tanni = cells[5]?.textContent.trim();
      const gp = cells[8]?.textContent.trim();

      if (kamokuName) {
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
    }
  });
  console.log("抽出された成績データ:", formattedData);
  return formattedData;
}

/**
 * ポップアップからのメッセージを受け取るリスナー
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scrapeGrades") {
    console.log("ポップアップから成績データ取得の依頼を受け取りました。");
    
    const grades = scrapeGradeData();
    if (grades.length > 0) {
      sendResponse({ success: true, data: grades });
    } else {
      sendResponse({
        success: false,
        message: "成績データが見つかりませんでした。",
      });
    }
  }
});
