const path = require('path');
const webpack = require('webpack');
const fs=require('fs');




module.exports = {
    entry: {
        ecb_cli:path.resolve(__dirname,'out','ecb_cli.js'),
    },
    mode: 'development',
    output: {
        path: path.resolve(__dirname,'dist'),
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
            '@serialport/bindings-cpp': path.resolve(__dirname, '../resources/lib/js/bindings-cpp.js'),
            bindings: path.resolve(__dirname, '../resources/lib/js/node-bindings.js'),
        },
        extensions: ['.js', '.ts'],
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
        new webpack.DefinePlugin({
            'process.platform':JSON.stringify(process.platform),
        }),
    ],
    devtool: 'source-map'
};