const OSS = require('ali-oss')
const path = require('path')
const fsP = require('fs').promises
const make_release_note_all = require('./release_note')



require('dotenv').config()
const sw = new OSS({
  endpoint: 'oss-accelerate.aliyuncs.com',
  accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
  accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
  bucket: 'ecubus'
})

const yml = require('yaml')



async function putDir(dir,prefix) {
    const files = await fsP.readdir(dir, { withFileTypes: true })
    for (const file of files) {
        const filePath = path.join(dir, file.name)
        if (file.isDirectory()) {
            await putDir(filePath,`${prefix}/${file.name}`)
        } else {
            await sw.put(`${prefix}/${file.name}`, filePath)
            console.log(`${prefix}/${file.name} pushed ok`)
        }
    }
}

async function put(list) {
  console.log(list)
  //put dist folder
  if(list.includes('--page')){
    const dist = path.join(__dirname, '..', '.vitepress','dist')
    await putDir(dist,'app/dist')
    const api = path.join(__dirname, '..', 'resources', 'docs','scriptApi')
    await putDir(api,'app/scriptApi')
  }


 

  // tag need match v\d+\.\d+\.\d+$
  if(list.includes('--note')){
    // await make_release_note_all()
    const releasePath = path.join(__dirname, '..', 'docs', 'en', 'dev', 'releases_note.md')
    await sw.put('app/releases_note.md', releasePath)
    console.log('releases_note.md pushed ok')
  }

  if(list.includes('--app')){

    const yamlPath = path.join(__dirname, '..', 'dist', 'latest.yml')
    await sw.put(`app/latest.yml`, yamlPath)
    console.log('latest.yml pushed ok')

    //read yaml
    const content = await fsP.readFile(yamlPath, 'utf-8')
    const yaml = yml.parse(content)

    const version = yaml.version
    const options = {
      partSize: 1000 * 1024, //设置分片大小
      timeout: 120000 //设置超时时间
    }
    const exePath = path.join(__dirname, '..', 'dist', `EcuBus-Pro ${version}.exe`)

    await sw.multipartUpload(`app/EcuBus-Pro ${version}.exe`, exePath, options)
    console.log('EcuBus-Pro.exe pushed ok')

    //symbol link
    //await sw.putSymlink(`app/EcuBus-Pro.exe`, `app/EcuBus-Pro ${version}.exe`);

    const blockPath = path.join(__dirname, '..', 'dist', `EcuBus-Pro ${version}.exe.blockmap`)
    await sw.put(`app/EcuBus-Pro ${version}.exe.blockmap`, blockPath)
    console.log('EcuBus-Pro.exe.blockmap pushed ok')
  }

  process.exit(0)
}
put(process.argv.slice(2))

