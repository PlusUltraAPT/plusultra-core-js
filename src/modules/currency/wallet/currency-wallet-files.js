// @flow

import { number as currencyFromNumber } from 'currency-codes'
import { mapFiles } from 'disklet'

import { mergeDeeply } from '../../../util/util.js'
import { fetchAppIdInfo } from '../../account/lobbyApi.js'
import { getExchangeRate } from '../../exchange/exchange-selectors.js'
import {
  getStorageWalletFolder,
  getStorageWalletLocalFolder,
  hashStorageWalletFilename
} from '../../storage/storage-selectors.js'
import { getCurrencyMultiplier } from '../currency-selectors.js'
import { combineTxWithFile } from './currency-wallet-api.js'
import { forEachListener } from './currency-wallet-callbacks.js'
import type { CurrencyWalletInput } from './currency-wallet-pixie.js'

const LEGACY_MAP_FILE = 'fixedLegacyFileNames.json'
const WALLET_NAME_FILE = 'WalletName.json'
const CURRENCY_FILE = 'Currency.json'

export type TransactionFile = {
  txid: string,
  internal: boolean,
  creationDate: number,
  currencies: {
    [currencyCode: string]: {
      metadata: {
        bizId?: number,
        category?: string,
        exchangeAmount: { [fiatCurrencyCode: string]: number },
        name?: string,
        notes?: string
      },
      nativeAmount?: string,
      providerFeeSent?: string
    }
  }
}

export type LegacyTransactionFile = {
  airbitzFeeWanted: number,
  meta: {
    amountFeeAirBitzSatoshi: number,
    balance: number,
    fee: number,

    // Metadata:
    amountCurrency: number,
    bizId: number,
    category: string,
    name: string,
    notes: string,

    // Obsolete/moved fields:
    attributes: number,
    amountSatoshi: number,
    amountFeeMinersSatoshi: number,
    airbitzFee: number
  },
  ntxid: string,
  state: {
    creationDate: number,
    internal: boolean,
    malleableTxId: string
  }
}

export type LegacyAddressFile = {
  seq: number, // index
  address: string,
  state: {
    recycleable: boolean,
    creationDate: number
  },
  meta: {
    amountSatoshi: number // requestAmount
    // TODO: Normal PlusultraMetadata
  }
}

/**
 * Converts a LegacyTransactionFile to a TransactionFile.
 */
function fixLegacyFile (
  file: LegacyTransactionFile,
  walletCurrency: string,
  walletFiat: string
) {
  const out: TransactionFile = {
    creationDate: file.state.creationDate,
    currencies: {},
    internal: file.state.internal,
    txid: file.state.malleableTxId
  }
  out.currencies[walletCurrency] = {
    metadata: {
      bizId: file.meta.bizId,
      category: file.meta.category,
      exchangeAmount: {},
      name: file.meta.name,
      notes: file.meta.notes
    },
    providerFeeSent: file.meta.amountFeeAirBitzSatoshi.toFixed()
  }
  out.currencies[walletCurrency].metadata.exchangeAmount[walletFiat] =
    file.meta.amountCurrency

  return out
}

function getTxFile (state: any, keyId: string, date: number, txid: string) {
  const txidHash = hashStorageWalletFilename(state, keyId, txid)
  const timestamp = date.toFixed(0)
  const fileName = `${timestamp}-${txidHash}.json`
  return {
    txFileName: { txidHash, timestamp, fileName },
    txFile: getStorageWalletFolder(state, keyId)
      .folder('transaction')
      .file(fileName)
  }
}

/**
 * Changes a wallet's name.
 */
export function renameCurrencyWallet (
  input: CurrencyWalletInput,
  name: string | null
): Promise<mixed> {
  const walletId = input.props.id
  const { dispatch, state } = input.props

  return getStorageWalletFolder(state, walletId)
    .file(WALLET_NAME_FILE)
    .setText(JSON.stringify({ walletName: name }))
    .then(() =>
      dispatch({
        type: 'CURRENCY_WALLET_NAME_CHANGED',
        payload: { name, walletId }
      })
    )
}

