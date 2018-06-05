// @flow

import { makeNodeFolder } from 'disklet'

import type { PlusultraRawIo } from '../../plusultra-core-index.js'

// Dynamically import platform-specific stuff:
let crypto
let fetch
let WebSocket
try {
  crypto = require('crypto')
  fetch = require('node-fetch')
  WebSocket = require('ws')
} catch (e) {}

/**
 * Returns true if the runtime environment appears to be node.js.
 */
export const isNode = crypto && fetch

/**
 * Creates the io resources needed to run the Plusultra core on node.js.
 *
 * @param {string} path Location where data should be written to disk.
 */
export function makeNodeIo (path: string): PlusultraRawIo {
  if (!isNode) {
    throw new Error('This function only works on node.js')
  }

  return {
    console,
    fetch,
    folder: makeNodeFolder(path),
    random (bytes: number) {
      return crypto.randomBytes(bytes)
    },
    WebSocket
  }
}
