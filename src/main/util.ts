import path from "path"




export function getJsPath(tsPath:string,projectPath:string){
    const outDir = path.join(projectPath, '.ScriptBuild')
    const scriptNameNoExt = path.basename(tsPath, '.ts')
    const relativePath = path.relative(projectPath, tsPath).split(path.sep).join('_')
    const jsPath = path.join(outDir, relativePath,scriptNameNoExt+'.js')
    return jsPath
}
