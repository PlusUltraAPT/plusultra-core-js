// @flow

import aesjs from 'aes-js'

import type { PlusultraIo } from '../../plusultra-core-index.js'
import { base16, base64 } from '../encoding.js'
import { hashjs } from './external.js'

const AesCbc = aesjs.ModeOfOperation.cbc

export interface JsonBox {
  encryptionType: number;
  data_base64: string;
  iv_hex: string;
}

/**
 * @param box an Airbitz JSON encryption box
 * @param key a key, as an ArrayBuffer
 */
export function decrypt (box: JsonBox, key: Uint8Array): Uint8Array {
  // Check JSON:
  if (box.encryptionType !== 0) {
    throw new Error('Unknown encryption type')
  }
  const iv = base16.parse(box.iv_hex)
  const ciphertext = base64.parse(box.data_base64)

  // Decrypt:
  const cipher = new AesCbc(key, iv)
  const raw = cipher.decrypt(ciphertext)
  // Alternative using node.js crypto:
  // const decipher = crypto.createDecipheriv('AES-256-CBC', key, iv);
  // let x = decipher.update(box.data_base64, 'base64', 'hex')
  // x += decipher.final('hex')
  // const data = base16.parse(x)

  // Calculate field locations:
  const headerSize = raw[0]
  const dataSize =
    (raw[1 + headerSize] << 24) |
    (raw[2 + headerSize] << 16) |
    (raw[3 + headerSize] << 8) |
    raw[4 + headerSize]
  const dataStart = 1 + headerSize + 4
  const footerSize = raw[dataStart + dataSize]
  const hashStart = dataStart + dataSize + 1 + footerSize

  // Verify SHA-256 checksum:
  const hash = hashjs
    .sha256()
    .update(raw.subarray(0, hashStart))
    .digest()
  const hashSize = hash.length
  for (let i = 0; i < hashSize; ++i) {
    if (raw[hashStart + i] !== hash[i]) {
      throw new Error('Invalid checksum')
    }
  }

  // Verify pkcs7 padding:
  const paddingStart = hashStart + hashSize
  const paddingSize = raw.length - paddingStart
  if (paddingSize <= 0) {
    throw new Error('Missing PKCS7 padding')
  }
  for (let i = paddingStart; i < raw.length; ++i) {
    if (raw[i] !== paddingSize) {
      throw new Error('Invalid PKCS7 padding')
    }
  }

  // Return the payload:
  return raw.subarray(dataStart, dataStart + dataSize)
}

/**
 * @param payload an ArrayBuffer of data
 * @param key a key, as an ArrayBuffer
 */
export function encrypt (
  io: PlusultraIo,
  data: Uint8Array,
  key: Uint8Array
): JsonBox {
  // Calculate sizes and locations:
  const headerSize = io.random(1)[0] & 0x1f
  const dataStart = 1 + headerSize + 4
  const dataSize = data.length
  const footerStart = dataStart + dataSize + 1
  const footerSize = io.random(1)[0] & 0x1f
  const hashStart = footerStart + footerSize
  const hashSize = 32
  const paddingStart = hashStart + hashSize
  const paddingSize = 16 - (paddingStart & 0xf)
  const raw = new Uint8Array(paddingStart + paddingSize)

  // Random header:
  const header = io.random(headerSize)
  raw[0] = headerSize
  for (let i = 0; i < headerSize; ++i) {
    raw[1 + i] = header[i]
  }

  // Payload data:
  raw[1 + headerSize] = (dataSize >> 24) & 0xff
  raw[2 + headerSize] = (dataSize >> 16) & 0xff
  raw[3 + headerSize] = (dataSize >> 8) & 0xff
  raw[4 + headerSize] = dataSize & 0xff
  for (let i = 0; i < dataSize; ++i) {
    raw[dataStart + i] = data[i]
  }

  // Random footer:
  const footer = io.random(footerSize)
  raw[dataStart + dataSize] = footerSize
  for (let i = 0; i < footerSize; ++i) {
    raw[footerStart + i] = footer[i]
  }

  // SHA-256 checksum:
  const hash = hashjs
    .sha256()
    .update(raw.subarray(0, hashStart))
    .digest()
  for (let i = 0; i < hashSize; ++i) {
    raw[hashStart + i] = hash[i]
  }

  // Add PKCS7 padding:
  for (let i = 0; i < paddingSize; ++i) {
    raw[paddingStart + i] = paddingSize
  }

  // Encrypt to JSON:
  const iv = io.random(16)
  const cipher = new AesCbc(key, iv)
  const ciphertext = cipher.encrypt(raw)
  return {
    encryptionType: 0,
    iv_hex: base16.stringify(iv),
    data_base64: base64.stringify(ciphertext)
  }
}

export function hmacSha256 (data: Uint8Array, key: Uint8Array): Uint8Array {
  const hmac = hashjs.hmac(hashjs.sha256, key)
  return hmac.update(data).digest()
}

export function sha256 (data: Uint8Array): Uint8Array {
  return hashjs
    .sha256()
    .update(data)
    .digest()
}
