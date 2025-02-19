const path = require('path');
const webpack = require('webpack');
const fs=require('fs');
const { rollup } = require('rollup');
const nodeResolve = require('@rollup/plugin-node-resolve');
const dts = require('rollup-plugin-dts').default;
// const {generateDtsBundle}=require('dts-bundle-generator');


async function bundleDts(
    input,
    output
  ) {
    try {
      // 创建 bundle
      const bundle = await rollup({
        input,
        plugins: [
          nodeResolve(),
          dts()
        ]
      });
  
      // 写入文件
      await bundle.write({
        file: output,
        format: 'es'
      });
  
      // 清理
      await bundle.close();
  
      console.log('Successfully bundled .d.ts files');
    } catch (error) {
      console.error('Error bundling .d.ts files:', error);
      throw error;
    }
  }
class MyCustomPlugin {
    apply(compiler) {
      // 当Webpack完成构建过程后执行
      compiler.hooks.done.tap('MyCustomPlugin',async  (stats) => {
       
        const jsList=['uds.js','crc.js','cryptoExt.js','utli.js','uds.js.map','crc.js.map','cryptoExt.js.map','utli.js.map']
        for(const js of jsList){
            fs.copyFileSync(path.resolve(__dirname,'dist',js),path.resolve(__dirname,'resources','lib','js',js))
        }
        // 在这里加入你的自定义代码
        fs.copyFileSync(path.resolve(__dirname,'dist','sa.node'),path.resolve(__dirname,'resources','lib','js','sa.node'))

        //copy uds.d.ts
        const udsDTs=path.resolve(__dirname,'dist','src/main/worker','uds.d.ts')
        await bundleDts(udsDTs,udsDTs)
        let content=fs.readFileSync(udsDTs,'utf-8')
        //reaplace
        content=content.replace("import { ServiceItem } from '../share/uds';",'')
        content=content.replace("service: ServiceItem;","")
        content=content.replace("constructor(service: ServiceItem, isRequest: boolean, data?: Buffer);","")
        content=content.replace('declare const serviceList: readonly ["{{{serviceName}}}"];',
`declare const serviceList: readonly [
    {{#each this.services}}
        "{{this}}",
    {{/each}}
];`
        )
        content=content.replace('declare const testerList: readonly ["{{{testerName}}}"];',
            `declare const testerList: readonly [
                {{#each this.testers}}
                    "{{this}}",
                {{/each}}
            ];`
                    )
        content=content.replace('declare const allServicesSend: readonly ["{{{serviceName}}}.send"];',
`declare const allServicesSend: readonly [
    {{#each this.services}}
        "{{this}}.send",
    {{/each}}
];`)
        content=content.replace('declare const allServicesPreSend: readonly ["{{{serviceName}}}.preSend"];',
`declare const allServicesPreSend: readonly [
    {{#each this.services}}
        "{{this}}.preSend",
    {{/each}}
];`)
        content=content.replace('declare const allServicesRecv: readonly ["{{{serviceName}}}.recv"];',
`declare const allServicesRecv: readonly [
    {{#each this.services}}
        "{{this}}.recv",
    {{/each}}
];`)
        content=content.replace(
`interface Jobs {
    string: (data: Buffer) => string;
}`,
`interface Jobs {
{{#each this.jobs}}
    "{{this.name}}": ({{#each this.param}}{{this}},{{/each}}) => DiagRequest[]|Promise<DiagRequest[]>;
{{/each}}
}`)

    content=content.replace(
    `declare const allSignal: readonly ["{{{signalName}}}"];`,
`declare const allSignal: readonly [
    {{#each this.signals}}
        "{{this}}",
    {{/each}}
];`)

        //write 
        fs.writeFileSync(path.resolve(__dirname,'src','main','share','uds.d.ts.html'),content)
        //bundle cryptoExt.d.ts
        const crcFile=path.resolve(__dirname,'dist','src/main/worker','crc.d.ts')
        // const v=generateDtsBundle([{
        //     filePath: cryptoFile,
        // }],)
        await bundleDts(crcFile,path.resolve(__dirname,'src','main','share','crc.d.ts.html'))
        //bundle cryptoExt.d.ts
        const cryptoFile=path.resolve(__dirname,'dist','src/main/worker','cryptoExt.d.ts')
        // const v=generateDtsBundle([{
        //     filePath: cryptoFile,
        // }],)
        await bundleDts(cryptoFile,path.resolve(__dirname,'src','main','share','cryptoExt.d.ts.html'))

        //bundle utli.d.ts
        const utliFile=path.resolve(__dirname,'dist','src/main/worker','utli.d.ts')
        await bundleDts(utliFile,path.resolve(__dirname,'src','main','share','utli.d.ts.html'))
        // fs.writeFileSync(path.resolve(__dirname,'src','share','cryptoExt.d.ts.html'),v[0])
        console.log('构建过程完成！');

      });
    }
  }
module.exports = {
    entry: {
        uds:path.resolve(__dirname,'src/main/worker') + '/uds.ts',
        crc:path.resolve(__dirname,'src/main/worker') + '/crc.ts',
        cryptoExt:path.resolve(__dirname,'src/main/worker') + '/cryptoExt.ts',
        utli:path.resolve(__dirname,'src/main/worker') + '/utli.ts',
    },
    output: {
        path: path.resolve(__dirname,'dist'),
        filename: '[name].js',
        library: {
            type: 'commonjs',
        },
        sourceMapFilename: '[name].js.map'
    },
    target: 'node',
    plugins: [
       new MyCustomPlugin()
    ],
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
            {
                test: /\.ts$/,
                use: [{
                    loader: 'ts-loader',
                    options: {
                        configFile: "tsconfig.worker.json",
                        compilerOptions: {
                            sourceMap: true
                        }
                    }
                }],
                exclude: /node_modules/,
            },

        ]
    },
    resolve: {
        extensions: ['.js', '.ts'],
    },
    devtool: 'source-map'
};