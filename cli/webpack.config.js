const path = require('path');
const webpack = require('webpack');
const fs = require('fs');

// Custom plugin to preprocess ecb_cli.js before packaging
class PreprocessEcbCliPlugin {
    apply(compiler) {
        compiler.hooks.afterEmit.tapAsync('PreprocessEcbCliPlugin', (compilation, callback) => {
            const ecbCliPath = path.resolve(__dirname, 'dist', 'ecb_cli.js');
            const content = fs.readFileSync(ecbCliPath, 'utf8');
            let processedContent = content.replace(
                /path\.join\(__dirname\s*,\s*([^)]*)\)\.replace\(\s*["']app\.asar["']\s*,\s*["']app\.asar\.unpacked["']\s*\)/g,
                'path.join(path.dirname(process.execPath), $1)'
            );
            //require: __webpack_require__("./out sync recursive"), to require:require
            processedContent = processedContent.replace(
                /require:\s*__webpack_require__\s*\(\s*["']\.\/out\s+sync\s+recursive["']\s*\)/g,
                'require:require'
            );
            fs.writeFileSync(ecbCliPath, processedContent, 'utf8');
            callback();
        });
    }
}

module.exports = {
    entry: {
        ecb_cli: path.resolve(__dirname, 'out', 'ecb_cli.js'),
    },
    mode: 'development',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js',
        library: {
            type: 'commonjs',
        },
        sourceMapFilename: '[name].js.map'
    },
    externalsPresets: {
        node: true,
    },
    resolve: {
        alias: {
            // '@serialport/bindings-cpp': path.resolve(__dirname, '../resources/lib/js/bindings-cpp.js'),
            // bindings: path.resolve(__dirname, '../resources/lib/js/node-bindings.js'),
        },
    },
    target: 'node',
    module: {
        rules: [
            {
                test: /\.node$/,
                use: [{
                    loader: 'node-loader',
                    options: {
                        name: '[name].[ext]',
                    }
                }]
            },


        ]
    },
    plugins: [
        new PreprocessEcbCliPlugin(),
        new webpack.DefinePlugin({
            'process.platform': JSON.stringify(process.platform),
        }),
    ],
    devtool: 'source-map'
};