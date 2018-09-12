const HtmlWebpackPlugin = require('html-webpack-plugin');
const HtmlWebpackInlineSourcePlugin = require("html-webpack-inline-source-plugin");
const path = require("path");

module.exports = {
  mode: "development",
  entry: "./public/init.webpack.js",
  output: {
    path: path.resolve(__dirname, "public"),
    filename: "dist/[name].js"
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          "style-loader",
          "css-loader"
        ]
      },
      {
        test: /\.md$/,
        use: [
          {
            loader: "raw-loader"
          }
        ]
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      filename: "index.html",
      title: "Kirkanta API v4",
      inlineSource: /\.(js|css|md)$/
    }),
    new HtmlWebpackInlineSourcePlugin
  ]
};
