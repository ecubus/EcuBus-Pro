import { glob } from 'glob'
import res from '../../../resources/examples/example.txt?asset&asarUnpack'
import path from 'path'
import { dialog, ipcMain, IpcMain, shell } from 'electron'
import fsP from 'fs/promises'
import fs from 'fs'

const buildInExamplePath = path.dirname(res)

interface exampleL1 {
  level: 1
  catalog: string
}

interface exampleL2 {
  level: 2
  filePath: string
  readme: string
  folderPath: string
  detail: any
}

interface example {
  label: string
  data: exampleL1 | exampleL2
  children: example[]
}

ipcMain.handle('ipc-examples', async (event, ...args) => {
  const ecbFile = await glob('*/*.ecb', { cwd: buildInExamplePath })
  const examples: example[] = []
  for (const ecb of ecbFile) {
    const ecbPath = path.join(buildInExamplePath, ecb)
    try {
      const ecbContent = JSON.parse(await fsP.readFile(ecbPath, 'utf-8'))
      {
        //find same catalog
        const catalog = ecbContent.project.example?.catalog || 'normal'
        let catalogNode = examples.find((e) => e.data.level === 1 && e.data.catalog === catalog)
        if (!catalogNode) {
          catalogNode = {
            data: {
              level: 1,
              catalog: catalog
            },
            label: catalog.toUpperCase(),
            children: []
          }
          examples.push(catalogNode)
        }
        let readme = ''
        if (fs.existsSync(path.join(path.dirname(ecbPath), 'readme.md'))) {
          readme = await fsP.readFile(path.join(path.dirname(ecbPath), 'readme.md'), 'utf-8')
        }
        const ss = path.parse(ecbPath)
        catalogNode.children.push({
          data: {
            level: 2,
            readme: readme,
            filePath: ecbPath,
            folderPath: ss.dir,
            detail: ecbContent.example
          },
          label: ss.name,
          children: []
        })
      }
    } catch (e) {
      continue
    }
  }
  return examples
})

ipcMain.handle('ipc-create-example', async (event, ...args) => {
  const e = args[0] as exampleL2
  //dialog choose folder
  const f = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })
  if (!f.canceled) {
    //copy folder
    const targetFolder = f.filePaths[0]
    const sourceFolder = e.folderPath
    await fsP.cp(sourceFolder, targetFolder, { recursive: true, force: true })
    return path.join(targetFolder, path.basename(e.filePath))
  } else {
    return null
  }
})

ipcMain.on('ipc-open-link', (event, ...args) => {
  shell.openExternal(args[0])
})
