import Handlebars from 'handlebars'
import './helper/math'
import './helper/array'
import './helper/string'
import './helper/comparison'
import './helper/object'
import './helper/number'
import { isOptions, resultFn, isUndefined, valueFn } from './helper/utils'
import { get, set, sortBy, unset } from 'lodash'
import log from 'electron-log'
// import { isUndefined } from 'lodash'

Handlebars.registerHelper('logFile', function (msg) {
  log.log(msg)
})


Handlebars.registerHelper('isUndefined', function (val, options) {
  return valueFn(isUndefined(val), this, options)
})

Handlebars.registerHelper('isDefined', function (val, options) {
  return valueFn(!isUndefined(val), this, options)
})

Handlebars.registerHelper('setVar', function (varName, varValue, options) {
  if (!options.data.root) {
    options.data.root = {}
  }
  try {
    const v = JSON.parse(JSON.stringify(varValue))
    set(options.data.root, varName, v)
  } catch (e) {
    set(options.data.root, varName, varValue)
  }
})

Handlebars.registerHelper('jsonParse', function (varName) {
  return JSON.parse(varName)
})

Handlebars.registerHelper('jsonStringify', function (varName) {
  return JSON.stringify(varName)
})

Handlebars.registerHelper('createArray', function (...args) {
  return new Array(...args.slice(0, -1))
})

Handlebars.registerHelper('createObject', function (name, url) {
  return {}
})

Handlebars.registerHelper('error', function (val) {
  throw new Error(`Generate Code Error:${val}`)
})


Handlebars.registerHelper('times', function (n, block) {
  // eslint-disable-next-line no-var
  var accum = ''
  // eslint-disable-next-line no-var
  for (var i = 0; i < n; ++i) {
    block.data.index = i
    block.data.first = i === 0
    block.data.last = i === n - 1
    accum += block.fn(this)
  }
  return accum
})

Handlebars.registerHelper('range', function (start, end, block) {
  // eslint-disable-next-line no-var
  var accum = ''
  // eslint-disable-next-line no-var
  for (var i = start; i <= end; ++i) {
    block.data.index = i
    block.data.first = i === start
    block.data.last = i === end
    accum += block.fn(this)
  }
  return accum
})

