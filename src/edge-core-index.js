// @flow

// Sub-module exports:
import * as error from './error.js'
import * as internal from './internal.js'

export { error }
export { internal }

// Ancillary exports:
export { makeBrowserIo } from './io/browser/browser-io.js'
export { makeFakeIos } from './io/fake/fake-io.js'
export { makeNodeIo } from './io/node/node-io.js'
export { makeReactNativeIo } from './io/react-native/react-native-io.js'
export { fakeUser } from './io/fake/fakeUser.js'
export { errorNames } from './error.js'
export {
  makeContext,
  makePlusultraContext,
  makeFakeContexts
} from './makeContext.js'
export { destroyAllContexts } from './modules/root.js'

// io types -----------------------------------------------------------

export interface DiskletFile {
  delete(): Promise<void>;
  getData(): Promise<Uint8Array>;
  getText(): Promise<string>;
  setData(data: Array<number> | Uint8Array): Promise<void>;
  setText(text: string): Promise<void>;
}

export interface DiskletFolder {
  delete(): Promise<void>;
  file(name: string): DiskletFile;
  folder(name: string): DiskletFolder;
  listFiles(): Promise<Array<string>>;
  listFolders(): Promise<Array<string>>;
}

// Node.js randomBytes function:
export type PlusultraRandomFunction = (bytes: number) => Uint8Array

// The only subset of `Console` that Plusultra core uses:
export type PlusultraConsole = {
  error(...data: Array<any>): void,
  info(...data: Array<any>): void,
  warn(...data: Array<any>): void
}

// The scrypt function Plusultra expects:
export type PlusultraScryptFunction = (
  data: Uint8Array,
  salt: Uint8Array,
  n: number,
  r: number,
  p: number,
  dklen: number
) => Promise<Uint8Array>

export type PlusultraSecp256k1 = {
  publicKeyCreate: (
    privateKey: Uint8Array,
    compressed: boolean
  ) => Promise<string>,
  privateKeyTweakAdd: (
    privateKey: Uint8Array,
    tweak: Uint8Array
  ) => Promise<Uint8Array>,
  publicKeyTweakAdd: (
    publicKey: Uint8Array,
    tweak: Uint8Array,
    compressed: boolean
  ) => Promise<Uint8Array>
}

export type PlusultraPbkdf2 = {
  deriveAsync: (
    key: Uint8Array,
    salt: Uint8Array,
    iter: number,
    len: number,
    algo: string
  ) => Promise<Uint8Array>
}

/**
 * Access to platform-specific resources, with many optional fields.
 * The core will emulate/adapt whatever is missing.
 */
export type PlusultraRawIo = {
  // Crypto:
  +random: PlusultraRandomFunction, // Non-optional & security-critical
  +scrypt?: PlusultraScryptFunction,
  +secp256k1?: PlusultraSecp256k1,
  +pbkdf2?: PlusultraPbkdf2,

  // Local io:
  +console?: PlusultraConsole,
  +folder?: DiskletFolder,
  +localStorage?: Storage,

  // Networking:
  +fetch: typeof fetch,
  +Socket?: net$Socket,
  +TLSSocket?: tls$TLSSocket,
  +WebSocket: WebSocket
}

/**
 * Access to platform-specific resources.
 * The core never talks to the outside world on its own,
 * but always goes through this object.
 */
export type PlusultraIo = {
  // Crypto:
  +random: PlusultraRandomFunction,
  +scrypt: PlusultraScryptFunction,
  // TODO: Make these two non-optional, providing JS versions as needed:
  +secp256k1?: PlusultraSecp256k1,
  +pbkdf2?: PlusultraPbkdf2,

  // Local io:
  +console: PlusultraConsole,
  +folder: DiskletFolder,

  // Networking:
  +fetch: typeof fetch,
  +Socket?: net$Socket, // Still optional (no browser version)
  +TLSSocket?: tls$TLSSocket, // Still optional (no browser version)
  +WebSocket: WebSocket
}

// context types ------------------------------------------------------

/* eslint-disable no-use-before-define */
export type PlusultraCorePluginFactory =
  | PlusultraCurrencyPluginFactory
  | PlusultraExchangePluginFactory

export type PlusultraCorePluginOptions = {
  io: PlusultraIo
}

export type PlusultraContextCallbacks = {
  +onError?: (e: Error) => mixed,
  +onExchangeUpdate?: () => mixed
}

