// @flow

import type { PlusultraRawIo } from '../../plusultra-core-index.js'

export const isNode = false

export function makeNodeIo (path: string): PlusultraRawIo {
  throw new Error('This function only works on node.js')
}
