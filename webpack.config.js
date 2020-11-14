const path = require("path");
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
    entry: path.join(__dirname, "js", "app.js"),
    module: {
        rules: [
          {
            test: /\.(js|jsx)$/,
            exclude: /node_modules/,
            use: {
              loader: "babel-loader"
            }
          },
          {
            test: /\.css$/i,
            use: ['style-loader', 'css-loader'],
          },
          {
            test: /\.(png|jpe?g|gif)$/i,
            use: [
              {
                loader: 'file-loader',
              },
            ]
          }
        ]
    },
    optimization: {
      minimizer: [
        (compiler) => {
          const TerserPlugin = require('terser-webpack-plugin');
          new TerserPlugin({ /* your config */ }).apply(compiler);
        }
      ],
    },
    resolve: {
        extensions: ['*', '.js', '.jsx']
    },
    output: {
        path: path.join(__dirname, "public"),
        filename: "bundle.js",
        publicPath: "/"
    }, 
    plugins: [
        new webpack.HotModuleReplacementPlugin()
    ],
    devServer: {
        hot: true,
        historyApiFallback: true
    },
};