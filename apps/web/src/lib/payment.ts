import {
  keccak256,
  stringToHex,
  type Hex,
} from "viem";

export function createServiceId(service: string): Hex {
  return keccak256(stringToHex(service));
}

export function createNonce(): bigint {
  return BigInt(
    Date.now()
  );
}

export function getDeadline(minutes: number): bigint {
  return BigInt(
    Math.floor(Date.now() / 1000) +
      minutes * 60
  );
}

export function isValidAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}