/**
 * Changes a wallet's fiat currency code.
 */
export function setCurrencyWalletFiat (
  input: CurrencyWalletInput,
  fiatCurrencyCode: string
): Promise<mixed> {
  const walletId = input.props.id
  const { dispatch, state } = input.props

  if (!/^iso:/.test(fiatCurrencyCode)) {
    throw new TypeError('Fiat currency codes must start with `iso:`')
  }

  return getStorageWalletFolder(state, walletId)
    .file(CURRENCY_FILE)
    .setText(JSON.stringify({ fiat: fiatCurrencyCode }))
    .then(() =>
      dispatch({
        type: 'CURRENCY_WALLET_FIAT_CHANGED',
        payload: { fiatCurrencyCode, walletId }
      })
    )
}

/**
 * Loads the wallet fiat currency file.
 */
function loadFiatFile (input: CurrencyWalletInput, folder) {
  const walletId = input.props.id
  const { dispatch } = input.props

  return folder
    .file(CURRENCY_FILE)
    .getText()
    .then(text => {
      const file = JSON.parse(text)
      return file.fiat ? file.fiat : 'iso:' + currencyFromNumber(file.num).code
    })
    .catch(e => 'iso:USD')
    .then((fiatCurrencyCode: string) => {
      dispatch({
        type: 'CURRENCY_WALLET_FIAT_CHANGED',
        payload: { fiatCurrencyCode, walletId }
      })
      return fiatCurrencyCode
    })
}

/**
 * Loads the wallet name file.
 */
function loadNameFile (input: CurrencyWalletInput, folder) {
  const walletId = input.props.id
  const { dispatch } = input.props

  return folder
    .file(WALLET_NAME_FILE)
    .getText()
    .then(text => JSON.parse(text).walletName)
    .catch(async e => {
      // The wallet info does happen to have full data, so this works:
      const fullWalletInfo: any = input.props.selfState.walletInfo
      const name = await fetchBackupName(input, fullWalletInfo.appIds || [])
      if (name != null) await renameCurrencyWallet(input, name)
      return name
    })
    .then((name: string | null) =>
      dispatch({
        type: 'CURRENCY_WALLET_NAME_CHANGED',
        payload: {
          name: typeof name === 'string' ? name : null,
          walletId
        }
      })
    )
}

/**
 * If a wallet has no name file, try to pick a name based on the appId.
 */
function fetchBackupName (
  input: CurrencyWalletInput,
  appIds: Array<string>
): Promise<string | null> {
  // Dirty type hack, but `io` and `onError` do exist on both objects:
  const ai: any = input
  for (const appId of appIds) {
    if (appId !== '') {
      return fetchAppIdInfo(ai, appId).then(info => info.displayName)
    }
  }

  return Promise.resolve(null)
}

/**
 * Loads transaction metadata files.
 */
export async function loadTxFiles (
  input: CurrencyWalletInput,
  txIdHashes: Array<string>
): any {
  const walletId = input.props.id
  const folder = getStorageWalletFolder(input.props.state, walletId)
  const { dispatch } = input.props
  const walletCurrency = input.props.selfState.currencyInfo.currencyCode
  const fileNames = input.props.selfState.fileNames
  const walletFiat = input.props.selfState.fiat

  const getFiles = (folderName, cb) =>
    Promise.all(
      txIdHashes.map(txidHash =>
        folder
          .folder(folderName)
          .file(fileNames[txidHash].fileName)
          .getText()
          .then(text => cb(JSON.parse(text), txidHash))
          .catch(e => null)
      )
    )

  const out = {}
  await getFiles('Transactions', (json, txidHash) => {
    if (!json.state || !json.state.malleableTxId) return
    out[txidHash] = fixLegacyFile(json, walletCurrency, walletFiat)
  })
  await getFiles('transaction', (json, txidHash) => {
    if (!json.txid) return
    out[txidHash] = json
  })

  dispatch({
    type: 'CURRENCY_WALLET_FILES_LOADED',
    payload: { files: out, walletId }
  })
  return out
}