export type PlusultraContextOptions = {
  apiKey?: string,
  appId?: string,
  authServer?: string,
  callbacks?: PlusultraContextCallbacks,
  io?: PlusultraRawIo,
  path?: string, // Only used on node.js
  plugins?: Array<PlusultraCorePluginFactory>,
  shapeshiftKey?: string
}

export type PlusultraContext = {
  appId: string,
  io: PlusultraIo,

  // Local user management:
  fixUsername(username: string): string,
  listUsernames(): Promise<Array<string>>,
  deleteLocalAccount(username: string): Promise<void>,

  // Account creation:
  usernameAvailable(username: string): Promise<boolean>,
  createAccount(
    username: string,
    password?: string,
    pin?: string,
    opts?: PlusultraAccountOptions
  ): Promise<PlusultraAccount>,

  // Plusultra login:
  requestPlusultraLogin(opts: PlusultraPlusultraLoginOptions): Promise<PlusultraPlusultraLoginRequest>,

  // Fingerprint login:
  loginWithKey(
    username: string,
    loginKey: string,
    opts?: PlusultraAccountOptions
  ): Promise<PlusultraAccount>,

  // Password login:
  checkPasswordRules(password: string): PlusultraPasswordRules,
  loginWithPassword(
    username: string,
    pin: string,
    opts?: PlusultraAccountOptions
  ): Promise<PlusultraAccount>,

  // PIN login:
  pinLoginEnabled(username: string): Promise<boolean>,
  loginWithPIN(
    username: string,
    pin: string,
    opts?: PlusultraAccountOptions
  ): Promise<PlusultraAccount>,

  // Recovery2 login:
  getRecovery2Key(username: string): Promise<string>,
  loginWithRecovery2(
    recovery2Key: string,
    username: string,
    answers: Array<string>,
    opts?: PlusultraAccountOptions
  ): Promise<PlusultraAccount>,
  fetchRecovery2Questions(
    recovery2Key: string,
    username: string
  ): Promise<Array<string>>,
  listRecoveryQuestionChoices(): Promise<Array<string>>,

  // OTP stuff:
  requestOtpReset(username: string, otpResetToken: string): Promise<Date>,
  fetchLoginMessages(): Promise<PlusultraLoginMessages>,

  // Misc. stuff:
  getCurrencyPlugins(): Promise<Array<PlusultraCurrencyPlugin>>,

  // Shapeshift:
  getExchangeSwapRate(
    fromCurrencyCode: string,
    toCurrencyCode: string
  ): Promise<number>,
  getExchangeSwapInfo(
    fromCurrencyCode: string,
    toCurrencyCode: string
  ): Promise<PlusultraExchangeSwapInfo>,
  getAvailableExchangeTokens(): Promise<Array<string>>
}

export type PlusultraExchangeSwapInfo = {
  rate: number,
  nativeMin: string,
  nativeMax: string,
  minerFee: string
}

export type PlusultraPasswordRules = {
  secondsToCrack: number,
  tooShort: boolean,
  noNumber: boolean,
  noLowerCase: boolean,
  noUpperCase: boolean,
  passed: boolean
}

export type PlusultraPlusultraLoginRequest = {
  id: string,
  cancelRequest(): void
}

export type PlusultraPlusultraLoginOptions = PlusultraAccountOptions & {
  displayImageUrl?: string,
  displayName?: string,
  onProcessLogin?: (username: string) => mixed,
  onLogin(e?: Error, account?: PlusultraAccount): mixed
}

export type PlusultraLoginMessages = {
  [username: string]: {
    otpResetPending: boolean,
    recovery2Corrupt: boolean
  }
}

// account types ------------------------------------------------------

export type PlusultraWalletInfo = {
  id: string,
  type: string,
  keys: any
}

export type PlusultraWalletInfoFull = {
  appIds: Array<string>,
  archived: boolean,
  deleted: boolean,
  id: string,
  keys: any,
  sortIndex: number,
  type: string
}

export type PlusultraWalletState = {
  archived?: boolean,
  deleted?: boolean,
  sortIndex?: number
}

export type PlusultraWalletStates = {
  [walletId: string]: PlusultraWalletState
}

