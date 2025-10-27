import { TradingPlan } from "../types/trading";

export type ExchangeName = "binance" | "okx";

export interface ExchangeOrder {
  symbol: string;
  side: "BUY" | "SELL";
  type:
    | "MARKET"
    | "LIMIT"
    | "STOP"
    | "TAKE_PROFIT"
    | "TAKE_PROFIT_MARKET"
    | "STOP_MARKET";
  quantity: string;
  leverage: number;
  price?: string;
  stopPrice?: string;
  timeInForce?: "GTC" | "IOC" | "FOK";
  closePosition?: string;
}

export interface StopLossOrder {
  symbol: string;
  side: "BUY" | "SELL";
  type: "STOP_MARKET" | "STOP";
  quantity: string;
  stopPrice: string;
  closePosition?: string;
}

export interface TakeProfitOrder {
  symbol: string;
  side: "BUY" | "SELL";
  type: "TAKE_PROFIT_MARKET" | "TAKE_PROFIT";
  quantity: string;
  stopPrice: string;
  closePosition?: string;
}

export interface OrderResponse {
  orderId: number | string;
  symbol: string;
  status: string;
  clientOrderId?: string;
  price: string;
  avgPrice?: string;
  origQty: string;
  executedQty: string;
  cumQty?: string;
  cumQuote?: string;
  timeInForce?: string;
  type: string;
  reduceOnly?: boolean;
  closePosition?: boolean | string;
  side: string;
  positionSide?: string;
  stopPrice?: string;
  workingType?: string;
  priceProtect?: boolean;
  origType?: string;
  time: number;
  updateTime?: number;
}

export interface PositionResponse {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unRealizedProfit: string;
  liquidationPrice: string;
  leverage: string;
  maxNotionalValue: string;
  marginType: string;
  isolatedMargin: string;
  isAutoAddMargin: string;
  positionSide: string;
  notional: string;
  isolatedWallet: string;
  updateTime: number;
}

export interface UserTrade {
  symbol: string;
  id: number;
  orderId: number;
  side: "BUY" | "SELL";
  qty: string;
  price: string;
  quoteQty: string;
  commission: string;
  commissionAsset: string;
  realizedPnl: string;
  time: number;
  positionSide: string;
  buyer: boolean;
  maker: boolean;
}

export interface ExchangeService {
  convertSymbol(symbol: string): string;
  formatQuantity(quantity: number | string, symbol: string): string;
  formatPrice(price: number | string, symbol: string): string;
  syncServerTime(): Promise<void>;
  destroy(): void;
  getServerTime(): Promise<number>;
  getAccountInfo(): Promise<any>;
  getPositions(): Promise<PositionResponse[]>;
  getAllPositions(): Promise<PositionResponse[]>;
  placeOrder(order: ExchangeOrder): Promise<OrderResponse>;
  setLeverage(symbol: string, leverage: number): Promise<any>;
  setMarginType(symbol: string, marginType: "ISOLATED" | "CROSSED"): Promise<any>;
  cancelOrder(symbol: string, orderId: number): Promise<OrderResponse>;
  cancelAllOrders(symbol: string): Promise<any>;
  getOrderStatus(symbol: string, orderId: number): Promise<OrderResponse>;
  getOpenOrders(symbol?: string): Promise<OrderResponse[]>;
  get24hrTicker(symbol?: string): Promise<any>;
  getUserTrades(
    symbol?: string,
    startTime?: number,
    endTime?: number,
    fromId?: number,
    limit?: number
  ): Promise<UserTrade[]>;
  getAllUserTradesInRange(startTime: number, endTime: number, symbol?: string): Promise<UserTrade[]>;
  convertToExchangeOrder(tradingPlan: TradingPlan): ExchangeOrder;
  createTakeProfitOrder(
    symbol: string,
    side: "BUY" | "SELL",
    quantity: number,
    takeProfitPrice: number
  ): TakeProfitOrder;
  createStopLossOrder(
    symbol: string,
    side: "BUY" | "SELL",
    quantity: number,
    stopLossPrice: number
  ): StopLossOrder;
  createStopOrdersFromPosition(
    position: any,
    positionSide: "BUY" | "SELL"
  ): { takeProfitOrder: TakeProfitOrder | null; stopLossOrder: StopLossOrder | null };
}
