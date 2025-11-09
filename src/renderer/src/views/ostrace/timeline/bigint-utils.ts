export class BIMath {
  static readonly round = (val: bigint | number): bigint => {
    return typeof val === 'bigint' ? val : BigInt(Math.round(val))
  }

  static readonly clamp = (val: bigint | number, min: bigint, max: bigint): bigint => {
    val = BIMath.round(val)
    if (val < min) {
      return min
    } else if (val > max) {
      return max
    }
    return val
  }

  static readonly min = (val1: bigint | number, val2: bigint | number): bigint => {
    val1 = BIMath.round(val1)
    val2 = BIMath.round(val2)
    return val1 <= val2 ? val1 : val2
  }

  static readonly max = (val1: bigint | number, val2: bigint | number): bigint => {
    val1 = BIMath.round(val1)
    val2 = BIMath.round(val2)
    return val1 >= val2 ? val1 : val2
  }

  static readonly abs = (val: bigint | number): bigint => {
    val = BIMath.round(val)
    return val >= 0 ? val : -val
  }

  static readonly multiply = (a: bigint | number, b: bigint | number): bigint => {
    a = Number(a)
    b = Number(b)
    let c = a * b
    return BIMath.round(c)
  }
}
