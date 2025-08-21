// 用法: node xxx.js 源目录 目标目录
const fs = require('fs');
const path = require('path');

function copyAndRenameToHtml(srcDir, destDir) {
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    const items = fs.readdirSync(srcDir, { withFileTypes: true });
    for (const item of items) {
        const srcPath = path.join(srcDir, item.name);
        if (item.isDirectory()) {
            // 递归处理子文件夹
            copyAndRenameToHtml(srcPath, path.join(destDir, item.name));
        } else if (item.isFile()) {
            // 修改后缀为 .html
            const baseName = path.parse(item.name).name;
            const destPath = path.join(destDir, baseName + '.ts.html');
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// 获取命令行参数
const [,, srcDir, destDir] = process.argv;
if (!srcDir || !destDir) {
    console.log('用法: node xxx.js 源目录 目标目录');
    process.exit(1);
}
copyAndRenameToHtml(srcDir, destDir);
console.log('处理完成！');