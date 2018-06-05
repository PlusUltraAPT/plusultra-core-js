// @flow

import { add, div, lte, mul, sub } from 'biggystring'

import type {
  PlusultraCoinExchangeQuote,
  PlusultraCurrencyEngine,
  PlusultraCurrencyPlugin,
  PlusultraCurrencyWallet,
  PlusultraDataDump,
  PlusultraEncodeUri,
  PlusultraGetTransactionsOptions,
  PlusultraMetadata,
  PlusultraReceiveAddress,
  PlusultraSpendInfo,
  PlusultraSpendTarget,
  PlusultraTokenInfo,
  PlusultraTransaction
} from '../../../plusultra-core-index.js'
import { SameCurrencyError } from '../../../error.js'
import { wrapObject } from '../../../util/api.js'
import { filterObject, mergeDeeply } from '../../../util/util.js'
import { getCurrencyMultiplier } from '../../currency/currency-selectors'
import { makeShapeshiftApi } from '../../exchange/shapeshift.js'
import type { ShapeShiftExactQuoteReply } from '../../exchange/shapeshift.js'
import type { ApiInput } from '../../root.js'
import { makeStorageWalletApi } from '../../storage/storage-api.js'
import {
  exportTransactionsToCSVInner,
  exportTransactionsToQBOInner
} from './currency-wallet-export.js'
import {
  loadTxFiles,
  renameCurrencyWallet,
  setCurrencyWalletFiat,
  setCurrencyWalletTxMetadata
} from './currency-wallet-files.js'
import type { CurrencyWalletInput } from './currency-wallet-pixie.js'

const fakeMetadata = {
  bizId: 0,
  category: '',
  exchangeAmount: {},
  name: '',
  notes: ''
}

/**
 * Creates an `PlusultraCurrencyWallet` API object.
 */
