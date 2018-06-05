// @flow

import 'regenerator-runtime/runtime'

import { isReactNative } from 'detect-bundler'

import type { PlusultraContext, PlusultraContextOptions } from './plusultra-core-index.js'
import { isNode, makeNodeIo } from './io/node/node-io.js'
import { makeReactNativeIo } from './io/react-native/react-native-io.js'
import {
  makeCoreRoot,
  makeFakeCoreRoots,
  startCoreRoot
} from './modules/root.js'

/**
 * Initializes the Plusultra core library,
 * defaulting to the browser if no `io` option is provided.
 */
export function makeContext (opts: PlusultraContextOptions): PlusultraContext {
  const coreRoot = makeCoreRoot(opts)
  startCoreRoot(coreRoot)
  return coreRoot.output.contextApi
}

/**
 * Initializes the Plusultra core library,
 * automatically selecting the appropriate platform.
 */
export function makePlusultraContext (
  opts: PlusultraContextOptions
): Promise<PlusultraContext> {
  if (isReactNative) return makeReactNativeContext(opts)
  if (isNode) return Promise.resolve(makeNodeContext(opts))
  return Promise.resolve(makeContext(opts))
}

/**
 * Creates one or more fake Plusultra core library instances for testing.
 *
 * The instances all share the same virtual server,
 * but each context receives its own options.
 *
 * The virtual server comes pre-populated with a testing account.
 * The credentials for this account are available in the 'fakeUser' export.
 * Setting the `localFakeUser` context option to `true` will enable PIN
 * and offline password login for that particular context.
 */
export function makeFakeContexts (
  ...opts: Array<PlusultraContextOptions>
): Array<PlusultraContext> {
  return makeFakeCoreRoots(...opts).map(coreRoot => {
    startCoreRoot(coreRoot)
    return coreRoot.output.contextApi
  })
}

/**
 * Creates an Plusultra context for use on node.js.
 *
 * @param {{ path?: string }} opts Options for creating the context,
 * including the `path` where data should be written to disk.
 */
export function makeNodeContext (opts: PlusultraContextOptions = {}) {
  const { path = './plusultra' } = opts
  opts.io = makeNodeIo(path)
  return makeContext(opts)
}

/**
 * Creates an Plusultra context for use with React Native.
 */
export function makeReactNativeContext (
  opts: PlusultraContextOptions
): Promise<PlusultraContext> {
  return makeReactNativeIo().then(io => makeContext({ ...opts, io }))
}
