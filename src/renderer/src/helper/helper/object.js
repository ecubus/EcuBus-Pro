import Handlebars from 'handlebars'
import { get } from './utils'
import { set } from 'lodash'
const helpers = {}

helpers.get = function (prop, context, options) {
  const val = get( prop,context)
  if (options && options.fn) {
    return val ? options.fn(val) : options.inverse(context)
  }
  return val
}

helpers.set = function (context, path, value) {
  set(context, path, value)
  return context
}

helpers.set2 = function (context, path, value) {
  set(context, path, value)
}

helpers.objLen = function (prop) {
  if (typeof prop === 'object') {
    const val = Object.keys(prop).length
    return val
  } else {
    return 0
  }
}

helpers.objKeys = function (prop) {
  if (typeof prop === 'object') {
    const val = Object.keys(prop)
    return val
  } else {
    return []
  }
}

helpers.objValues = function (prop) {
  if (typeof prop === 'object') {
    const val = Object.values(prop)
    return val
  } else {
    return []
  }
}

helpers.hasOwnProperty = function (obj, key) {
  return obj.hasOwnProperty(key)
}

for (const key of Object.keys(helpers)) {
  Handlebars.registerHelper(key, helpers[key])
}