export type PlusultraAccountCallbacks = {
  +onDataChanged?: () => mixed,
  +onKeyListChanged?: () => mixed,
  +onLoggedOut?: () => mixed,
  +onOtpDrift?: (drift: number) => mixed,
  +onRemoteOtpChange?: () => mixed,
  +onRemotePasswordChange?: () => mixed,

  // Currency wallet callbacks:
  +onAddressesChecked?: (walletId: string, progressRatio: number) => mixed,
  +onBalanceChanged?: (
    walletId: string,
    currencyCode: string,
    nativeBalance: string
  ) => mixed,
  +onBlockHeightChanged?: (walletId: string, blockHeight: number) => mixed,
  +onNewTransactions?: (
    walletId: string,
    abcTransactions: Array<PlusultraTransaction>
  ) => mixed,
  +onTransactionsChanged?: (
    walletId: string,
    abcTransactions: Array<PlusultraTransaction>
  ) => mixed,
  +onWalletDataChanged?: (walletId: string) => mixed,
  +onWalletNameChanged?: (walletId: string, name: string | null) => mixed
}

export type PlusultraAccountOptions = {
  otp?: string,
  callbacks?: PlusultraAccountCallbacks
}

export type PlusultraCreateCurrencyWalletOptions = {
  name?: string,
  fiatCurrencyCode?: string,
  keys?: {}
}

export type PlusultraAccount = {
  // Basic login information:
  +appId: string,
  +loggedIn: boolean,
  +loginKey: string,
  +recoveryKey: string | void, // For email backup
  +username: string,

  // Exchange-rate info:
  +exchangeCache: any,

  // What login method was used?
  +PlusultraLogin: boolean,
  keyLogin: boolean,
  newAccount: boolean,
  passwordLogin: boolean,
  pinLogin: boolean,
  recoveryLogin: boolean,

  // Change or create credentials:
  changePassword(password: string): Promise<void>,
  changePin(opts: {
    pin?: string, // We keep the existing PIN if unspecified
    enableLogin?: boolean // We default to true if unspecified
  }): Promise<string>,
  changeRecovery(
    questions: Array<string>,
    answers: Array<string>
  ): Promise<string>,

  // Verify existing credentials:
  checkPassword(password: string): Promise<boolean>,
  checkPin(pin: string): Promise<boolean>,

  // Remove credentials:
  deletePassword(): Promise<void>,
  deletePin(): Promise<void>,
  deleteRecovery(): Promise<void>,

  // OTP:
  +otpKey: string | void, // OTP is enabled if this exists
  +otpResetDate: Date | void, // A reset is requested if this exists
  cancelOtpReset(): Promise<void>,
  disableOtp(): Promise<void>,
  enableOtp(timeout?: number): Promise<void>,

  // Plusultra login approval:
  fetchLobby(lobbyId: string): Promise<PlusultraLobby>,

  // Login management:
  logout(): Promise<void>,

  // Master wallet list:
  +allKeys: Array<PlusultraWalletInfoFull>,
  changeWalletStates(walletStates: PlusultraWalletStates): Promise<void>,
  createWallet(type: string, keys: any): Promise<string>,
  getFirstWalletInfo(type: string): ?PlusultraWalletInfo,
  getWalletInfo(id: string): PlusultraWalletInfo,
  listWalletIds(): Array<string>,
  listSplittableWalletTypes(walletId: string): Array<string>,
  splitWalletInfo(walletId: string, newWalletType: string): Promise<string>,

  // Currency wallets:
  +activeWalletIds: Array<string>,
  +archivedWalletIds: Array<string>,
  +currencyWallets: { [walletId: string]: PlusultraCurrencyWallet },
  createCurrencyWallet(
    type: string,
    opts?: PlusultraCreateCurrencyWalletOptions
  ): Promise<PlusultraCurrencyWallet>
}

// Plusultra login types ---------------------------------------------------

export type PlusultraLobby = {
  loginRequest?: PlusultraLoginRequest
  // walletRequest?: PlusultraWalletRequest
}

export type PlusultraLoginRequest = {
  appId: string,
  approve(): Promise<void>,

  displayName: string,
  displayImageUrl?: string
}

// currency wallet types ----------------------------------------------

export type PlusultraTokenInfo = {
  currencyCode: string,
  currencyName: string,
  contractAddress: string,
  multiplier: string
}

export type PlusultraGetTransactionsOptions = {
  currencyCode?: string,
  startIndex?: number,
  startEntries?: 100,
  startDate?: number,
  endDate?: number,
  searchString?: string,
  returnIndex?: number,
  returnEntries?: number,
  denomination?: number
}

