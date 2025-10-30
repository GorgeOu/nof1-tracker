import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import {
  ExchangeOrder,
  StopLossOrder,
  TakeProfitOrder,
  OrderResponse,
  PositionResponse,
  UserTrade,
  ExchangeService
} from './exchange-service';
import { TradingPlan } from '../types/trading';

interface OkxResponse<T> {
  code: string;
  msg: string;
  data: T[];
}

interface OkxOrderResponseItem {
  ordId: string;
  clOrdId?: string;
  sCode?: string;
  sMsg?: string;
}

interface OkxPosition {
  instId: string;
  posSide: 'long' | 'short';
  pos: string;
  avgPx: string;
  upl: string;
  liqPx?: string;
  lever: string;
  marginMode: string;
  margin?: string;
  notionalUsd?: string;
  markPx?: string;
  mgnMode?: string;
  mgnRatio?: string;
  instType?: string;
  uTime?: string;
  cTime?: string;
}

interface OkxTicker {
  instId: string;
  last: string;
}

interface OkxAccountDetail {
  ccy: string;
  availBal: string;
  eq: string;
  cashBal?: string;
  ordFrozen?: string;
  imr?: string;
  mmr?: string;
}

interface OkxAccountData {
  totalEq?: string;
  details?: OkxAccountDetail[];
}

export class OkxService implements ExchangeService {
  private apiKey: string;
  private apiSecret: string;
  private passphrase: string;
  private baseUrl: string;
  private client: AxiosInstance;
  private simulatedTrading: boolean;

