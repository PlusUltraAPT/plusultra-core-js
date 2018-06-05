// @flow

import { expect } from 'chai'
import { describe, it } from 'mocha'

import { base16 } from '../../util/encoding.js'
import { calcSnrpForTarget } from './scrypt-pixie.js'

describe('SNRP calculation', function () {
  const salt = new Uint8Array(32)
  const saltHex = base16.stringify(salt)

  it('basic functionality', async function () {
    // Typical desktop with JS + V8:
    expect(calcSnrpForTarget(salt, 32, 2000)).to.deep.equal({
      salt_hex: saltHex,
      n: 131072,
      r: 8,
      p: 14
    })

    // Insane speeds:
    expect(calcSnrpForTarget(salt, 1, 2000)).to.deep.equal({
      salt_hex: saltHex,
      n: 131072,
      r: 8,
      p: 64
    })

    // Infinity:
    expect(calcSnrpForTarget(salt, 0, 2000)).to.deep.equal({
      salt_hex: saltHex,
      n: 131072,
      r: 8,
      p: 64
    })
  })
})