/**
 * Return the legacy file names in the new format.
 * If they in the legacy format, convert them to the new format
 * and cache them on disk
 */
async function getLegacyFileNames (state: any, walletId: string, folder) {
  const newFormatFileNames = {}
  // Get the non encrypted folder
  const localFolder = getStorageWalletLocalFolder(state, walletId)
  const fixedNamesFile = localFolder.file(LEGACY_MAP_FILE)
  const legacyFileNames = []
  let legacyMap = {}
  try {
    // Get the real legacy file names
    await mapFiles(folder, (file, name) => legacyFileNames.push(name))
  } catch (e) {}
  try {
    const text = await fixedNamesFile.getText()
    legacyMap = JSON.parse(text)
  } catch (e) {}

  const missingLegacyFiles = []
  for (let i = 0; i < legacyFileNames.length; i++) {
    const fileName = legacyFileNames[i]
    const fileNameMap = legacyMap[fileName]
    // If we haven't converted it, then open the legacy file and convert it to the new format
    if (fileNameMap) {
      const { timestamp, txidHash } = fileNameMap
      newFormatFileNames[txidHash] = { timestamp, fileName }
    } else {
      missingLegacyFiles.push(fileName)
    }
  }
  const convertFileNames = missingLegacyFiles.map(legacyFileName =>
    folder
      .file(legacyFileName)
      .getText()
      .then(txText => {
        const legacyFile = JSON.parse(txText)
        const { creationDate, malleableTxId } = legacyFile.state
        const timestamp = creationDate
        const fileName = legacyFileName
        const txidHash = hashStorageWalletFilename(
          state,
          walletId,
          malleableTxId
        )
        newFormatFileNames[txidHash] = { timestamp, fileName }
        legacyMap[fileName] = { timestamp, txidHash }
      })
      .catch(e => null)
  )

  if (convertFileNames.length) {
    await Promise.all(convertFileNames)
    // Cache the new results
    try {
      await fixedNamesFile.setText(JSON.stringify(legacyMap))
    } catch (e) {}
  }
  return newFormatFileNames
}

/**
 * Loads transaction metadata file names.
 */
async function loadTxFileNames (input: CurrencyWalletInput, folder) {
  const walletId = input.props.id
  const { dispatch, state } = input.props
  const txFileNames = {}
  // New transactions files:
  await mapFiles(folder.folder('transaction'), (file, fileName) => {
    const prefix = fileName.split('.json')[0]
    const [timestamp, txidHash] = prefix.split('-')
    txFileNames[txidHash] = {
      fileName,
      timestamp: parseInt(timestamp)
    }
  })

  // Legacy transactions files:
  const legacyFileNames = await getLegacyFileNames(
    state,
    walletId,
    folder.folder('Transactions')
  )
  Object.assign(txFileNames, legacyFileNames)

  dispatch({
    type: 'CURRENCY_WALLET_FILE_NAMES_LOADED',
    payload: { txFileNames, walletId }
  })
}

/**
 * Loads address metadata files.
 */
function loadAddressFiles (input: CurrencyWalletInput, folder) {
  // Actually load the files:
  const allFiles = Promise.all([
    // Legacy transaction metadata:
    mapFiles(folder.folder('Addresses'), file =>
      file
        .getText()
        .then(text => JSON.parse(text))
        .catch(e => null)
    )
  ])

  // Save the results to our state:
  return allFiles.then(allFiles => {
    const [oldFiles] = allFiles

    const out: Array<string> = []
    for (const json: LegacyAddressFile of oldFiles) {
      if (json == null || !json.state || !json.meta) continue
      const address = json.address
      if (!address || json.state.recycleable) continue
      out.push(address)
    }

    // Load these addresses into the engine:
    const engine = input.props.selfOutput.engine
    if (engine) engine.addGapLimitAddresses(out)

    return out
  })
}

