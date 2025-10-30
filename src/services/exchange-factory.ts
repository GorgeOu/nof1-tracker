import { ExchangeService, ExchangeName } from './exchange-service';
import { BinanceService } from './binance-service';
import { OkxService } from './okx-service';

export interface ExchangeFactoryOptions {
  exchange?: ExchangeName;
  apiKey?: string;
  apiSecret?: string;
  passphrase?: string;
  testnet?: boolean;
  simulated?: boolean;
  baseUrl?: string;
}

export function createExchangeService(options: ExchangeFactoryOptions = {}): ExchangeService {
  const exchange = (options.exchange || process.env.EXCHANGE || 'binance').toLowerCase() as ExchangeName;
  const isTestEnv = process.env.NODE_ENV === 'test';

  if (exchange === 'okx') {
    const apiKey = options.apiKey || process.env.OKX_API_KEY || '';
    const apiSecret = options.apiSecret || process.env.OKX_API_SECRET || '';
    const passphrase = options.passphrase || process.env.OKX_API_PASSPHRASE || '';
    const simulated = options.simulated ?? process.env.OKX_SIMULATED === 'true';

    const baseUrl = options.baseUrl || process.env.OKX_API_URL || 'https://www.okx.com';

    if (!apiKey || !apiSecret || !passphrase) {
      if (isTestEnv) {
        return new OkxService(apiKey, apiSecret, passphrase, simulated, baseUrl);

      }
      throw new Error('OKX_API_KEY, OKX_API_SECRET, and OKX_API_PASSPHRASE environment variables are required for OKX');
    }

    return new OkxService(apiKey, apiSecret, passphrase, simulated, baseUrl);

  }

  const apiKey = options.apiKey || process.env.BINANCE_API_KEY || '';
  const apiSecret = options.apiSecret || process.env.BINANCE_API_SECRET || '';
  const testnet = options.testnet ?? process.env.BINANCE_TESTNET === 'true';

  if (!apiKey || !apiSecret) {
    if (isTestEnv) {
      return new BinanceService(apiKey, apiSecret, testnet);
    }
    throw new Error('BINANCE_API_KEY and BINANCE_API_SECRET environment variables are required for Binance');
  }

  return new BinanceService(apiKey, apiSecret, testnet);
}
