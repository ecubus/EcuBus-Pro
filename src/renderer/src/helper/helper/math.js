import Handlebars from 'handlebars'
import { isNumber } from 'lodash'
const helpers = {}

/**
 * Return the magnitude of `a`.
 *
 * @param {Number} `a`
 * @return {Number}
 * @api public
 */

helpers.abs = function (num) {
  if (!isNumber(num)) {
    throw new TypeError('expected a number')
  }
  return Math.abs(num)
}

/**
 * Return the sum of `a` plus `b`.
 *
 * @param {Number} `a`
 * @param {Number} `b`
 * @return {Number}
 * @api public
 */

helpers.add = function (a, b) {
  if (isNumber(a) && isNumber(b)) {
    return Number(a) + Number(b)
  }
  if (typeof a === 'string' && typeof b === 'string') {
    return a + b
  }
  return ''
}

/**
 * Returns the average of all numbers in the given array.
 *
 * ```handlebars
 * {{avg "[1, 2, 3, 4, 5]"}}
 * <!-- results in: '3' -->
 * ```
 *
 * @param {Array} `array` Array of numbers to add up.
 * @return {Number}
 * @api public
 */

helpers.avg = function () {
  const args = [].concat.apply([], arguments)
  // remove handlebars options object
  args.pop()
  return helpers.sum(args) / args.length
}

/**
 * Get the `Math.ceil()` of the given value.
 *
 * @param {Number} `value`
 * @return {Number}
 * @api public
 */

helpers.ceil = function (num) {
  if (!isNumber(num)) {
    throw new TypeError('expected a number')
  }
  return Math.ceil(num)
}

/**
 * Divide `a` by `b`
 *
 * @param {Number} `a` numerator
 * @param {Number} `b` denominator
 * @api public
 */

helpers.divide = function (a, b) {
  if (!isNumber(a)) {
    throw new TypeError('expected the first argument to be a number')
  }
  if (!isNumber(b)) {
    throw new TypeError('expected the second argument to be a number')
  }
  return Number(a) / Number(b)
}

/**
 * Get the `Math.floor()` of the given value.
 *
 * @param {Number} `value`
 * @return {Number}
 * @api public
 */

helpers.floor = function (num) {
  if (!isNumber(num)) {
    throw new TypeError('expected a number')
  }
  return Math.floor(num)
}

/**
 * Return the difference of `a` minus `b`.
 *
 * @param {Number} `a`
 * @param {Number} `b`
 * @alias subtract
 * @api public
 */

helpers.minus = function (a, b) {
  if (!isNumber(a)) {
    throw new TypeError('expected the first argument to be a number')
  }
  if (!isNumber(b)) {
    throw new TypeError('expected the second argument to be a number')
  }
  return Number(a) - Number(b)
}

/**
 * Get the remainder of a division operation.
 *
 * @param {Number} `a`
 * @param {Number} `b`
 * @return {Number}
 * @api public
 */

helpers.modulo = function (a, b) {
  if (!isNumber(a)) {
    throw new TypeError('expected the first argument to be a number')
  }
  if (!isNumber(b)) {
    throw new TypeError('expected the second argument to be a number')
  }
  return Number(a) % Number(b)
}

/**
 * Return the product of `a` times `b`.
 *
 * @param {Number} `a` factor
 * @param {Number} `b` multiplier
 * @return {Number}
 * @alias times
 * @api public
 */

helpers.multiply = function (a, b) {
  if (!isNumber(a)) {
    throw new TypeError('expected the first argument to be a number')
  }
  if (!isNumber(b)) {
    throw new TypeError('expected the second argument to be a number')
  }
  return Number(a) * Number(b)
}

/**
 * Add `a` by `b`.
 *
 * @param {Number} `a` factor
 * @param {Number} `b` multiplier
 * @api public
 */

helpers.plus = function (a, b) {
  if (!isNumber(a)) {
    throw new TypeError('expected the first argument to be a number')
  }
  if (!isNumber(b)) {
    throw new TypeError('expected the second argument to be a number')
  }
  return Number(a) + Number(b)
}

/**
 * Generate a random number between two values
 *
 * @param {Number} `min`
 * @param {Number} `max`
 * @return {String}
 * @api public
 */