export type PlusultraCurrencyWallet = {
  // PlusultraWalletInfo members:
  +id: string,
  +keys: any,
  +type: string,

  // Data store:
  +folder: DiskletFolder,
  +localFolder: DiskletFolder,
  sync(): Promise<void>,

  // Wallet name:
  +name: string | null,
  renameWallet(name: string): Promise<void>,

  // Fiat currency option:
  +fiatCurrencyCode: string,
  setFiatCurrencyCode(fiatCurrencyCode: string): Promise<void>,

  // Currency info:
  +currencyInfo: PlusultraCurrencyInfo,

  // Running state:
  startEngine(): Promise<void>,
  stopEngine(): Promise<void>,

  // Token management:
  enableTokens(tokens: Array<string>): Promise<void>,
  disableTokens(tokens: Array<string>): Promise<void>,
  getEnabledTokens(): Promise<Array<string>>,
  addCustomToken(token: PlusultraTokenInfo): Promise<void>,

  // Transactions:
  getBalance(opts: any): string,
  getBlockHeight(): number,
  getNumTransactions(options: any): number,
  getTransactions(
    options?: PlusultraGetTransactionsOptions
  ): Promise<Array<PlusultraTransaction>>,
  getReceiveAddress(opts: any): Promise<PlusultraReceiveAddress>,
  saveReceiveAddress(receiveAddress: PlusultraReceiveAddress): Promise<void>,
  lockReceiveAddress(receiveAddress: PlusultraReceiveAddress): Promise<void>,
  makeAddressQrCode(address: PlusultraReceiveAddress): string,
  makeAddressUri(address: PlusultraReceiveAddress): string,
  makeSpend(spendInfo: PlusultraSpendInfo): Promise<PlusultraTransaction>,
  signTx(tx: PlusultraTransaction): Promise<PlusultraTransaction>,
  broadcastTx(tx: PlusultraTransaction): Promise<PlusultraTransaction>,
  saveTx(tx: PlusultraTransaction): Promise<void>,
  sweepPrivateKeys(PlusultraSpendInfo: PlusultraSpendInfo): Promise<PlusultraTransaction>,
  saveTxMetadata(
    txid: string,
    currencyCode: string,
    metadata: PlusultraMetadata
  ): Promise<void>,
  getMaxSpendable(spendInfo: PlusultraSpendInfo): Promise<string>,
  getQuote(spendInfo: PlusultraSpendInfo): Promise<PlusultraCoinExchangeQuote>,

  // Wallet management:
  resyncBlockchain(): Promise<void>,
  dumpData(): PlusultraDataDump,
  getDisplayPrivateSeed(): string | null,
  getDisplayPublicSeed(): string | null,

  // Data exports:
  exportTransactionsToQBO(opts: PlusultraGetTransactionsOptions): Promise<string>,
  exportTransactionsToCSV(opts: PlusultraGetTransactionsOptions): Promise<string>,

  // URI handling:
  parseUri(uri: string): PlusultraParsedUri,
  encodeUri(obj: PlusultraEncodeUri): string
}

export type PlusultraMetadata = {
  name?: string,
  category?: string,
  notes?: string,
  amountFiat?: number,
  bizId?: number,
  miscJson?: string
}

export type PlusultraSpendTarget = {
  currencyCode?: string,
  destWallet?: any,
  publicAddress?: string,
  nativeAmount?: string,
  destMetadata?: PlusultraMetadata
}

export type PlusultraSpendInfo = {
  currencyCode?: string,
  noUnconfirmed?: boolean,
  privateKeys?: Array<string>,
  spendTargets: Array<PlusultraSpendTarget>,
  nativeAmount?: string,
  quoteFor?: string,
  networkFeeOption?: string,
  customNetworkFee?: any,
  metadata?: PlusultraMetadata
}

export type PlusultraTransaction = {
  txid: string,
  date: number,
  currencyCode: string,
  blockHeight: number,
  nativeAmount: string,
  networkFee: string,
  ourReceiveAddresses: Array<string>,
  signedTx: string,
  parentNetworkFee?: string,
  metadata?: PlusultraMetadata,
  otherParams: any,
  wallet?: PlusultraCurrencyWallet
}

export type PlusultraDenomination = {
  name: string,
  multiplier: string,
  symbol?: string
}

export type PlusultraMetaToken = {
  currencyCode: string,
  currencyName: string,
  denominations: Array<PlusultraDenomination>,
  contractAddress?: string,
  symbolImage?: string
}

export type PlusultraCurrencyInfo = {
  // Basic currency information:
  currencyCode: string,
  currencyName: string,
  pluginName: string,
  denominations: Array<PlusultraDenomination>,
  walletTypes: Array<string>,

  // Configuration options:
  defaultSettings: any,
  metaTokens: Array<PlusultraMetaToken>,

  // Explorers:
  addressExplorer: string,
  blockExplorer?: string,
  transactionExplorer: string,

  // Images:
  symbolImage?: string,
  symbolImageDarkMono?: string
}

