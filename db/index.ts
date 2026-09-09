import { env } from 'cloudflare:workers';
export function db() { if (!env.DB)
    throw new Error('База данных временно недоступна. Попробуйте позже.'); return env.DB; }
export async function all<T = Record<string, any>>(sql: string, ...args: any[]): Promise<T[]> { return (await db().prepare(sql).bind(...args).all<T>()).results; }
export async function one<T = Record<string, any>>(sql: string, ...args: any[]): Promise<T | null> { return db().prepare(sql).bind(...args).first<T>(); }
export function stmt(sql: string, ...args: any[]) { return db().prepare(sql).bind(...args); }
