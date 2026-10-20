import { requireOptionalNativeModule } from 'expo-modules-core';

type Native = {
  readText(uri: string, maxBytes: number): Promise<string>;
  readBase64(uri: string, maxBytes: number): Promise<string>;
};

let cached: Native | null = null;
let probed = false;

/** Native-only: requireOptional returns null on web or when the module is not
 * linked (never throws at import time). */
function nativeModule(): Native | null {
  if (!probed) {
    probed = true;
    cached = requireOptionalNativeModule<Native>('TemariFileRead') ?? null;
  }
  return cached;
}

export const hasNativeReader = () => nativeModule() != null;

export async function readTextNative(uri: string, maxBytes: number) {
  const native = nativeModule();
  return native
    ? native.readText(uri, maxBytes)
    : Promise.reject(Object.assign(new Error('native module not linked'), { code: 'ERR_NO_NATIVE' }));
}

export async function readBase64Native(uri: string, maxBytes: number) {
  const native = nativeModule();
  return native
    ? native.readBase64(uri, maxBytes)
    : Promise.reject(Object.assign(new Error('native module not linked'), { code: 'ERR_NO_NATIVE' }));
}
