const path = require('path');

module.exports = {
  mode: 'production',
  entry: {
    // 合体させたいファイルたち
    popup: './popup.js',
    content_script: './content_script.js',
    // firebase-configはpopup.jsが読み込むので、ここには不要
  },
  output: {
    // 合体させた後の出力先フォルダ
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
};