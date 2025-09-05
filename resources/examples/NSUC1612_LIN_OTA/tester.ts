// 导入Node.js内置模块
import fs from 'fs/promises' // 文件系统模块的异步版本，用于读取文件
import path from 'path' // 路径处理模块，用于构建文件路径

// 导入ECB模块中的CRC和DiagRequest类
import { CRC, DiagRequest } from 'ECB'

// 初始化ECU测试程序
Util.Init(async () => {
  // 构建固件文件的完整路径
  // 使用环境变量PROJECT_ROOT作为基础路径，拼接firmware目录和project_rom_boot.bin文件名
  const fw = path.join(process.env.PROJECT_ROOT, 'firmware', 'project_rom_boot.bin')

  // 异步读取固件文件内容
  const content = await fs.readFile(fw)

  // 创建CRC32_JAMCRC校验算法实例
  const crc = CRC.buildInCrc('CRC32_JAMCRC')

  // 计算固件文件内容的CRC32校验值
  const crcValue = crc.computeBuffer(content)

  // 创建诊断请求服务
  // 使用'NSUC1612_LIN_UDS_Tester.RoutineControl_routineID$F001'作为服务标识
  const service = DiagRequest.from('NSUC1612_LIN_UDS_Tester.RoutineControl_routineID$F001')

  // 设置诊断服务的参数
  // 将计算得到的CRC值设置为'routineControlOptionRecord'参数的值
  service.diagSetParameterRaw('routineControlOptionRecord', crcValue)

  // 执行服务变更，发送诊断请求
  await service.changeService()
})
