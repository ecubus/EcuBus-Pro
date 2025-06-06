import { isObject, isNumber, get as _get } from 'lodash'

export function isOptions(val) {
  return isObject(val) && isObject(val.hash)
}

export function get(val, prop) {
  return _get(val, prop)
}

export function resultFn(val) {
  if (typeof val === 'function') {
    return val.apply(this, [].slice.call(arguments, 1))
  }
  return val
}

export function isUndefined(val) {
  return val == null || (isOptions(val) && val.hash != null)
}
export function isBlock(options) {
  return (
    isOptions(options) && typeof options.fn === 'function' && typeof options.inverse === 'function'
  )
}
export function valueFn(val, context, options) {
  if (isOptions(val)) {
    return valueFn(null, val, options)
  }
  if (isOptions(context)) {
    return valueFn(val, {}, context)
  }
  if (isBlock(options)) {
    // eslint-disable-next-line no-extra-boolean-cast
    return !!val ? options.fn(context) : options.inverse(context)
  }
  return val
}

export function optionsFn(thisArg, locals, options) {
  if (isOptions(thisArg)) {
    return optionsFn({}, locals, thisArg)
  }
  if (isOptions(locals)) {
    return optionsFn(thisArg, options, locals)
  }
  options = options || {}
  if (!isOptions(options)) {
    locals = Object.assign({}, locals, options)
  }
  let opts = Object.assign({}, locals, options.hash)
  if (isObject(thisArg)) {
    opts = Object.assign({}, thisArg.options, opts)
  }
  if (opts[options.name]) {
    opts = Object.assign({}, opts[options.name], opts)
  }
  return opts
}
export function containsFn(val, obj, start) {
  if (val == null || obj == null || !isNumber(val.length)) {
    return false
  }
  return val.indexOf(obj, start) !== -1
}
