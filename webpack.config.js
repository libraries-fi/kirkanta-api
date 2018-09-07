const path = require("path");

module.exports = {
  mode: "development",
  entry: {
    doc: [
      "./public/init.webpack.js"
    ]
  },
  output: {
    path: path.resolve(__dirname, "public/dist"),
    filename: "[name].js"
  },
  module: {
    // noParse: [/\.min\.js/],
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
            loader: "file-loader",
            options: {
              name: "[name].[ext]",
              context: path.resolve("../doc")
            }
          },
        ]
      },
    ]
  },
};
