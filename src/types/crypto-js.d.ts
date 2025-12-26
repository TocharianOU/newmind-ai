// Type declarations for crypto-js
declare module 'crypto-js' {
  export namespace AES {
    function encrypt(message: string, key: string): CipherParams
    function decrypt(ciphertext: CipherParams | string, key: string): DecryptedMessage
  }

  export namespace enc {
    const Utf8: {
      parse(str: string): WordArray
      stringify(wordArray: WordArray): string
    }
  }

  export interface CipherParams {
    toString(): string
  }

  export interface WordArray {
    toString(): string
  }

  export interface DecryptedMessage {
    toString(encoder: typeof enc.Utf8): string
  }
}


