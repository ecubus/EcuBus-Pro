const path = require('path');
const webpack = require('webpack');
const fs=require('fs');

// Custom plugin to preprocess ecb_cli.js before packaging
class PreprocessEcbCliPlugin {
    apply(compiler) {
        compiler.hooks.afterEmit.tapAsync('PreprocessEcbCliPlugin', (compilation, callback) => {
            const ecbCliPath = path.resolve(__dirname, 'dist', 'ecb_cli.js');
            const content = fs.readFileSync(ecbCliPath, 'utf8');
            const processedContent = content.replaceAll('path.join(__dirname,', 'path.join(process.cwd(),');
            fs.writeFileSync(ecbCliPath, processedContent, 'utf8');
            callback();
        });
    }
}

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
            'process.platform':JSON.stringify(process.platform), 
        }),
    ],
    devtool: 'source-map'
};