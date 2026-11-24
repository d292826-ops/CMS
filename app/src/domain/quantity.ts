import { failure, success } from './types.ts';
import type { Result } from './types.ts';

const LIMIT = 999999999999999n;
export function parseQuantity(input: string, scale = 3, positive = false): Result<string> {
  if (!Number.isInteger(scale) || scale < 0 || scale > 3) return failure('UNIT_SCALE', 'Для детали не задана корректная единица измерения');
  const raw = input.trim().replace(',', '.');
  if (!/^-?\d+(?:\.\d+)?$/.test(raw)) return failure('QUANTITY_FORMAT', 'Укажите число, например 2 или 1,5');
  const [whole, fraction = ''] = raw.split('.');
  if (fraction.length > scale) return failure('QUANTITY_SCALE', scale === 0 ? 'Укажите целое количество' : `Допустимо не больше ${scale} знаков после запятой`);
  const negative = whole.startsWith('-');
  const units = BigInt(whole.replace('-', '')) * 1000n + BigInt(fraction.padEnd(3, '0'));
  const signed = negative ? -units : units;
  if (units > LIMIT) return failure('QUANTITY_RANGE', 'Количество превышает допустимое значение');
  if (positive && signed <= 0n) return failure('QUANTITY_POSITIVE', 'Количество должно быть больше нуля');
  return success(fromThousandths(signed));
}
export function toThousandths(value: string): bigint {
  const [whole, fraction = ''] = value.split('.');
  const result = BigInt(whole.replace('-', '')) * 1000n + BigInt(fraction.padEnd(3, '0'));
  return whole.startsWith('-') ? -result : result;
}
export function fromThousandths(value: bigint): string {
  const sign = value < 0n ? '-' : ''; const abs = value < 0n ? -value : value;
  const fraction = (abs % 1000n).toString().padStart(3, '0').replace(/0+$/, '');
  return `${sign}${abs / 1000n}${fraction ? '.' + fraction : ''}`;
}
export function sumQuantities(values: string[]): string { return fromThousandths(values.reduce((sum, value) => sum + toThousandths(value), 0n)); }
