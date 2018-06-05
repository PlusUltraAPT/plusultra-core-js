// @flow

import type {
  PlusultraAccountCallbacks,
  PlusultraCurrencyInfo,
  PlusultraTokenInfo,
  PlusultraWalletInfo
} from '../plusultra-core-index.js'
import type { ExchangePair } from './exchange/exchange-reducer.js'
import type {
  StorageWalletState,
  StorageWalletStatus
} from './storage/storage-reducer.js'

/**
 * The account fires this when it loads its keys from disk.
 */
export interface AccountKeysLoadedAction {
  type: 'ACCOUNT_KEYS_LOADED';
  payload: {
    activeLoginId: string,
    walletInfos: Array<PlusultraWalletInfo>
  };
}

/**
 * Somebody just added a custom token type to the wallet.
 */
export interface AddedCustomToken {
  type: 'ADDED_CUSTOM_TOKEN';
  payload: PlusultraTokenInfo;
}

/**
 * Called when a currency engine fires the onTransactionsChanged callback.
 */
export interface CurrencyEngineChangedTxs {
  type: 'CURRENCY_ENGINE_CHANGED_TXS';
  payload: {
    txs: Array<any>,
    walletId: string,
    txidHashes: any
  };
}

/**
 * Called when a currency engine is wiped out.
 */
export interface CurrencyEngineCleared {
  type: 'CURRENCY_ENGINE_CLEARED';
  payload: {
    walletId: string
  };
}

/**
 * Called when a currency engine dies on startup.
 */
export interface CurrencyEngineFailed {
  type: 'CURRENCY_ENGINE_FAILED';
  payload: {
    error: Error,
    walletId: string
  };
}

/**
 * Fired when the currency plugins failed to load.
 */
export interface CurrencyPluginsFailed {
  type: 'CURRENCY_PLUGINS_FAILED';
  payload: Error;
}

/**
 * Fired when the currency plugins load successfully.
 */
export interface CurrencyPluginsLoaded {
  type: 'CURRENCY_PLUGINS_LOADED';
  payload: Array<PlusultraCurrencyInfo>;
}

/**
 * Called when a currency wallet receives a new name.
 */
export interface CurrencyWalletFiatChanged {
  type: 'CURRENCY_WALLET_FIAT_CHANGED';
  payload: {
    fiatCurrencyCode: string,
    walletId: string
  };
}

/**
 * Called when a currency wallet's individual transaction metadata has changed.
 */
export interface CurrencyWalletFileChanged {
  type: 'CURRENCY_WALLET_FILE_CHANGED';
  payload: {
    json: any,
    txid: string,
    walletId: string,
    txFileName: any
  };
}

/**
 * Called when a currency wallet's files have been loaded from disk.
 */
export interface CurrencyWalletFilesLoaded {
  type: 'CURRENCY_WALLET_FILES_LOADED';
  payload: {
    files: any,
    walletId: string
  };
}

/**
 * Called when a currency wallet's file names have been loaded from disk.
 */
export interface CurrencyWalletFileNamesLoaded {
  type: 'CURRENCY_WALLET_FILE_NAMES_LOADED';
  payload: {
    txFileNames: any,
    walletId: string
  };
}

/**
 * Called when a currency wallet receives a new name.
 */
export interface CurrencyWalletNameChanged {
  type: 'CURRENCY_WALLET_NAME_CHANGED';
  payload: {
    name: string | null,
    walletId: string
  };
}

/**
 * Fired when we fetch exchange pairs from some server.
 */
export interface ExchangePairsFetched {
  type: 'EXCHANGE_PAIRS_FETCHED';
  payload: Array<ExchangePair>;
}

/**
 * Initializes the redux store on context creation.
 */
export interface InitAction {
  type: 'INIT';
  payload: {
    apiKey: string | void,
    appId: string | void,
    authServer: string | void
  };
}

/**
 * Fires when a user logs in.
 */
export interface LoginAction {
  type: 'LOGIN';
  payload: {
    appId: string,
    callbacks: PlusultraAccountCallbacks,
    loginKey: Uint8Array,
    username: string
  };
}

/**
 * Fires when a user logs out.
 */
export interface LogoutAction {
  type: 'LOGOUT';
  payload: { activeLoginId: string };
}

/**
 * Fires when a storage wallet has been loaded.
 */
export interface StorageWalletAdded {
  type: 'STORAGE_WALLET_ADDED';
  payload: {
    id: string,
    initialState: StorageWalletState
  };
}

/**
 * Fires when a repo has been synced.
 */
export interface StorageWalletSynced {
  type: 'STORAGE_WALLET_SYNCED';
  payload: {
    id: string,
    changes: Array<string>,
    status: StorageWalletStatus
  };
}

export type RootAction =
  | AccountKeysLoadedAction
  | AddedCustomToken
  | CurrencyEngineChangedTxs
  | CurrencyEngineCleared
  | CurrencyEngineFailed
  | CurrencyPluginsFailed
  | CurrencyPluginsLoaded
  | CurrencyWalletFiatChanged
  | CurrencyWalletFileChanged
  | CurrencyWalletFilesLoaded
  | CurrencyWalletFileNamesLoaded
  | CurrencyWalletNameChanged
  | ExchangePairsFetched
  | InitAction
  | LoginAction
  | LogoutAction
  | StorageWalletAdded
  | StorageWalletSynced