/**
 * Updates the wallet in response to data syncs.
 */
export async function loadAllFiles (input: CurrencyWalletInput) {
  const walletId = input.props.id
  const folder = getStorageWalletFolder(input.props.state, walletId)

  await loadFiatFile(input, folder)
  await loadNameFile(input, folder)
  await loadTxFileNames(input, folder)
  await loadAddressFiles(input, folder)
}

/**
 * Changes a wallet's metadata.
 */
export function setCurrencyWalletTxMetadata (
  input: CurrencyWalletInput,
  txid: string,
  currencyCode: string,
  metadata: any
) {
  const walletId = input.props.id
  const { dispatch, state } = input.props

  // Find the tx:
  const tx = input.props.selfState.txs[txid]
  if (!tx) {
    throw new Error(`Setting metatdata for missing tx ${txid}`)
  }

  const files = input.props.selfState.files
  // Get the txidHash for this txid
  let txidHash = ''
  for (const hash of Object.keys(files)) {
    if (files[hash].txid === txid) {
      txidHash = hash
      break
    }
  }

  // Load the old file:
  const oldFile = input.props.selfState.files[txidHash]
  const creationDate =
    oldFile == null ? Date.now() / 1000 : oldFile.creationDate

  // Set up the new file:
  const { txFileName, txFile } = getTxFile(state, walletId, creationDate, txid)
  const newFile: TransactionFile = {
    txid,
    internal: false,
    creationDate,
    currencies: {}
  }
  newFile.currencies[currencyCode] = {
    metadata
  }
  const file = mergeDeeply(oldFile, newFile)

  // Save the new file:
  dispatch({
    type: 'CURRENCY_WALLET_FILE_CHANGED',
    payload: { json: file, txid, walletId, txFileName }
  })
  return txFile.setText(JSON.stringify(file)).then(() => {
    const callbackTx = combineTxWithFile(input, tx, file, currencyCode)
    forEachListener(input, ({ onTransactionsChanged }) => {
      if (onTransactionsChanged) {
        onTransactionsChanged(walletId, [callbackTx])
      }
    })

    return void 0
  })
}

export function setupNewTxMetadata (input: CurrencyWalletInput, tx: any) {
  const walletId = input.props.id
  const { dispatch, state } = input.props

  const txid = tx.txid
  const { txFileName, txFile } = getTxFile(
    state,
    walletId,
    Date.now() / 1000,
    txid
  )
  const currencyInfo = input.props.selfState.currencyInfo
  const fiatCurrency: string = input.props.selfState.fiat || 'iso:USD'

  // Basic file template:
  const file: TransactionFile = {
    txid,
    internal: true,
    creationDate: Date.now() / 1000,
    currencies: {}
  }

  // Set up exchange-rate metadata:
  for (const currency of Object.keys(tx.nativeAmount)) {
    const rate =
      getExchangeRate(state, currency, fiatCurrency, () => 1) /
      parseFloat(
        getCurrencyMultiplier(
          [currencyInfo],
          input.props.state.currency.customTokens,
          currency
        )
      )
    const nativeAmount = tx.nativeAmount[currency]

    const metadata = { exchangeAmount: {} }
    metadata.exchangeAmount[fiatCurrency] = rate * nativeAmount
    file.currencies[currency] = { metadata, nativeAmount }
  }

  // Save the new file:
  dispatch({
    type: 'CURRENCY_WALLET_FILE_CHANGED',
    payload: { json: file, txid, walletId, txFileName }
  })
  return txFile.setText(JSON.stringify(file)).then(() => void 0)
}