export function makeCurrencyWalletApi (
  input: CurrencyWalletInput,
  plugin: PlusultraCurrencyPlugin,
  engine: PlusultraCurrencyEngine
) {
  const ai: ApiInput = (input: any) // Safe, since input extends ApiInput
  const walletInfo = input.props.selfState.walletInfo

  const shapeshiftApi = makeShapeshiftApi(ai)
  const storageWalletApi = makeStorageWalletApi(ai, walletInfo, {})

  const out: PlusultraCurrencyWallet = {
    // Storage wallet properties:
    get id () {
      return storageWalletApi.id
    },
    get type () {
      return storageWalletApi.type
    },
    get keys () {
      return storageWalletApi.keys
    },
    get folder () {
      return storageWalletApi.folder
    },
    get localFolder () {
      return storageWalletApi.localFolder
    },
    sync () {
      return storageWalletApi.sync()
    },

    // Storage stuff:
    get name () {
      return input.props.selfState.name
    },
    renameWallet (name: string) {
      return renameCurrencyWallet(input, name).then(() => {})
    },

    // Currency info:
    get fiatCurrencyCode (): string {
      return input.props.selfState.fiat
    },
    get currencyInfo () {
      return plugin.currencyInfo
    },
    setFiatCurrencyCode (fiatCurrencyCode: string) {
      return setCurrencyWalletFiat(input, fiatCurrencyCode).then(() => {})
    },

    // Running state:
    startEngine () {
      return engine.startEngine()
    },

    stopEngine (): Promise<void> {
      return Promise.resolve(engine.killEngine())
    },

    enableTokens (tokens: Array<string>) {
      return engine.enableTokens(tokens)
    },

    disableTokens (tokens: Array<string>) {
      return engine.disableTokens(tokens)
    },

    getEnabledTokens () {
      return engine.getEnabledTokens()
    },

    addCustomToken (tokenInfo: PlusultraTokenInfo) {
      ai.props.dispatch({ type: 'ADDED_CUSTOM_TOKEN', payload: tokenInfo })
      return engine.addCustomToken(tokenInfo)
    },

    // Transactions:
    '@getBalance': { sync: true },
    getBalance (opts: any) {
      return engine.getBalance(opts)
    },

    '@getBlockHeight': { sync: true },
    getBlockHeight () {
      return engine.getBlockHeight()
    },

    '@getNumTransactions': { sync: true },
    getNumTransactions (opts: any) {
      return engine.getNumTransactions(opts)
    },

    async getTransactions (
      opts: PlusultraGetTransactionsOptions = {}
    ): Promise<Array<PlusultraTransaction>> {
      const defaultCurrency = plugin.currencyInfo.currencyCode
      const currencyCode = opts.currencyCode || defaultCurrency
      const state = input.props.selfState
      // Txid array of all txs
      const txids = state.txids
      // Merged tx data from metadata files and blockchain data
      const txs = state.txs
      const { startIndex = 0, startEntries = txids.length } = opts
      // Decrypted metadata files
      const files = state.files
      // A sorted list of transaction based on chronological order
      const sortedTransactions = state.sortedTransactions.sortedList
      // Quick fix for Tokens
      const allInfos = input.props.state.currency.infos
      let slice = false
      for (const currencyInfo of allInfos) {
        if (currencyCode === currencyInfo.currencyCode) {
          slice = true
          break
        }
      }
      const slicedTransactions = slice
        ? sortedTransactions.slice(startIndex, startIndex + startEntries)
        : sortedTransactions
      const missingTxIdHashes = slicedTransactions.filter(
        txidHash => !files[txidHash]
      )
      const missingFiles = await loadTxFiles(input, missingTxIdHashes)
      Object.assign(files, missingFiles)

      const out = []
      for (const txidHash of slicedTransactions) {
        const file = files[txidHash]
        const tx = txs[file.txid]
        // Skip irrelevant transactions:
        if (
          !tx ||
          (!tx.nativeAmount[currencyCode] && !tx.networkFee[currencyCode])
        ) {
          continue
        }

        out.push(combineTxWithFile(input, tx, file, currencyCode))
      }

      return out
    },

    async exportTransactionsToQBO (
      opts: PlusultraGetTransactionsOptions
    ): Promise<string> {
      const plusultraTransactions: Array<
        PlusultraTransaction
      > = await this.getTransactions(opts)
      const currencyCode =
        opts && opts.currencyCode ? opts.currencyCode : this.currencyCode
      const denom = opts && opts.denomination ? opts.denomination : null
      const qbo: string = exportTransactionsToQBOInner(
        plusultraTransactions,
        currencyCode,
        this.fiatCurrencyCode,
        denom,
        Date.now()
      )
      return qbo
    },

    async exportTransactionsToCSV (
      opts: PlusultraGetTransactionsOptions
    ): Promise<string> {
      const plusultraTransactions: Array<
        PlusultraTransaction
      > = await this.getTransactions(opts)
      const currencyCode =
        opts && opts.currencyCode ? opts.currencyCode : this.currencyCode
      const denom = opts && opts.denomination ? opts.denomination : null
      const csv: string = await exportTransactionsToCSVInner(
        plusultraTransactions,
        currencyCode,
        this.fiatCurrencyCode,
        denom
      )
      return csv
    },

    getReceiveAddress (opts: any): Promise<PlusultraReceiveAddress> {
      const freshAddress = engine.getFreshAddress(opts)
      const receiveAddress: PlusultraReceiveAddress = {
        metadata: fakeMetadata,
        nativeAmount: '0',
        publicAddress: freshAddress.publicAddress,
        legacyAddress: freshAddress.legacyAddress,
        segwitAddress: freshAddress.segwitAddress
      }
      return Promise.resolve(receiveAddress)
    },

    saveReceiveAddress (receiveAddress: PlusultraReceiveAddress): Promise<void> {
      return Promise.resolve()
    },

    lockReceiveAddress (receiveAddress: PlusultraReceiveAddress): Promise<void> {
      return Promise.resolve()
    },

    '@makeAddressQrCode': { sync: true },
    makeAddressQrCode (address: PlusultraReceiveAddress) {
      return address.publicAddress
    },

    '@makeAddressUri': { sync: true },
    makeAddressUri (address: PlusultraReceiveAddress) {
      return address.publicAddress
    },

    async makeSpend (spendInfo: PlusultraSpendInfo): Promise<PlusultraTransaction> {
      return engine.makeSpend(spendInfo)
    },

    async sweepPrivateKeys (spendInfo: PlusultraSpendInfo): Promise<PlusultraTransaction> {
      if (!engine.sweepPrivateKeys) {
        return Promise.reject(
          new Error('Sweeping this currency is not supported.')
        )
      }
      return engine.sweepPrivateKeys(spendInfo)
    },

    async getQuote (spendInfo: PlusultraSpendInfo): Promise<PlusultraCoinExchangeQuote> {
      const destWallet = spendInfo.spendTargets[0].destWallet
      if (!destWallet) {
        throw new SameCurrencyError()
      }
      const currentCurrencyCode = spendInfo.currencyCode
        ? spendInfo.currencyCode
        : plugin.currencyInfo.currencyCode
      const destCurrencyCode = spendInfo.spendTargets[0].currencyCode
        ? spendInfo.spendTargets[0].currencyCode
        : destWallet.currencyInfo.currencyCode
      if (destCurrencyCode === currentCurrencyCode) {
        throw new SameCurrencyError()
      }
      const plusultraFreshAddress = engine.getFreshAddress()
      const plusultraReceiveAddress = await destWallet.getReceiveAddress()

      let destPublicAddress
      if (plusultraReceiveAddress.legacyAddress) {
        destPublicAddress = plusultraReceiveAddress.legacyAddress
      } else {
        destPublicAddress = plusultraReceiveAddress.publicAddress
      }

      let currentPublicAddress
      if (plusultraFreshAddress.legacyAddress) {
        currentPublicAddress = plusultraFreshAddress.legacyAddress
      } else {
        currentPublicAddress = plusultraFreshAddress.publicAddress
      }

      const nativeAmount = spendInfo.nativeAmount
      const quoteFor = spendInfo.quoteFor
      if (!quoteFor) {
        throw new Error('Need to define direction for quoteFor')
      }
      const destAmount = spendInfo.spendTargets[0].nativeAmount
      /* console.log('core: destAmount', destAmount) */
      // here we are going to get multipliers
      const currencyInfos = ai.props.state.currency.infos
      const tokenInfos = ai.props.state.currency.customTokens
      const multiplierFrom = getCurrencyMultiplier(
        currencyInfos,
        tokenInfos,
        currentCurrencyCode
      )
      const multiplierTo = getCurrencyMultiplier(
        currencyInfos,
        tokenInfos,
        destCurrencyCode
      )

      /* if (destAmount) {
        nativeAmount = destAmount
      } */
      if (!nativeAmount) {
        throw new Error('Need to define a native amount')
      }
      const nativeAmountForQuote = destAmount || nativeAmount

      const quoteData: ShapeShiftExactQuoteReply = await shapeshiftApi.getexactQuote(
        currentCurrencyCode,
        destCurrencyCode,
        currentPublicAddress,
        destPublicAddress,
        nativeAmountForQuote,
        quoteFor,
        multiplierFrom,
        multiplierTo
      )
      if (!quoteData.success) {
        throw new Error('Did not get back successful quote')
      }
      const exchangeData = quoteData.success
      const nativeAmountForSpend = destAmount
        ? mul(exchangeData.depositAmount, multiplierFrom)
        : nativeAmount

      const spendTarget: PlusultraSpendTarget = {
        nativeAmount: nativeAmountForSpend,
        publicAddress: exchangeData.deposit
      }

      const exchangeSpendInfo: PlusultraSpendInfo = {
        // networkFeeOption: spendInfo.networkFeeOption,
        currencyCode: spendInfo.currencyCode,
        spendTargets: [spendTarget]
      }
      const tx = await engine.makeSpend(exchangeSpendInfo)
      tx.otherParams = tx.otherParams || {}
      tx.otherParams.exchangeData = exchangeData
      const plusultraCoinExchangeQuote: PlusultraCoinExchangeQuote = {
        depositAmountNative: mul(exchangeData.depositAmount, multiplierFrom),
        withdrawalAmountNative: mul(
          exchangeData.withdrawalAmount,
          multiplierTo
        ),
        expiration: exchangeData.expiration,
        quotedRate: exchangeData.quotedRate,
        maxLimit: exchangeData.maxLimit,
        orderId: exchangeData.orderId,
        plusultraTransacton: tx
      }
      return plusultraCoinExchangeQuote
    },

    signTx (tx: PlusultraTransaction): Promise<PlusultraTransaction> {
      return engine.signTx(tx)
    },

    broadcastTx (tx: PlusultraTransaction): Promise<PlusultraTransaction> {
      return engine.broadcastTx(tx)
    },

    saveTx (tx: PlusultraTransaction) {
      return engine.saveTx(tx)
    },

    resyncBlockchain (): Promise<void> {
      ai.props.dispatch({
        type: 'CURRENCY_ENGINE_CLEARED',
        payload: { walletId: input.props.id }
      })
      return Promise.resolve(engine.resyncBlockchain())
    },

    '@dumpData': { sync: true },
    dumpData (): PlusultraDataDump {
      return engine.dumpData()
    },

    '@getDisplayPrivateSeed': { sync: true },
    getDisplayPrivateSeed (): string | null {
      return engine.getDisplayPrivateSeed()
    },

    '@getDisplayPublicSeed': { sync: true },
    getDisplayPublicSeed (): string | null {
      return engine.getDisplayPublicSeed()
    },

    saveTxMetadata (txid: string, currencyCode: string, metadata: PlusultraMetadata) {
      return setCurrencyWalletTxMetadata(
        input,
        txid,
        currencyCode,
        fixMetadata(metadata, input.props.selfState.fiat)
      )
    },

    getMaxSpendable (spendInfo: PlusultraSpendInfo): Promise<string> {
      const { currencyCode, networkFeeOption, customNetworkFee } = spendInfo
      const balance = engine.getBalance({ currencyCode })

      // Copy all the spend targets, setting the amounts to 0
      // but keeping all other information so we can get accurate fees:
      const spendTargets = spendInfo.spendTargets.map(spendTarget => {
        if (
          spendTarget.currencyCode &&
          spendTarget.currencyCode !== currencyCode
        ) {
          throw new Error('Cannot to a cross-currency max-spend')
        }
        return { ...spendTarget, nativeAmount: '0' }
      })

      // The range of possible values includes `min`, but not `max`.
      function getMax (min: string, max: string): Promise<string> {
        const diff = sub(max, min)
        if (lte(diff, '1')) {
          return Promise.resolve(min)
        }
        const mid = add(min, div(diff, '2'))

        // Try the average:
        spendTargets[0].nativeAmount = mid
        return engine
          .makeSpend({
            currencyCode,
            spendTargets,
            networkFeeOption,
            customNetworkFee
          })
          .then(good => getMax(mid, max))
          .catch(bad => getMax(min, mid))
      }

      return getMax('0', add(balance, '1'))
    },

    '@parseUri': { sync: true },
    parseUri (uri: string) {
      return plugin.parseUri(uri)
    },

    '@encodeUri': { sync: true },
    encodeUri (obj: PlusultraEncodeUri) {
      return plugin.encodeUri(obj)
    }
  }

  return wrapObject('CurrencyWallet', out)
}

