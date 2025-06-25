// 条件导入sa.node，只在Windows平台导入
let saNode: any
if (process.platform == 'win32') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  saNode = require('./build/Release/sa.node')
} else {
  // 非Windows平台提供空实现
  saNode = {
    SeedKey: class {
      constructor() {}
      IsLoaded() {
        return false
      }
      LoadDLL() {
        throw new Error('SecureAccessDll is only available on Windows platform')
      }
      GenerateKeyExOpt() {
        throw new Error('SecureAccessDll is only available on Windows platform')
      }
      GenerateKeyEx() {
        throw new Error('SecureAccessDll is only available on Windows platform')
      }
    },
    UINT8_ARRAY: class {
      constructor() {}
      setitem() {}
      cast() {
        return this
      }
    },
    INT8_ARRAY: class {
      constructor() {}
      setitem() {}
      cast() {
        return this
      }
    },
    UINT32_PTR: class {
      constructor() {}
      assign() {}
      value() {
        return 0
      }
      cast() {
        return this
      }
    }
  }
}

/**
 * @category UDS
 */
export default class SecureAccessDll {
  _ref: any
  constructor(dllPath: string) {
    this._ref = new saNode.SeedKey()
    // console.log(dllPath)
    this.loadDll(dllPath)
    if (!this._ref.IsLoaded()) {
      throw new Error('Failed to load DLL')
    }
  }

  /**
   * Generates a key with extended options.
   *
   * @param ipSeedArray - A buffer containing the seed array, for c: = ipSeedArray + iSeedArraySize
   * @param iSecurityLevel - The security level to be used.
   * @param ipVariant - A buffer containing the variant. for c: = ipVariant, size decide by vendor self
   * @param ipOptions - A buffer containing the options. for c: = ipOptions, size decide by vendor self
   * @param key - A buffer containing the input key.for c: = iopKeyArray + iMaxKeyArraySize
   * @returns A buffer containing the generated key. Return is Buffer, for c: = iopKeyArray, length = oActualKeyArraySize
   * @throws Will throw an error if the key generation fails.
   *
   * @example
   * ```typescript
   *
   * const dllPath=path.join(__dirname,'GenerateKeyExOpt.dll')
   * const sa=new SecureAccessDll(dllPath)
   *
   * const seed=sa.GenerateKeyExOpt(Buffer.from([1,2,3,4,5]),1,Buffer.from([1,2,3,4,5]),Buffer.from([1,2,3,4,5]),Buffer.from([1,2,3,4,5]))
   * ```
   *
   */
  GenerateKeyExOpt(
    ipSeedArray: Buffer,
    iSecurityLevel: number,
    ipVariant: Buffer,
    ipOptions: Buffer,
    key: Buffer
  ): Buffer {
    const seedArray = new saNode.UINT8_ARRAY(ipSeedArray.length)
    for (let i = 0; i < ipSeedArray.length; i++) {
      seedArray.setitem(i, ipSeedArray[i])
    }
    const variant = new saNode.INT8_ARRAY(ipVariant.length)
    for (let i = 0; i < ipVariant.length; i++) {
      variant.setitem(i, ipVariant[i])
    }
    const options = new saNode.INT8_ARRAY(ipOptions.length)
    for (let i = 0; i < ipOptions.length; i++) {
      options.setitem(i, ipOptions[i])
    }
    const KeyArray = new saNode.UINT8_ARRAY(key.length)
    for (let i = 0; i < key.length; i++) {
      KeyArray.setitem(i, key[i])
    }
    const KeySize = new saNode.UINT32_PTR()
    KeySize.assign(key.length)
    const ret = this._ref.GenerateKeyExOpt(
      seedArray.cast(),
      ipSeedArray.length,
      iSecurityLevel,
      variant.cast(),
      options.cast(),
      KeyArray.cast(),
      key.length,
      KeySize.cast()
    )
    if (ret == 0) {
      const retBuf = Buffer.alloc(KeySize.value())
      for (let i = 0; i < KeySize.value(); i++) {
        retBuf[i] = KeyArray.getitem(i)
      }
      return retBuf
    } else {
      throw new Error(`GenerateKeyExOpt failed with error code ${ret}`)
    }
  }
  /**
   * Generates a key with extended options.
   *
   * @param ipSeedArray - A buffer containing the seed array, for c: = ipSeedArray + iSeedArraySize
   * @param iSecurityLevel - The security level to be used.
   * @param ipVariant - A buffer containing the variant. for c: = ipVariant, size decide by vendor self
   * @param key - A buffer containing the input key.for c: = ioKeyArray + iKeyArraySize
   * @returns A buffer containing the generated key. Return is Buffer, for c: = ioKeyArray, length = oSize
   * @throws Will throw an error if the key generation fails.
   *
   * @example
   * ```typescript
   *
   * const dllPath=path.join(__dirname,'GenerateKeyEx.dll')
   * const sa=new SecureAccessDll(dllPath)
   *
   *const seed=sa.GenerateKeyEx(Buffer.from([1,2,3,4,5]),1,Buffer.from([1,2,3,4,5]),Buffer.from([1,2,3,4,5]))
   * ```
   *
   */
  GenerateKeyEx(
    ipSeedArray: Buffer,
    iSecurityLevel: number,
    ipVariant: Buffer,
    key: Buffer
  ): Buffer {
    const seedArray = new saNode.UINT8_ARRAY(ipSeedArray.length)
    for (let i = 0; i < ipSeedArray.length; i++) {
      seedArray.setitem(i, ipSeedArray[i])
    }
    const variant = new saNode.INT8_ARRAY(ipVariant.length)
    for (let i = 0; i < ipVariant.length; i++) {
      variant.setitem(i, ipVariant[i])
    }

    const KeyArray = new saNode.UINT8_ARRAY(key.length)
    for (let i = 0; i < key.length; i++) {
      KeyArray.setitem(i, key[i])
    }
    const KeySize = new saNode.UINT32_PTR()
    KeySize.assign(key.length)
    const ret = this._ref.GenerateKeyEx(
      seedArray.cast(),
      ipSeedArray.length,
      iSecurityLevel,
      variant.cast(),
      KeyArray.cast(),
      key.length,
      KeySize.cast()
    )
    if (ret == 0) {
      const retBuf = Buffer.alloc(KeySize.value())
      for (let i = 0; i < KeySize.value(); i++) {
        retBuf[i] = KeyArray.getitem(i)
      }
      return retBuf
    } else {
      throw new Error(`GenerateKeyExOpt failed with error code ${ret}`)
    }
  }
  private loadDll(dllPath: string) {
    this._ref.LoadDLL(dllPath)
  }
}
