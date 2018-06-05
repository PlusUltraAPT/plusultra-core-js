// @flow

import type {
  PlusultraAccount,
  PlusultraAccountCallbacks,
  PlusultraCreateCurrencyWalletOptions,
  PlusultraCurrencyWallet,
  PlusultraLobby,
  PlusultraWalletInfo,
  PlusultraWalletStates
} from '../../plusultra-core-index.js'
import { copyProperties, wrapObject } from '../../util/api.js'
import { base58 } from '../../util/encoding.js'
import { getCurrencyPlugin } from '../currency/currency-selectors.js'
import { makeExchangeCache } from '../exchange/exchange-api.js'
import { findFirstKey, makeKeysKit, makeStorageKeyInfo } from '../login/keys.js'
import { checkPassword } from '../login/password.js'
import { checkPin2 } from '../login/pin2.js'
import type { ApiInput } from '../root.js'
import { makeStorageWalletApi } from '../storage/storage-api.js'
import { makeAccountState } from './accountState.js'
import { makeLobbyApi } from './lobbyApi.js'

/**
 * Creates an `Account` API object.
 */
export function makeAccount (
  ai: ApiInput,
  appId: string,
  loginTree: any,
  loginType: string = '',
  callbacks: PlusultraAccountCallbacks | {} = {}
) {
  return makeAccountState(ai, appId, loginTree, callbacks).then(state =>
    wrapObject('Account', makeAccountApi(state, loginType, callbacks))
  )
}

/**
 * Creates an unwrapped account API object around an account state object.
 */
function makeAccountApi (
  state: any,
  loginType: string,
  callbacks: PlusultraAccountCallbacks | {}
): PlusultraAccount {
  const ai: ApiInput = state.ai
  const { activeLoginId, keyInfo } = state

  const exchangeCache = makeExchangeCache(ai)

  const rawAccount: PlusultraAccount = {
    // Basic login information:
    get appId (): string {
      return state.login.appId
    },
    get loggedIn (): boolean {
      return state.loginTree != null
    },
    get loginKey (): string {
      return base58.stringify(state.login.loginKey)
    },
    get recoveryKey (): string | void {
      return state.login.recovery2Key != null
        ? base58.stringify(state.login.recovery2Key)
        : void 0
    },
    get username (): string {
      return state.loginTree.username
    },

    // Exchange cache:
    get exchangeCache (): any {
      return exchangeCache
    },

    // What login method was used?
    get plusultraLogin (): boolean {
      return state.loginTree.loginKey == null
    },
    keyLogin: loginType === 'keyLogin',
    newAccount: loginType === 'newAccount',
    passwordLogin: loginType === 'passwordLogin',
    pinLogin: loginType === 'pinLogin',
    recoveryLogin: loginType === 'recoveryLogin',

    // Change or create credentials:
    changePassword (password: string): Promise<void> {
      return state.changePassword(password)
    },
    changePin (opts: {
      pin?: string, // We keep the existing PIN if unspecified
      enableLogin?: boolean // We default to true if unspecified
    }): Promise<string> {
      const { pin, enableLogin } = opts
      return state.changePin(pin, enableLogin).then(() => {
        return state.login.pin2Key ? base58.stringify(state.login.pin2Key) : ''
      })
    },
    changeRecovery (
      questions: Array<string>,
      answers: Array<string>
    ): Promise<string> {
      return state
        .changeRecovery(questions, answers)
        .then(() => base58.stringify(state.loginTree.recovery2Key))
    },

    // Verify existing credentials:
    checkPassword (password: string): Promise<boolean> {
      return checkPassword(ai, state.loginTree, password)
    },
    checkPin (pin: string): Promise<boolean> {
      // Try to check the PIN locally, then fall back on the server:
      return state.login.pin != null
        ? Promise.resolve(pin === state.login.pin)
        : checkPin2(ai, state.loginTree, pin)
    },

    // Remove credentials:
    deletePassword (): Promise<void> {
      return state.deletePassword()
    },
    deletePin (): Promise<void> {
      return state.deletePin()
    },
    deleteRecovery (): Promise<void> {
      return state.deleteRecovery()
    },

    // OTP:
    get otpKey (): string | void {
      return state.login.otpTimeout != null ? state.login.otpKey : void 0
    },
    get otpResetDate (): Date | void {
      return state.login.otpResetDate
    },
    cancelOtpReset (): Promise<void> {
      return state.cancelOtpReset()
    },
    enableOtp (timeout: number = 7 * 24 * 60 * 60): Promise<void> {
      return state.enableOtp(timeout)
    },
    disableOtp (): Promise<void> {
      return state.disableOtp()
    },

    // Plusultra login approval:
    fetchLobby (lobbyId: string): Promise<PlusultraLobby> {
      return makeLobbyApi(ai, lobbyId, state)
    },

    // Login management:
    logout (): Promise<void> {
      return state.logout()
    },

    // Master wallet list:
    get allKeys (): Array<any> {
      return state.allKeys
    },
    changeWalletStates (walletStates: PlusultraWalletStates): Promise<void> {
      return state.changeKeyStates(walletStates)
    },
    createWallet (type: string, keys: any): Promise<string> {
      if (keys == null) {
        // Use the currency plugin to create the keys:
        const plugin = getCurrencyPlugin(ai.props.output.currency.plugins, type)
        keys = plugin.createPrivateKey(type)
      }

      const keyInfo = makeStorageKeyInfo(ai, type, keys)
      const kit = makeKeysKit(ai, state.login, keyInfo)
      return state.applyKit(kit).then(() => keyInfo.id)
    },
    '@getFirstWalletInfo': { sync: true },
    getFirstWalletInfo (type: string): ?PlusultraWalletInfo {
      return findFirstKey(state.allKeys, type)
    },
    '@getWalletInfo': { sync: true },
    getWalletInfo (id: string): PlusultraWalletInfo {
      const info = state.allKeys.find(info => info.id === id)
      return info
    },
    '@listWalletIds': { sync: true },
    listWalletIds (): Array<string> {
      return state.login.keyInfos.map(info => info.id)
    },
    splitWalletInfo (walletId: string, newWalletType: string): Promise<string> {
      return state.splitWalletInfo(walletId, newWalletType)
    },
    '@listSplittableWalletTypes': { sync: true },
    listSplittableWalletTypes (walletId: string): Array<string> {
      return state.listSplittableWalletTypes(walletId)
    },

    // Currency wallets:
    get activeWalletIds (): Array<string> {
      return ai.props.state.login.logins[activeLoginId].activeWalletIds
    },
    get archivedWalletIds (): Array<string> {
      return ai.props.state.login.logins[activeLoginId].archivedWalletIds
    },
    get currencyWallets (): { [walletId: string]: PlusultraCurrencyWallet } {
      const allIds = ai.props.state.currency.currencyWalletIds
      const selfState = ai.props.state.login.logins[state.activeLoginId]
      const myIds = allIds.filter(id => id in selfState.allWalletInfos)

      const out = {}
      for (const walletId of myIds) {
        const api = ai.props.output.currency.wallets[walletId].api
        if (api) out[walletId] = api
      }

      return out
    },
    async createCurrencyWallet (
      type: string,
      opts?: PlusultraCreateCurrencyWalletOptions = {}
    ): Promise<PlusultraCurrencyWallet> {
      return state.createCurrencyWallet(type, opts)
    }
  }

  copyProperties(rawAccount, makeStorageWalletApi(ai, keyInfo, callbacks))

  return rawAccount
}
