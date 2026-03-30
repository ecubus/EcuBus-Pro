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
       
        // Copy bundled artifacts (single worker bundle + plugin bundle)
        const jsList=['index.js','index.js.map','plugin.js','plugin.js.map']
        for(const js of jsList){
            const src = path.resolve(__dirname,'dist',js)
            const dest = path.resolve(__dirname,'resources','lib','js',js)
            if(fs.existsSync(src)){
                fs.copyFileSync(src,dest)
            }
        }

       
        if(process.platform=='win32'){
            //check sa.node exists
            if(fs.existsSync(path.resolve(__dirname,'dist','sa.node'))){
                fs.copyFileSync(path.resolve(__dirname,'dist','sa.node'),path.resolve(__dirname,'resources','lib','js','sa.node'))
            }
        }
        // //copy precision_timer.node
        // fs.copyFileSync(path.resolve(__dirname,'dist','precision_timer.node'),path.resolve(__dirname,'resources','lib','js','precision_timer.node'))

       

        // merge worker typings into one worker.d.ts
        const workerDtsEntry = path.resolve(__dirname,'dist','src/main/worker','index.d.ts')
        const workerBundledDts = path.resolve(__dirname,'dist','src/main/worker','index.bundled.d.ts')
        
        await bundleDts(workerDtsEntry,workerBundledDts)
        let content=fs.readFileSync(workerBundledDts,'utf-8')
        const globalDtsPath = path.resolve(__dirname,'src','main','worker','global.d.ts')
        if(fs.existsSync(globalDtsPath) && !content.includes('declare global {')){
            let globalContent = fs.readFileSync(globalDtsPath,'utf-8')
            globalContent = globalContent
                .replace(/\/\* eslint-disable no-var \*\/\r?\n?/g,'')
                .replace(/import\s+\{[^}]+\}\s+from\s+['"][^'"]+['"]\s*;?\r?\n?/g,'')
                .replace(/export\s+\{\}\s*;?\r?\n?/g,'')
                .trim()
            content = `${globalContent}\n\n${content}`
        }
        //reaplace
        // content=content.replace("import { ServiceItem } from '../share/uds';",'')
        // content=content.replace("service: ServiceItem;","")
        // content=content.replace('declare const selfDescribe: typeof describe.only;','declare const selfDescribe: typeof describe;')
        // content=content.replace("constructor(service: ServiceItem, isRequest: boolean, data?: Buffer);","")
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
];`)
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


    content=content.replace(
`type VariableMap = {
    stub: number;
};`,
`type VariableMap = {
    "*":number|string|number[],
    {{#each this.variables}}
        "{{this.name}}":{{this.type}},
    {{/each}}
};`)

    content=content.replace('declare const allUdsSeq: readonly ["{{{udsSeqName}}}"];',
`declare const allUdsSeq: readonly [
    {{#each this.udsSeqName}}
        "{{this}}",
    {{/each}}
];

{{#each this.frames}}
export interface {{this.name}} {
    {{#each this.signals}}
        {{this.name}}:{{#if (eq ../type 'can')}}CanSignal{{else}}LinSignaal{{/if}},
    {{/each}}
}
{{/each}}
`)
        fs.writeFileSync(path.resolve(__dirname,'src','main','share','index.d.ts.html'),content)

        //bundle plugin.d.ts
        const pluginFile=path.resolve(__dirname,'dist','src/main/plugin-sdk','index.d.ts')
        await bundleDts(pluginFile,path.resolve(__dirname,'src','main','plugin-sdk','dist','index.d.ts'))
        
        //copy plugin.js to plugin-sdk dist directory
        fs.copyFileSync(path.resolve(__dirname,'dist','plugin.js'),path.resolve(__dirname,'src','main','plugin-sdk','dist','index.cjs'))
        
        // fs.writeFileSync(path.resolve(__dirname,'src','share','cryptoExt.d.ts.html'),v[0])
        console.log('构建过程完成！');

      });   
    }
}



module.exports = {
    entry: {
        index:path.resolve(__dirname,'src/main/worker') + '/index.ts',
        plugin:path.resolve(__dirname,'src/main/plugin-sdk') + '/index.ts',
        
    },
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
    target: 'node',
    plugins: [
       new MyCustomPlugin(),
       // 添加条件编译插件
       new webpack.DefinePlugin({
           'process.platform': JSON.stringify(process.platform),
       })
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
        alias: {
            'src': path.resolve(__dirname, 'src'),
            'nodeCan': path.resolve(__dirname, 'src/main/share')
        },
    },
    devtool: 'source-map'
};