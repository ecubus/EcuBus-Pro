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
    if (target.value.type == 'number' && typeof value === 'number') {
      target.value.value = value
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