export type PlusultraParsedUri = {
  token?: PlusultraTokenInfo,
  privateKeys?: Array<string>,
  publicAddress?: string,
  legacyAddress?: string,
  segwitAddress?: string,
  nativeAmount?: string,
  currencyCode?: string,
  metadata?: PlusultraMetadata,
  bitIDURI?: string,
  bitIDDomain?: string,
  bitIDCallbackUri?: string,
  paymentProtocolUri?: string,
  returnUri?: string,
  bitidPaymentAddress?: string, // Experimental
  bitidKycProvider?: string, // Experimental
  bitidKycRequest?: string // Experimental
}

export type PlusultraEncodeUri = {
  publicAddress: string,
  segwitAddress?: string,
  legacyAddress?: string,
  nativeAmount?: string,
  label?: string,
  message?: string
}

export type PlusultraFreshAddress = {
  publicAddress: string,
  segwitAddress?: string,
  legacyAddress?: string
}

export type PlusultraDataDump = {
  walletId: string,
  walletType: string,
  pluginType: string,
  data: {
    [dataCache: string]: any
  }
}

export type PlusultraReceiveAddress = PlusultraFreshAddress & {
  metadata: PlusultraMetadata,
  nativeAmount: string
}

export type PlusultraCoinExchangeQuote = {
  depositAmountNative: string,
  withdrawalAmountNative: string,
  expiration: number, // this is in milliseconds since 1970/ it is a date.
  quotedRate: string,
  maxLimit: number,
  orderId: string,
  PlusultraTransacton: PlusultraTransaction
}

// currency plugin types ----------------------------------------------

export type PlusultraCurrencyEngineCallbacks = {
  +onBlockHeightChanged: (blockHeight: number) => void,
  +onTransactionsChanged: (abcTransactions: Array<PlusultraTransaction>) => void,
  +onBalanceChanged: (currencyCode: string, nativeBalance: string) => void,
  +onAddressesChecked: (progressRatio: number) => void,
  +onTxidsChanged: (txids: Array<string>) => void
}

export type PlusultraCurrencyEngineOptions = {
  callbacks: PlusultraCurrencyEngineCallbacks,
  walletLocalFolder: DiskletFolder,
  walletLocalEncryptedFolder: DiskletFolder,
  optionalSettings?: any
}

export type PlusultraCurrencyEngine = {
  updateSettings(settings: any): void,
  startEngine(): Promise<void>,
  killEngine(): Promise<void>,
  getBlockHeight(): number,
  enableTokens(tokens: Array<string>): Promise<void>,
  disableTokens(tokens: Array<string>): Promise<void>,
  getEnabledTokens(): Promise<Array<string>>,
  addCustomToken(token: PlusultraTokenInfo): Promise<void>,
  getTokenStatus(token: string): boolean,
  getBalance(options: any): string,
  getNumTransactions(options: any): number,
  getTransactions(options: any): Promise<Array<PlusultraTransaction>>,
  getFreshAddress(options: any): PlusultraFreshAddress,
  addGapLimitAddresses(addresses: Array<string>, options: any): void,
  isAddressUsed(address: string, options: any): boolean,
  makeSpend(abcSpendInfo: PlusultraSpendInfo): Promise<PlusultraTransaction>,
  +sweepPrivateKeys?: (abcSpendInfo: PlusultraSpendInfo) => Promise<PlusultraTransaction>,
  signTx(abcTransaction: PlusultraTransaction): Promise<PlusultraTransaction>,
  broadcastTx(abcTransaction: PlusultraTransaction): Promise<PlusultraTransaction>,
  saveTx(abcTransaction: PlusultraTransaction): Promise<void>,
  resyncBlockchain(): Promise<void>,
  dumpData(): PlusultraDataDump,
  getDisplayPrivateSeed(): string | null,
  getDisplayPublicSeed(): string | null
}

export type PlusultraCurrencyPlugin = {
  +pluginName: string,
  +currencyInfo: PlusultraCurrencyInfo,
  createPrivateKey(walletType: string): Object,
  derivePublicKey(walletInfo: PlusultraWalletInfo): Object,
  makeEngine(
    walletInfo: PlusultraWalletInfo,
    options: PlusultraCurrencyEngineOptions
  ): Promise<PlusultraCurrencyEngine>,
  parseUri(uri: string): PlusultraParsedUri,
  encodeUri(obj: PlusultraEncodeUri): string,
  getSplittableTypes?: (walletInfo: PlusultraWalletInfo) => Array<string>
}

