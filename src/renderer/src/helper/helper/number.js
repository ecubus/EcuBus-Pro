import Handlebars from 'handlebars'
const helpers = {}
import { isNumber } from 'lodash'

helpers.bytes = function (number, precision, options) {
  if (number == null) return '0 B'

  if (!isNumber(number)) {
    number = number.length
    if (!number) return '0 B'
  }

  if (!isNumber(precision)) {
    precision = 2
  }

  const abbr = ['B', 'kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  precision = Math.pow(10, precision)
  number = Number(number)

  let len = abbr.length - 1
  while (len-- >= 0) {
    const size = Math.pow(10, len * 3)
    if (size <= number + 1) {
      number = Math.round((number * precision) / size) / precision
      number += ' ' + abbr[len]
      break
    }
  }

  return number
}

helpers.nToString = function (number, radix) {
  if (number == null) return 0
  return Number(number).toString(radix)
}

helpers.Number = function (number) {
  return Number(number)
}

for (const key of Object.keys(helpers)) {
  Handlebars.registerHelper(key, helpers[key])
}

