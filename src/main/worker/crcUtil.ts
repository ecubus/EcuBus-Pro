/* eslint-disable no-var */
class CrcUtil {
  public static Reflect8(val: number) {
    var resByte = 0

    for (var i = 0; i < 8; i++) {
      if ((val & (1 << i)) != 0) {
        resByte |= (1 << (7 - i)) & 0xff
      }
    }
    return resByte
  }

  public static Reflect16(val: number) {
    var resByte = 0

    for (var i = 0; i < 16; i++) {
      if ((val & (1 << i)) != 0) {
        resByte |= (1 << (15 - i)) & 0xffff
      }
    }

    return resByte
  }

  public static Reflect32(val: number) {
    var resByte = 0

    for (var i = 0; i < 32; i++) {
      if ((val & (1 << i)) != 0) {
        resByte |= (1 << (31 - i)) & 0xffffffff
      }
    }

    return resByte
  }

  public static ReflectGeneric(val: number, width: number) {
    var resByte = 0
    for (var i = 0; i < width; i++) {
      if ((val & (1 << i)) != 0) {
        resByte |= 1 << (width - 1 - i)
      }
    }
    return resByte
  }
}

export default CrcUtil