export type PlusultraCurrencyPluginFactory = {
  pluginType: 'currency',
  +pluginName: string,
  makePlugin(opts: PlusultraCorePluginOptions): Promise<PlusultraCurrencyPlugin>
}

// exchange plugin types ----------------------------------------------

export type PlusultraExchangePairHint = {
  fromCurrency: string,
  toCurrency: string
}

export type PlusultraExchangePair = {
  fromCurrency: string,
  toCurrency: string,
  rate: number
}

export type PlusultraExchangePlugin = {
  exchangeInfo: { exchangeName: string },

  fetchExchangeRates(
    pairHints: Array<PlusultraExchangePairHint>
  ): Promise<Array<PlusultraExchangePair>>
}

export type PlusultraExchangePluginFactory = {
  pluginType: 'exchange',
  makePlugin(opts: PlusultraCorePluginOptions): Promise<PlusultraExchangePlugin>
}

// legacy names -------------------------------------------------------

export type {
  PlusultraConsole as AbcConsole,
  PlusultraScryptFunction as AbcScryptFunction,
  PlusultraSecp256k1 as AbcSecp256k1,
  PlusultraPbkdf2 as AbcPbkdf2,
  PlusultraRawIo as AbcRawIo,
  PlusultraIo as AbcIo,
  PlusultraCorePluginFactory as AbcCorePluginFactory,
  PlusultraCorePluginOptions as AbcCorePluginOptions,
  PlusultraContextCallbacks as AbcContextCallbacks,
  PlusultraContextOptions as AbcContextOptions,
  PlusultraContext as AbcContext,
  PlusultraExchangeSwapInfo as AbcExchangeSwapInfo,
  PlusultraPasswordRules as AbcPasswordRules,
  PlusultraPlusultraLoginRequest as AbcPlusultraLoginRequest,
  PlusultraPlusultraLoginOptions as AbcPlusultraLoginOptions,
  PlusultraLoginMessages as AbcLoginMessages,
  PlusultraWalletInfo as AbcWalletInfo,
  PlusultraWalletInfoFull as AbcWalletInfoFull,
  PlusultraWalletState as AbcWalletState,
  PlusultraWalletStates as AbcWalletStates,
  PlusultraAccountCallbacks as AbcAccountCallbacks,
  PlusultraAccountOptions as AbcAccountOptions,
  PlusultraCreateCurrencyWalletOptions as AbcCreateCurrencyWalletOptions,
  PlusultraAccount as AbcAccount,
  PlusultraLobby as AbcLobby,
  PlusultraLoginRequest as AbcLoginRequest,
  PlusultraCurrencyWallet as AbcCurrencyWallet,
  PlusultraMetadata as AbcMetadata,
  PlusultraSpendTarget as AbcSpendTarget,
  PlusultraSpendInfo as AbcSpendInfo,
  PlusultraTransaction as AbcTransaction,
  PlusultraDenomination as AbcDenomination,
  PlusultraMetaToken as AbcMetaToken,
  PlusultraCurrencyInfo as AbcCurrencyInfo,
  PlusultraParsedUri as AbcParsedUri,
  PlusultraEncodeUri as AbcEncodeUri,
  PlusultraFreshAddress as AbcFreshAddress,
  PlusultraDataDump as AbcDataDump,
  PlusultraReceiveAddress as AbcReceiveAddress,
  PlusultraCurrencyEngineCallbacks as AbcCurrencyEngineCallbacks,
  PlusultraCurrencyEngineOptions as AbcCurrencyEngineOptions,
  PlusultraCurrencyEngine as AbcCurrencyEngine,
  PlusultraCurrencyPlugin as AbcCurrencyPlugin,
  PlusultraCurrencyPluginFactory as AbcCurrencyPluginFactory,
  PlusultraExchangePairHint as AbcExchangePairHint,
  PlusultraExchangePair as AbcExchangePair,
  PlusultraExchangePlugin as AbcExchangePlugin,
  PlusultraExchangePluginFactory as AbcExchangePluginFactory,
  // Wrong names:
  PlusultraCorePluginFactory as AbcCorePlugin,
  PlusultraContextOptions as AbcMakeContextOpts,
  PlusultraCurrencyEngineOptions as AbcMakeEngineOptions,
  PlusultraCurrencyEngineCallbacks as AbcCurrencyPluginCallbacks
}
