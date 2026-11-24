import { failure, success } from './types.ts';
import type { Money, Result } from './types.ts';
import { parseQuantity, toThousandths } from './quantity.ts';

export function isMoney(value: unknown, signed = false): value is Money {
  return value === null || (typeof value === 'number' && Number.isSafeInteger(value) && (signed || value >= 0));
}
export function multiplyMoneyHalfUp(price: Money, quantity: string): Result<Money> {
  if (!isMoney(price)) return failure('MONEY_INVALID', 'Ошибка данных: недопустимая цена');
  const parsed = parseQuantity(quantity, 3, true); if (!parsed.ok) return parsed;
  if (price === null) return success(null);
  const rounded = (BigInt(price) * toThousandths(parsed.value) + 500n) / 1000n;
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) return failure('MONEY_RANGE', 'Сумма превышает допустимое значение');
  return success(Number(rounded));
}
export function sumMoney(values: number[]): Result<number> {
  if (!values.every(value => isMoney(value, true))) return failure('MONEY_INVALID', 'Ошибка данных: недопустимая сумма');
  const total = values.reduce((sum, value) => sum + BigInt(value), 0n);
  if (total > BigInt(Number.MAX_SAFE_INTEGER) || total < BigInt(Number.MIN_SAFE_INTEGER)) return failure('MONEY_RANGE', 'Сумма превышает допустимое значение');
  return success(Number(total));
}
