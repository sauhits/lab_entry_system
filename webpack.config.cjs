const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const WebpackObfuscator = require("webpack-obfuscator");

module.exports = {
  mode: "production",
  entry: {
    popup: "./popup.js",
    content_script: "./content_script.js",
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "manifest.json", to: "." },
        { from: "popup.html", to: "." },
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
