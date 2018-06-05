// @flow

import type { PlusultraWalletInfo } from '../../plusultra-core-index.js'
import { errorNames } from '../../error.js'
import { encrypt } from '../../util/crypto/crypto.js'
import { base64 } from '../../util/encoding.js'
import type { ApiInput } from '../root.js'
import { authRequest } from './authServer.js'
import { makeKeysKit } from './keys.js'
import type { LoginKit, LoginTree } from './login-types.js'
import { fixUsername, hashUsername } from './loginStore.js'
import { makePasswordKit } from './password.js'
import { makeChangePin2Kit } from './pin2.js'

export interface LoginCreateOpts {
  keyInfo?: PlusultraWalletInfo;
  password?: string | void;
  pin?: string | void;
}

/**
 * Determines whether or not a username is available.
 */
export function usernameAvailable (ai: ApiInput, username: string) {
  return hashUsername(ai, username).then(userId => {
    const request = {
      userId: base64.stringify(userId)
    }
    return authRequest(ai, 'POST', '/v2/login', request)
      .then(reply => false) // It's not available if we can hit it!
      .catch(e => {
        if (e.name !== errorNames.UsernameError) throw e
        return true
      })
  })
}

/**
 * Assembles all the data needed to create a new login.
 */
export function makeCreateKit (
  ai: ApiInput,
  parentLogin?: LoginTree,
  appId: string,
  username: string,
  opts: LoginCreateOpts
): Promise<LoginKit> {
  const { io } = ai.props

  // Figure out login identity:
  const loginId =
    parentLogin != null ? io.random(32) : hashUsername(ai, username)
  const loginKey = io.random(32)
  const loginAuth = io.random(32)
  const loginAuthBox = encrypt(io, loginAuth, loginKey)

  // Set up login methods:
  const parentBox =
    parentLogin != null ? encrypt(io, loginKey, parentLogin.loginKey) : void 0
  const passwordKit =
    opts.password != null
      ? makePasswordKit(ai, { loginKey }, username, opts.password)
      : {}
  const pin2Kit =
    opts.pin != null
      ? makeChangePin2Kit(ai, { loginKey }, username, opts.pin, true)
      : {}
  const keysKit =
    opts.keyInfo != null ? makeKeysKit(ai, { loginKey }, opts.keyInfo) : {}

  // Bundle everything:
  return Promise.all([loginId, passwordKit]).then(values => {
    const [loginIdRaw, passwordKit] = values
    const loginId = base64.stringify(loginIdRaw)
    return {
      loginId,
      serverPath: '/v2/login/create',
      server: {
        appId,
        loginAuth: base64.stringify(loginAuth),
        loginAuthBox,
        loginId,
        parentBox,
        ...passwordKit.server,
        ...pin2Kit.server,
        ...keysKit.server
      },
      stash: {
        appId,
        loginAuthBox,
        loginId,
        parentBox,
        ...passwordKit.stash,
        ...pin2Kit.stash,
        ...keysKit.stash
      },
      login: {
        appId,
        loginAuth,
        loginId,
        loginKey,
        keyInfos: [],
        ...passwordKit.login,
        ...pin2Kit.login,
        ...keysKit.login
      }
    }
  })
}

/**
 * Creates a new login on the auth server.
 */
export function createLogin (
  ai: ApiInput,
  username: string,
  opts: LoginCreateOpts
): Promise<LoginTree> {
  const fixedName = fixUsername(username)

  return makeCreateKit(ai, void 0, '', fixedName, opts).then(kit => {
    kit.login.username = fixedName
    kit.stash.username = fixedName
    kit.login.userId = kit.login.loginId

    const request = {}
    request.data = kit.server
    return authRequest(ai, 'POST', kit.serverPath, request).then(reply =>
      ai.props.loginStore.save(kit.stash).then(() => kit.login)
    )
  })
}
