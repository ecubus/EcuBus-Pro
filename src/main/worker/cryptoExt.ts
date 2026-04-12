/**
 * Thin **crypto** façade for worker scripts — re-exports AES-CMAC helpers built on Node.js `crypto`.
 *
 * @remarks
 * Keeps a single import path (`cryptoExt`) for authentication-related scripts without pulling the entire
 * OpenSSL surface into user examples.
 *
 * @module cryptoExt
 * @category Crypto
 */

import crypto from 'crypto'
import CMAC from './cmac'

/**
 * AES-based CMAC implementation (RFC 4493 style) used for automotive security access and key derivation flows.
 *
 * @see `./cmac.ts` for the underlying algorithm implementation.
 */
export { CMAC }
