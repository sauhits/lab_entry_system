const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const WebpackObfuscator = require("webpack-obfuscator");

module.exports = {
  mode: "production",
  entry: {
    p: "./p.js",
    c: "./c.js",
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "manifest.json", to: "." },
        { from: "index.html", to: "." },
      ],
    }),
    new WebpackObfuscator(
      {
        stringArray: true,
        StringArrayEncoding: ["rc4"],
        stringArrayThreshold: 1,
        disableConsoleOutput: true,
        identifierNamesGenerator: "mangled",
        selfDefending: true,
      },
      []
    ),
  ],
};