function fixMetadata (metadata: PlusultraMetadata, fiat: any) {
  const out = filterObject(metadata, [
    'bizId',
    'category',
    'exchangeAmount',
    'name',
    'notes'
  ])

  if (metadata.amountFiat != null) {
    if (out.exchangeAmount == null) out.exchangeAmount = {}
    out.exchangeAmount[fiat] = metadata.amountFiat
  }

  return out
}

export function combineTxWithFile (
  input: CurrencyWalletInput,
  tx: any,
  file: any,
  currencyCode: string
) {
  const wallet = input.props.selfOutput.api
  const walletCurrency = input.props.selfState.currencyInfo.currencyCode
  const walletFiat = input.props.selfState.fiat

  // Copy the tx properties to the output:
  const out = {
    ...tx,
    amountSatoshi: Number(tx.nativeAmount[currencyCode]),
    nativeAmount: tx.nativeAmount[currencyCode],
    networkFee: tx.networkFee[currencyCode],
    currencyCode,
    wallet
  }

  // These are our fallback values:
  const fallback = {
    providerFeeSent: 0,
    metadata: {
      name: '',
      category: '',
      notes: '',
      bizId: 0,
      amountFiat: 0,
      exchangeAmount: {}
    }
  }

  const merged = file
    ? mergeDeeply(
      fallback,
      file.currencies[walletCurrency],
      file.currencies[currencyCode]
    )
    : fallback

  if (file && file.creationDate < out.date) out.date = file.creationDate
  out.providerFee = merged.providerFeeSent
  out.metadata = merged.metadata
  if (
    merged.metadata &&
    merged.metadata.exchangeAmount &&
    merged.metadata.exchangeAmount[walletFiat]
  ) {
    out.metadata.amountFiat = merged.metadata.exchangeAmount[walletFiat]
    if (out.metadata.amountFiat.toString().includes('e')) {
      // Corrupt amountFiat that exceeds a number that JS can cleanly represent without exponents. Set to 0
      out.metadata.amountFiat = 0
    }
  } else {
    console.info('Missing amountFiat in combineTxWithFile')
  }

  return out
}
