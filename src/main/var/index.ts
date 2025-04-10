import EventEmitter from 'node:events'

global.varEvent = new EventEmitter()

export function setVar(name: string, value: number | string | number[]) {
  let found = false
  const a = Object.values(global.vars)
  //
  const list = name.split('.')
  if (list.length == 2) {
    //has groud
    const parent = a.find((v) => v.name == list[0] && v.value == undefined)
    if (parent) {
      const target = a.find((v) => v.name == list[1] && v.parentId == parent.id)
      if (target) {
        if (target.value == undefined) {
          return false
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
    }
  } else {
    //no group
    const target = a.find((v) => v.name == name && v.value != undefined)
    if (target) {
      if (target.value == undefined) {
        return false
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
  }
  return found
}