/**
 * Get the remainder when `a` is divided by `b`.
 *
 * @param {Number} `a` a
 * @param {Number} `b` b
 * @api public
 */

helpers.remainder = function (a, b) {
  return a % b
}

/**
 * Round the given number.
 *
 * @param {Number} `number`
 * @return {Number}
 * @api public
 */

helpers.round = function (num) {
  if (!isNumber(num)) {
    throw new TypeError('expected a number')
  }
  return Math.round(num)
}

/**
 * Return the product of `a` minus `b`.
 *
 * @param {Number} `a`
 * @param {Number} `b`
 * @return {Number}
 * @alias minus
 * @api public
 */

helpers.subtract = function (a, b) {
  if (!isNumber(a)) {
    throw new TypeError('expected the first argument to be a number')
  }
  if (!isNumber(b)) {
    throw new TypeError('expected the second argument to be a number')
  }
  return Number(a) - Number(b)
}

/**
 * Returns the sum of all numbers in the given array.
 *
 * ```handlebars
 * {{sum "[1, 2, 3, 4, 5]"}}
 * <!-- results in: '15' -->
 * ```
 * @param {Array} `array` Array of numbers to add up.
 * @return {Number}
 * @api public
 */

helpers.sum = function () {
  const args = [].concat.apply([], arguments)
  let len = args.length
  let sum = 0

  while (len--) {
    if (isNumber(args[len])) {
      sum += Number(args[len])
    }
  }
  return sum
}

/**
 * Multiply number `a` by number `b`.
 *
 * @param {Number} `a` factor
 * @param {Number} `b` multiplier
 * @return {Number}
 * @alias multiply
 * @api public
 */

helpers.pow = function (a, b) {
  if (!isNumber(a)) {
    throw new TypeError('expected the first argument to be a number')
  }
  if (!isNumber(b)) {
    throw new TypeError('expected the second argument to be a number')
  }
  return Math.pow(Number(a), Number(b))
}

helpers.log = function (base, number) {
  if (!isNumber(base)) {
    throw new TypeError('expected the first argument to be a number')
  }
  if (!isNumber(number)) {
    throw new TypeError('expected the second argument to be a number')
  }
  return Math.log(number) / Math.log(base)
}
/**
 * Generate a random number between two values
 *
 * @param {Number} `min`
 * @param {Number} `max`
 * @return {String}
 * @api public
 */

helpers.random = function (min, max) {
  if (!isNumber(min)) {
    throw new TypeError('expected minimum to be a number')
  }
  if (!isNumber(max)) {
    throw new TypeError('expected maximum to be a number')
  }
  return Math.random() * (max - min) + min
}

helpers.bitOr = function (a, b) {
  if (!isNumber(a)) {
    throw new TypeError('expected the first argument to be a number')
  }
  if (!isNumber(b)) {
    throw new TypeError('expected the second argument to be a number')
  }
  return a | b
}

helpers.bitAnd = function (a, b) {
  if (!isNumber(a)) {
    throw new TypeError('expected the first argument to be a number')
  }
  if (!isNumber(b)) {
    throw new TypeError('expected the second argument to be a number')
  }
  return a & b
}

helpers.bitXor = function (a, b) {
  if (!isNumber(a)) {
    throw new TypeError('expected the first argument to be a number')
  }
  if (!isNumber(b)) {
    throw new TypeError('expected the second argument to be a number')
  }
  return a ^ b
}

helpers.bitNot = function (a) {
  if (!isNumber(a)) {
    throw new TypeError('expected the first argument to be a number')
  }
  return ~a
}

helpers.bitShiftLeft = function (a, b) {
  if (!isNumber(a)) {
    throw new TypeError('expected the first argument to be a number')
  }
  if (!isNumber(b)) {
    throw new TypeError('expected the second argument to be a number')
  }
  return a << b
}

helpers.bitShiftRight = function (a, b) {
  if (!isNumber(a)) {
    throw new TypeError('expected the first argument to be a number')
  }
  if (!isNumber(b)) {
    throw new TypeError('expected the second argument to be a number')
  }
  return a >> b
}

for (const key of Object.keys(helpers)) {
  Handlebars.registerHelper(key, helpers[key])
}

