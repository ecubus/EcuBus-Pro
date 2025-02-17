import path from "path"




export function getJsPath(tsPath:string,projectPath:string){
    const outDir = path.join(projectPath, '.ScriptBuild')
    const scriptNameNoExt = path.basename(tsPath, '.ts')
    const jsPath = path.join(outDir,scriptNameNoExt+'.js')
    return jsPath
}