  constructor(
    apiKey: string,
    apiSecret: string,
    passphrase: string,
    simulatedTrading: boolean = false,
    baseUrl: string = 'https://www.okx.com'
  ) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.passphrase = passphrase;
    this.simulatedTrading = simulatedTrading;
    this.baseUrl = baseUrl;

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        ...(this.simulatedTrading ? { 'x-simulated-trading': '1' } : {})
      }
    });
  }

  async syncServerTime(): Promise<void> {
    // OKX API provides server time directly in getServerTime
    await this.getServerTime().catch(() => undefined);
  }

  destroy(): void {
    // No persistent resources to clean for OKX
  }

  convertSymbol(symbol: string): string {
    if (symbol.includes('-')) {
      return symbol.toUpperCase();
    }
    const normalized = symbol.endsWith('USDT') ? symbol.slice(0, -4) : symbol;
    return `${normalized.toUpperCase()}-USDT-SWAP`;
  }

  private convertFromOkxSymbol(instId: string): string {
    const [base, quote] = instId.split('-');
    if (!quote) {
      return instId;
    }
    return `${base}${quote}`;
  }

  formatQuantity(quantity: number | string, symbol: string): string {
    const baseSymbol = this.convertSymbol(symbol);
    const precisionMap: Record<string, number> = {
      'BTC-USDT-SWAP': 3,
      'ETH-USDT-SWAP': 3,
      'BNB-USDT-SWAP': 2,
      'XRP-USDT-SWAP': 1,
      'ADA-USDT-SWAP': 0,
      'DOGE-USDT-SWAP': 0,
      'SOL-USDT-SWAP': 2,
      'AVAX-USDT-SWAP': 2,
      'MATIC-USDT-SWAP': 1,
      'DOT-USDT-SWAP': 2,
      'LINK-USDT-SWAP': 2,
      'UNI-USDT-SWAP': 2
    };

    const precision = precisionMap[baseSymbol] ?? 3;
    const qtyNum = typeof quantity === 'string' ? parseFloat(quantity) : quantity;
    const minQtyMap: Record<string, number> = {
      'BTC-USDT-SWAP': 0.001,
      'ETH-USDT-SWAP': 0.001,
      'BNB-USDT-SWAP': 0.01,
      'XRP-USDT-SWAP': 0.1,
      'ADA-USDT-SWAP': 1,
      'DOGE-USDT-SWAP': 1,
      'SOL-USDT-SWAP': 0.01,
      'AVAX-USDT-SWAP': 0.01,
      'MATIC-USDT-SWAP': 0.1,
      'DOT-USDT-SWAP': 0.01,
      'LINK-USDT-SWAP': 0.01,
      'UNI-USDT-SWAP': 0.01
    };
    const minQty = minQtyMap[baseSymbol] ?? 0.001;

    const adjustedQty = qtyNum < minQty && qtyNum > 0 ? minQty : qtyNum;
    return adjustedQty.toFixed(precision);
  }

  formatPrice(price: number | string, symbol: string): string {
    const baseSymbol = this.convertSymbol(symbol);
    const precisionMap: Record<string, number> = {
      'BTC-USDT-SWAP': 1,
      'ETH-USDT-SWAP': 2,
      'BNB-USDT-SWAP': 2,
      'XRP-USDT-SWAP': 4,
      'ADA-USDT-SWAP': 4,
      'DOGE-USDT-SWAP': 5,
      'SOL-USDT-SWAP': 2,
      'AVAX-USDT-SWAP': 2,
      'MATIC-USDT-SWAP': 3,
      'DOT-USDT-SWAP': 2,
      'LINK-USDT-SWAP': 2,
      'UNI-USDT-SWAP': 2
    };

    const precision = precisionMap[baseSymbol] ?? 2;
    const priceNum = typeof price === 'string' ? parseFloat(price) : price;
    return priceNum.toFixed(precision);
  }

  private createSignature(timestamp: string, method: string, requestPath: string, body: string): string {
    const prehash = `${timestamp}${method}${requestPath}${body}`;
    return crypto.createHmac('sha256', this.apiSecret).update(prehash).digest('base64');
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    params: Record<string, any> = {},
    signed: boolean = false
  ): Promise<OkxResponse<T>> {
    const timestamp = new Date().toISOString();
    let requestPath = path;
    let body = '';

    if (method === 'GET') {
      const query = Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&');
      if (query) {
        requestPath = `${path}?${query}`;
      }
    } else {
      body = JSON.stringify(params);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (signed) {
      headers['OK-ACCESS-KEY'] = this.apiKey;
      headers['OK-ACCESS-PASSPHRASE'] = this.passphrase;
      headers['OK-ACCESS-TIMESTAMP'] = timestamp;
      headers['OK-ACCESS-SIGN'] = this.createSignature(timestamp, method, requestPath, body);
      if (this.simulatedTrading) {
        headers['x-simulated-trading'] = '1';
      }
    }

    const url = method === 'GET' ? requestPath : path;
    try {
      const response = await this.client.request<OkxResponse<T>>({
        method,
        url,
        data: method === 'GET' ? undefined : params,
        headers
      });

      const responseData = response.data;
      if (responseData.code !== '0') {
        throw new Error(`OKX API Error: ${responseData.msg || responseData.code}`);
      }
      return responseData;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const networkCodes = new Set(['ENOTFOUND', 'EAI_AGAIN']);
        const isDnsError =
          networkCodes.has(error.code || '') ||
          (typeof error.message === 'string' && error.message.includes('getaddrinfo'));

        if (isDnsError) {
          throw new Error(
            `Unable to resolve OKX host at ${this.baseUrl}. ` +
              'If you are in a region where www.okx.com is blocked, set OKX_API_URL to an alternate domain such as https://aws.okx.com. ' +
              `Original error: ${error.message}`
          );
        }
      }

      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Unknown error communicating with OKX API');
    }
  }

  async getServerTime(): Promise<number> {
    const response = await this.request<{ ts: string }>('GET', '/api/v5/public/time');
    const timestamp = response.data[0]?.ts;
    return timestamp ? parseInt(timestamp, 10) : Date.now();
  }

  async getAccountInfo(): Promise<any> {
    const response = await this.request<OkxAccountData>('GET', '/api/v5/account/balance', { ccy: 'USDT' }, true);
    const account = response.data[0];
    const detail = account?.details?.find(item => item.ccy === 'USDT') || account?.details?.[0];

    return {
      availableBalance: detail?.availBal || '0',
      totalWalletBalance: detail?.eq || account?.totalEq || '0',
      totalCrossWalletBalance: detail?.cashBal || '0',
      totalPositionInitialMargin: detail?.imr || '0',
      totalOpenOrderInitialMargin: detail?.ordFrozen || '0',
      totalInitialMargin: detail?.imr || '0',
      totalMaintMargin: detail?.mmr || '0'
    };
  }

  private transformPosition(position: OkxPosition): PositionResponse {
    const quantity = parseFloat(position.pos);
    const signedQty = position.posSide === 'short' ? -quantity : quantity;
    const symbol = this.convertFromOkxSymbol(position.instId);
    return {
      symbol,
      positionAmt: signedQty.toString(),
      entryPrice: position.avgPx || '0',
      markPrice: position.markPx || position.avgPx || '0',
      unRealizedProfit: position.upl || '0',
      liquidationPrice: position.liqPx || '0',
      leverage: position.lever || '1',
      maxNotionalValue: position.notionalUsd || '0',
      marginType: (position.marginMode || position.mgnMode || 'isolated').toUpperCase(),
      isolatedMargin: position.margin || '0',
      isAutoAddMargin: 'false',
      positionSide: position.posSide.toUpperCase(),
      notional: position.notionalUsd || '0',
      isolatedWallet: position.margin || '0',
      updateTime: position.uTime ? parseInt(position.uTime, 10) : Date.now()
    };
  }

  async getPositions(): Promise<PositionResponse[]> {
    const response = await this.request<OkxPosition>('GET', '/api/v5/account/positions', { instType: 'SWAP' }, true);
    return response.data
      .filter(position => parseFloat(position.pos) !== 0)
      .map(position => this.transformPosition(position));
  }

  async getAllPositions(): Promise<PositionResponse[]> {
    const response = await this.request<OkxPosition>('GET', '/api/v5/account/positions', { instType: 'SWAP' }, true);
    return response.data.map(position => this.transformPosition(position));
  }

  private buildOrderResponse(order: ExchangeOrder, responseItem: OkxOrderResponseItem): OrderResponse {
    return {
      orderId: responseItem.ordId,
      symbol: this.convertSymbol(order.symbol),
      status: responseItem.sCode === '0' ? 'NEW' : 'REJECTED',
      clientOrderId: responseItem.clOrdId,
      price: order.price || '0',
      origQty: order.quantity,
      executedQty: '0',
      type: order.type,
      side: order.side,
      time: Date.now()
    };
  }

  private async placeAlgoOrder(order: ExchangeOrder): Promise<OrderResponse> {
    const instId = this.convertSymbol(order.symbol);
    const side = order.side === 'BUY' ? 'buy' : 'sell';
    const posSide = order.side === 'BUY' ? 'short' : 'long';
    const triggerPx = order.stopPrice || order.price;

    const body = {
      instId,
      tdMode: 'isolated',
      side,
      posSide,
      ordType: 'trigger',
      triggerPx: triggerPx ? this.formatPrice(triggerPx, order.symbol) : undefined,
      orderPx: '-1',
      sz: this.formatQuantity(order.quantity, order.symbol),
      reduceOnly: true
    };

    const response = await this.request<OkxOrderResponseItem>('POST', '/api/v5/trade/order-algo', body, true);
    const item = response.data[0];
    return this.buildOrderResponse(order, item);
  }

  async placeOrder(order: ExchangeOrder): Promise<OrderResponse> {
    if (
      order.type === 'TAKE_PROFIT_MARKET' ||
      order.type === 'TAKE_PROFIT' ||
      order.type === 'STOP' ||
      order.type === 'STOP_MARKET'
    ) {
      return this.placeAlgoOrder(order);
    }

    const instId = this.convertSymbol(order.symbol);
    const side = order.side === 'BUY' ? 'buy' : 'sell';
    const posSide = order.side === 'BUY' ? 'long' : 'short';

    const body: Record<string, any> = {
      instId,
      tdMode: 'isolated',
      side,
      ordType: order.type === 'MARKET' ? 'market' : 'limit',
      sz: this.formatQuantity(order.quantity, order.symbol),
      posSide,
      reduceOnly: order.closePosition === 'true'
    };

    if (order.type === 'LIMIT' && order.price) {
      body.px = this.formatPrice(order.price, order.symbol);
    }

    const response = await this.request<OkxOrderResponseItem>('POST', '/api/v5/trade/order', body, true);
    const item = response.data[0];
    return this.buildOrderResponse(order, item);
  }

  async setLeverage(symbol: string, leverage: number): Promise<any> {
    const body = {
      instId: this.convertSymbol(symbol),
      lever: leverage.toString(),
      mgnMode: 'isolated'
    };
    return await this.request('POST', '/api/v5/account/set-leverage', body, true);
  }

  async setMarginType(symbol: string, marginType: 'ISOLATED' | 'CROSSED'): Promise<any> {
    const mode = marginType === 'CROSSED' ? 'cross' : 'isolated';
    const body = {
      instId: this.convertSymbol(symbol),
      mgnMode: mode
    };
    return await this.request('POST', '/api/v5/account/set-leverage', body, true);
  }

  async cancelOrder(symbol: string, orderId: number): Promise<OrderResponse> {
    const response = await this.request<OkxOrderResponseItem>(
      'POST',
      '/api/v5/trade/cancel-order',
      {
        instId: this.convertSymbol(symbol),
        ordId: orderId.toString()
      },
      true
    );
    const item = response.data[0];
    return {
      orderId: item.ordId,
      symbol: this.convertSymbol(symbol),
      status: item.sCode === '0' ? 'CANCELED' : 'REJECTED',
      price: '0',
      origQty: '0',
      executedQty: '0',
      type: 'MARKET',
      side: 'SELL',
      time: Date.now()
    };
  }

  async cancelAllOrders(symbol: string): Promise<any> {
    const openOrders = await this.getOpenOrders(symbol);
    for (const order of openOrders) {
      await this.cancelOrder(symbol, Number(order.orderId));
    }
    return { success: true };
  }

  async getOrderStatus(symbol: string, orderId: number): Promise<OrderResponse> {
    const response = await this.request<any>(
      'GET',
      '/api/v5/trade/order',
      {
        instId: this.convertSymbol(symbol),
        ordId: orderId.toString()
      },
      true
    );
    const data = response.data[0];
    if (!data) {
      throw new Error('Order not found');
    }
    return {
      orderId: data.ordId,
      symbol: this.convertSymbol(symbol),
      status: data.state || 'NEW',
      price: data.px || '0',
      origQty: data.sz || '0',
      executedQty: data.accFillSz || '0',
      avgPrice: data.avgPx,
      type: data.ordType || 'market',
      side: data.side?.toUpperCase() || 'BUY',
      time: data.cTime ? parseInt(data.cTime, 10) : Date.now()
    };
  }

  async getOpenOrders(symbol?: string): Promise<OrderResponse[]> {
    const response = await this.request<any>(
      'GET',
      '/api/v5/trade/orders-pending',
      {
        instType: 'SWAP',
        instId: symbol ? this.convertSymbol(symbol) : undefined
      },
      true
    );

    return response.data.map(item => ({
      orderId: item.ordId,
      symbol: item.instId,
      status: item.state,
      price: item.px || '0',
      origQty: item.sz || '0',
      executedQty: item.accFillSz || '0',
      type: item.ordType,
      side: item.side?.toUpperCase() || 'BUY',
      time: item.cTime ? parseInt(item.cTime, 10) : Date.now()
    }));
  }

  async get24hrTicker(symbol?: string): Promise<any> {
    const response = await this.request<OkxTicker>(
      'GET',
      '/api/v5/market/ticker',
      {
        instId: symbol ? this.convertSymbol(symbol) : undefined
      }
    );
    const ticker = response.data[0];
    return {
      symbol: ticker?.instId || (symbol ? this.convertSymbol(symbol) : ''),
      lastPrice: ticker?.last || '0'
    };
  }

  async getUserTrades(
    symbol?: string,
    startTime?: number,
    endTime?: number,
    fromId?: number,
    limit: number = 100
  ): Promise<UserTrade[]> {
    const response = await this.request<any>(
      'GET',
      '/api/v5/trade/fills-history',
      {
        instType: 'SWAP',
        instId: symbol ? this.convertSymbol(symbol) : undefined,
        begin: startTime,
        end: endTime,
        limit
      },
      true
    );

    return response.data.map((fill: any) => ({
      symbol: this.convertFromOkxSymbol(fill.instId),
      id: Number(fill.tradeId),
      orderId: Number(fill.ordId),
      side: fill.side?.toUpperCase() === 'BUY' ? 'BUY' : 'SELL',
      qty: fill.sz,
      price: fill.px,
      quoteQty: fill.fillNotionalUsd || fill.fillPx || '0',
      commission: fill.fee || '0',
      commissionAsset: fill.feeCcy || 'USDT',
      realizedPnl: fill.pnl || '0',
      time: fill.ts ? parseInt(fill.ts, 10) : Date.now(),
      positionSide: fill.posSide?.toUpperCase() || 'BOTH',
      buyer: fill.side?.toUpperCase() === 'BUY',
      maker: fill.execType === 'M'
    }));
  }

  async getAllUserTradesInRange(startTime: number, endTime: number, symbol?: string): Promise<UserTrade[]> {
    const trades = await this.getUserTrades(symbol, startTime, endTime, undefined, 100);
    return trades.filter(trade => trade.time >= startTime && trade.time <= endTime);
  }

  convertToExchangeOrder(tradingPlan: TradingPlan): ExchangeOrder {
    return {
      symbol: tradingPlan.symbol,
      side: tradingPlan.side,
      type: tradingPlan.type,
      quantity: this.formatQuantity(tradingPlan.quantity, tradingPlan.symbol),
      leverage: tradingPlan.leverage
    };
  }

  createTakeProfitOrder(
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity: number,
    takeProfitPrice: number
  ): TakeProfitOrder {
    return {
      symbol,
      side,
      type: 'TAKE_PROFIT_MARKET',
      quantity: this.formatQuantity(quantity, symbol),
      stopPrice: this.formatPrice(takeProfitPrice, symbol),
      closePosition: 'true'
    };
  }

  createStopLossOrder(
    symbol: string,
    side: 'BUY' | 'SELL',
    quantity: number,
    stopLossPrice: number
  ): StopLossOrder {
    return {
      symbol,
      side,
      type: 'STOP_MARKET',
      quantity: this.formatQuantity(quantity, symbol),
      stopPrice: this.formatPrice(stopLossPrice, symbol),
      closePosition: 'true'
    };
  }

  private calculateStopOrderSide(positionSide: 'BUY' | 'SELL'): 'BUY' | 'SELL' {
    return positionSide === 'BUY' ? 'SELL' : 'BUY';
  }

  createStopOrdersFromPosition(position: any, positionSide: 'BUY' | 'SELL') {
    const orders = {
      takeProfitOrder: null as TakeProfitOrder | null,
      stopLossOrder: null as StopLossOrder | null
    };

    if (!position || !position.exit_plan) {
      return orders;
    }

    const orderSide = this.calculateStopOrderSide(positionSide);

    if (position.exit_plan.profit_target > 0) {
      orders.takeProfitOrder = this.createTakeProfitOrder(
        position.symbol,
        orderSide,
        Math.abs(position.quantity),
        position.exit_plan.profit_target
      );
    }

    if (position.exit_plan.stop_loss > 0) {
      orders.stopLossOrder = this.createStopLossOrder(
        position.symbol,
        orderSide,
        Math.abs(position.quantity),
        position.exit_plan.stop_loss
      );
    }

    return orders;
  }
}
