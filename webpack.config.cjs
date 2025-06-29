const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  mode: "production",
  entry: {
    // 合体させたいファイルたち
    popup: "./popup.js",
    content_script: "./content_script.js",
    // firebase-configはpopup.jsが読み込むので、ここには不要
  },
  output: {
    // 合体させた後の出力先フォルダ
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        // manifest.json を dist/ にコピー
        { from: "manifest.json", to: "." },
        // popup.html を dist/ にコピー
        { from: "popup.html", to: "." },
        // senmon.csv を dist/ にコピー
        // { from: "senmon.csv", to: "." },
      ],
    }),
  ],
};
