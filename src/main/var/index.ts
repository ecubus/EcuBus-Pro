export function setVar(name: string, value: number | string | number[]) {
  let found = false
  const a = Object.values(global.vars)
  //

  //no group
  const target = a.find((v) => v.name == name && v.value != undefined)
  if (target) {
    if (target.value == undefined) {
      return { found: false, target }
    }
    //type check
    if (target.value.type == 'number' && !Number.isNaN(Number(value))) {
      target.value.value = Number(value)
      found = true
    } else if (target.value.type == 'string' && typeof value === 'string') {
      target.value.value = value
      found = true
    } else if (target.value.type == 'array' && Array.isArray(value)) {
      target.value.value = value
      found = true
    }
  }

  return { found, target }
}
export function getVar(name: string): number | string | number[] {
  const target = Object.values(global.vars).find((v) => v.name == name)
  if (target && target.value) {
    if (target.value.type == 'number') {
      if (target.value.value == undefined) {
        return Number(target.value.initValue)
      } else {
        return Number(target.value.value)
      }
    } else if (target.value.type == 'string') {
      if (target.value.value == undefined) {
        return target.value.initValue || ''
      } else {
        return target.value.value || ''
      }
    } else if (target.value.type == 'array') {
      if (target.value.value == undefined) {
        return (target.value.initValue || []).map((v) => Number(v))
      } else {
        return (target.value.value || []).map((v) => Number(v))
      }
    }
  }
  throw new Error(`var ${name} not found`)
}

export function setVarByKey(key: string, value: number | string | number[]) {
  const target = global.vars[key]
  if (target && target.value) {
    if (target.value.type == 'number' && typeof value === 'number') {
      target.value.value = value
      return { found: true, target }
    } else if (target.value.type == 'string' && typeof value === 'string') {
      target.value.value = value
      return { found: true, target }
    } else if (target.value.type == 'array' && Array.isArray(value)) {
      target.value.value = value
      return { found: true, target }
    }
  }
  return { found: false, target }
}
