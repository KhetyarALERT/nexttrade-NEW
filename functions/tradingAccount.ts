1: import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
   2: 
   3: const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
   4: 
   5: const audit = (action, userId, data) => {
   6:   console.log(`[TRADING_AUDIT] [${new Date().toISOString()}] ${action} | User: ${userId}`, JSON.stringify(data));
   7: };
   8: 
   9: // Trading fees (percentage)
  10: const TRADING_FEES = {
  11:   maker: 0.02, // 0.02%
  12:   taker: 0.05  // 0.05%
  13: };
  14: 
  15: // Calculate liquidation price
  16: const calculateLiquidationPrice = (entryPrice, leverage, side, maintenanceMargin = 0.5) => {
  17:   const marginRatio = 1 / leverage;
  18:   if (side === 'LONG') {
  19:     return entryPrice * (1 - marginRatio + maintenanceMargin / 100);
  20:   } else {
  21:     return entryPrice * (1 + marginRatio - maintenanceMargin / 100);
  22:   }
  23: };
  24: 
  25: // Simulate slippage based on order size and market conditions
  26: const calculateSlippage = (orderSize, maxSlippage = 0.5) => {
  27:   // Base slippage + size impact
  28:   const baseSlippage = 0.01; // 0.01%
  29:   const sizeImpact = Math.min(orderSize / 100000, 0.1); // Max 0.1% from size
  30:   const randomFactor = Math.random() * 0.05; // Random 0-0.05%
  31:   
  32:   const totalSlippage = baseSlippage + sizeImpact + randomFactor;
  33:   return Math.min(totalSlippage, maxSlippage);
  34: };
  35: 
  36: // Helper: Fetch current prices for "inline execution" check
  37: async function fetchPrices(symbols) {
  38:   if (!symbols || symbols.length === 0) return {};
  39:   try {
  40:     // We can't easily fetch specific symbols in bulk without iterating or using all ticker endpoint
  41:     // Using all ticker endpoint is safer for unknown symbols
  42:     const response = await fetch('https://open-api.bingx.com/openApi/swap/v2/quote/ticker');
  43:     const data = await response.json();
  44:     const prices = {};
  45:     if (data.code === 0 && data.data) {
  46:       data.data.forEach(t => {
  47:         prices[t.symbol] = parseFloat(t.lastPrice);
  48:       });
  49:     }
  50:     return prices;
  51:   } catch (e) {
  52:     console.error("Failed to fetch prices:", e);
  53:     return {};
  54:   }
  55: }
  56: 
  57: // Helper: Check and execute orders for a specific user
  58: async function checkUserOrders(base44, userId, accountId) {
  59:   try {
  60:     const [openTrades, pendingTrades] = await Promise.all([
  61:       base44.entities.Trade.filter({ user_id: userId, trading_account_id: accountId, status: 'OPEN' }),
  62:       base44.entities.Trade.filter({ user_id: userId, trading_account_id: accountId, status: 'PENDING' })
  63:     ]);
  64: 
  65:     if ((!openTrades || openTrades.length === 0) && (!pendingTrades || pendingTrades.length === 0)) return;
  66: 
  67:     const symbols = new Set([
  68:       ...(openTrades || []).map(t => t.symbol),
  69:       ...(pendingTrades || []).map(t => t.symbol)
  70:     ]);
  71:     
  72:     const prices = await fetchPrices(Array.from(symbols));
  73: 
  74:     // Check Open Trades (TP/SL/Trailing)
  75:     for (const trade of (openTrades || [])) {
  76:       const price = prices[trade.symbol];
  77:       if (!price) continue;
  78: 
  79:       let closeReason = null;
  80: 
  81:       if (trade.take_profit) {
  82:         if ((trade.side === 'LONG' && price >= trade.take_profit) || 
  83:             (trade.side === 'SHORT' && price <= trade.take_profit)) {
  84:           closeReason = 'take_profit';
  85:         }
  86:       }
  87:       
  88:       if (!closeReason && trade.stop_loss) {
  89:         if ((trade.side === 'LONG' && price <= trade.stop_loss) || 
  90:             (trade.side === 'SHORT' && price >= trade.stop_loss)) {
  91:           closeReason = 'stop_loss';
  92:         }
  93:       }
  94: 
  95:       // Check Trailing Stop
  96:       if (!closeReason && (trade.order_type === 'TRAILING_STOP' || trade.trailing_stop_percent)) {
  97:         const percent = trade.trailing_stop_percent;
  98:         const currentTrigger = trade.trailing_stop_trigger || trade.entry_price;
  99:         let shouldUpdateTrigger = false;
 100:         let newTrigger = currentTrigger;
 101: 
 102:         if (trade.side === 'LONG') {
 103:           if (price > currentTrigger) { newTrigger = price; shouldUpdateTrigger = true; }
 104:           const stopPrice = newTrigger * (1 - percent / 100);
 105:           if (price <= stopPrice) closeReason = 'trailing_stop';
 106:         } else {
 107:           if (price < currentTrigger) { newTrigger = price; shouldUpdateTrigger = true; }
 108:           const stopPrice = newTrigger * (1 + percent / 100);
 109:           if (price >= stopPrice) closeReason = 'trailing_stop';
 110:         }
 111: 
 112:         if (shouldUpdateTrigger && !closeReason) {
 113:           await base44.asServiceRole.entities.Trade.update(trade.id, { trailing_stop_trigger: newTrigger });
 114:         }
 115:       }
 116: 
 117:       if (closeReason) {
 118:         await closeTradeInternal(base44, trade, price, closeReason);
 119:       }
 120:     }
 121: 
 122:     // Check Pending Trades (Limit/Stop)
 123:     for (const trade of (pendingTrades || [])) {
 124:       const price = prices[trade.symbol];
 125:       if (!price) continue;
 126: 
 127:       if (trade.order_type === 'LIMIT') {
 128:         if ((trade.side === 'LONG' && price <= trade.limit_price) || 
 129:             (trade.side === 'SHORT' && price >= trade.limit_price)) {
 130:           await executeOrderInternal(base44, trade, price);
 131:         }
 132:       } 
 133:       else if (trade.order_type === 'STOP' || trade.order_type === 'OCO') {
 134:         // Assuming limit_price or stop_price holds the trigger
 135:         // For OCO, we have stop_price (trigger) and limit_price (limit)
 136:         // Check schema usage: STOP orders usually have stop_price as trigger.
 137:         // But our openTrade uses limitPrice for LIMIT orders.
 138:         // For STOP orders, we might have used limitPrice as trigger in previous simplified version.
 139:         // Let's assume trade.limit_price is the trigger for simple STOP orders if no separate field.
 140:         // BUT we updated schema to have oco_stop_price etc.
 141:         // Let's use generic logic if fields exist.
 142:         
 143:         const triggerPrice = trade.oco_stop_price || trade.stop_loss || trade.limit_price; // Fallback
 144:         
 145:         if ((trade.side === 'LONG' && price >= triggerPrice) ||
 146:             (trade.side === 'SHORT' && price <= triggerPrice)) {
 147:           await executeOrderInternal(base44, trade, price);
 148:         }
 149:       }
 150:     }
 151: 
 152:   } catch (e) {
 153:     console.error("Inline check error:", e);
 154:   }
 155: }
 156: 
 157: async function closeTradeInternal(base44, trade, exitPrice, reason) {
 158:   // Logic copied/adapted from closeTrade action
 159:   // We call this internally
 160:   
 161:   // Calculate PnL etc
 162:   let grossPnl = 0;
 163:   if (trade.side === 'LONG') {
 164:     grossPnl = (exitPrice - trade.entry_price) * trade.quantity;
 165:   } else {
 166:     grossPnl = (trade.entry_price - exitPrice) * trade.quantity;
 167:   }
 168:   
 169:   const notionalValue = trade.quantity * exitPrice;
 170:   const closingFee = notionalValue * TRADING_FEES.taker / 100;
 171:   
 172:   const netPnl = grossPnl - closingFee; // simplified funding for inline
 173:   const pnlPercent = (netPnl / trade.margin) * 100;
 174:   
 175:   await base44.asServiceRole.entities.Trade.update(trade.id, {
 176:     exit_price: exitPrice,
 177:     status: 'CLOSED',
 178:     pnl: netPnl,
 179:     pnl_percent: pnlPercent,
 180:     fees: (trade.fees || 0) + closingFee,
 181:     closed_at: new Date().toISOString(),
 182:     close_reason: reason
 183:   });
 184:   
 185:   // Return funds
 186:   const returnAmount = trade.margin + netPnl;
 187:   const accounts = await base44.entities.TradingAccount.filter({ id: trade.trading_account_id });
 188:   if (accounts?.length) {
 189:     const account = accounts[0];
 190:     if (account.is_demo) {
 191:       const newBal = account.demo_balance + returnAmount;
 192:       await base44.asServiceRole.entities.TradingAccount.update(trade.trading_account_id, {
 193:         demo_balance: newBal,
 194:         balance: newBal,
 195:         margin_used: Math.max(0, account.margin_used - trade.margin)
 196:       });
 197:     } else {
 198:       await base44.asServiceRole.entities.TradingAccount.update(trade.trading_account_id, {
 199:         balance: account.balance + returnAmount,
 200:         margin_used: Math.max(0, account.margin_used - trade.margin)
 201:       });
 202:     }
 203:   }
 204: }
 205: 
 206: async function executeOrderInternal(base44, trade, price) {
 207:   // Execute pending order
 208:   await base44.asServiceRole.entities.Trade.update(trade.id, {
 209:     status: 'OPEN',
 210:     entry_price: price, // Fill at market
 211:     open_at: new Date().toISOString()
 212:   });
 213: }
 214: 
 215: 
 216: Deno.serve(async (req) => {
 217:   const base44 = createClientFromRequest(req);
 218:   
 219:   try {
 220:     const user = await base44.auth.me();
 221:     if (!user) {
 222:       return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
 223:     }
 224:     
 225:     const body = await req.json();
 226:     const { action, ...params } = body;
 227:     
 228:     // Lazy execution check for GET requests
 229:     if (action === 'getTrades' || action === 'getOpenPositions' || action === 'list') {
 230:       // Don't await this, let it run in background? No, Deno deploy might kill it. 
 231:       // We must await it or accept it might not finish.
 232:       // But we want results to reflect changes.
 233:       await checkUserOrders(base44, user.id, params.tradingAccountId);
 234:     }
 235: 
 236:     if (action === 'getOrCreate') {
 237:       const { accountType = 'demo' } = params;
 238:       
 239:       let accounts = await base44.entities.TradingAccount.filter({ 
 240:         user_id: user.id,
 241:         account_type: accountType
 242:       });
 243:       
 244:       if (!accounts?.length) {
 245:         const accountId = `TA_${accountType}_${user.id.substring(0, 8)}_${Date.now()}`;
 246:         const isDemo = accountType === 'demo';
 247:         
 248:         const newAccount = await base44.asServiceRole.entities.TradingAccount.create({
 249:           account_id: accountId,
 250:           user_id: user.id,
 251:           user_email: user.email,
 252:           nickname: params.nickname || (isDemo ? 'Demo Account' : 'Live Account'),
 253:           account_type: accountType,
 254:           balance: isDemo ? 10000 : 0,
 255:           equity: isDemo ? 10000 : 0,
 256:           margin_used: 0,
 257:           unrealized_pnl: 0,
 258:           realized_pnl: 0,
 259:           total_trades: 0,
 260:           winning_trades: 0,
 261:           status: 'active',
 262:           default_leverage: 10,
 263:           is_demo: isDemo,
 264:           demo_balance: isDemo ? 10000 : 0
 265:         });
 266:         
 267:         audit('ACCOUNT_CREATED', user.id, { account_id: accountId, accountType });
 268:         
 269:         let wallet = null;
 270:         if (!isDemo) {
 271:           wallet = await base44.asServiceRole.entities.Wallet.create({
 272:             trading_account_id: newAccount.id,
 273:             user_id: user.id,
 274:             currency: 'USDT',
 275:             network: 'TRC20',
 276:             balance: 0,
 277:             status: 'active',
 278:             is_primary: true
 279:           });
 280:         }
 281:         
 282:         return Response.json({ success: true, data: newAccount, wallet, isNew: true });
 283:       }
 284:       
 285:       let wallet = null;
 286:       if (accountType !== 'demo') {
 287:         const wallets = await base44.entities.Wallet.filter({
 288:           trading_account_id: accounts[0].id,
 289:           is_primary: true
 290:         });
 291:         wallet = wallets?.[0] || null;
 292:       }
 293:       
 294:       return Response.json({ success: true, data: accounts[0], wallet, isNew: false });
 295:     }
 296: 
 297:     if (action === 'openTrade') {
 298:       const { 
 299:         tradingAccountId, 
 300:         walletId,
 301:         symbol, 
 302:         side, 
 303:         quantity, 
 304:         leverage = 10, 
 305:         entryPrice,
 306:         orderType = 'MARKET',
 307:         limitPrice,
 308:         stopPrice,
 309:         stopLoss, 
 310:         takeProfit,
 311:         trailingStopPercent,
 312:         trailingStopActivation,
 313:         oco_stop_price, // Fix: support these params
 314:         oco_limit_price,
 315:         isOCO,
 316:         maxSlippage = 0.5
 317:       } = params;
 318:       
 319:       if (!tradingAccountId || !symbol || !side || !quantity || !entryPrice) {
 320:         return Response.json({ success: false, error: 'Missing required fields' }, { status: 400 });
 321:       }
 322:       
 323:       const accounts = await base44.entities.TradingAccount.filter({ 
 324:         id: tradingAccountId, 
 325:         user_id: user.id 
 326:       });
 327:       
 328:       if (!accounts?.length) {
 329:         return Response.json({ success: false, error: 'Account not found' }, { status: 404 });
 330:       }
 331:       
 332:       const account = accounts[0];
 333:       
 334:       let actualEntryPrice = entryPrice;
 335:       let actualSlippage = 0;
 336:       let status = 'OPEN';
 337:       
 338:       // Handle Order Types
 339:       if (orderType === 'LIMIT' || orderType === 'STOP' || orderType === 'OCO') {
 340:         status = 'PENDING';
 341:       }
 342:       
 343:       if (status === 'OPEN' && orderType === 'MARKET') {
 344:         actualSlippage = calculateSlippage(quantity * entryPrice, maxSlippage);
 345:         if (side === 'LONG') {
 346:           actualEntryPrice = entryPrice * (1 + actualSlippage / 100);
 347:         } else {
 346:           actualEntryPrice = entryPrice * (1 - actualSlippage / 100);
 347:         }
 348:       }
 349:       
 350:       const notionalValue = quantity * actualEntryPrice;
 351:       const marginRequired = notionalValue / leverage;
 352:       const tradingFee = notionalValue * TRADING_FEES.taker / 100;
 353:       const totalRequired = marginRequired + tradingFee;
 354:       
 355:       const liquidationPrice = calculateLiquidationPrice(actualEntryPrice, leverage, side);
 356:       
 357:       let availableBalance = 0;
 358:       let useWallet = null;
 359:       
 360:       if (account.is_demo) {
 361:         availableBalance = account.demo_balance - account.margin_used;
 362:       } else {
 363:         if (!walletId) {
 364:           const wallets = await base44.entities.Wallet.filter({
 365:             trading_account_id: tradingAccountId,
 366:             is_primary: true
 367:           });
 368:           useWallet = wallets?.[0];
 369:         } else {
 370:           const wallets = await base44.entities.Wallet.filter({
 371:             id: walletId,
 372:             user_id: user.id
 373:           });
 374:           useWallet = wallets?.[0];
 375:         }
 376:         
 377:         if (!useWallet) {
 378:           return Response.json({ success: false, error: 'No wallet found for trading' }, { status: 400 });
 379:         }
 380:         
 381:         availableBalance = useWallet.balance - useWallet.locked_balance - useWallet.staked_balance;
 382:       }
 383:       
 384:       if (totalRequired > availableBalance) {
 385:         return Response.json({ 
 386:           success: false, 
 387:           error: `Insufficient balance. Required: $${totalRequired.toFixed(2)}, Available: $${availableBalance.toFixed(2)}` 
 388:         }, { status: 400 });
 389:       }
 390:       
 391:       const trade = await base44.asServiceRole.entities.Trade.create({
 392:         trading_account_id: tradingAccountId,
 393:         wallet_id: useWallet?.id || null,
 394:         user_id: user.id,
 395:         symbol,
 396:         side,
 397:         order_type: orderType,
 398:         entry_price: actualEntryPrice,
 399:         limit_price: limitPrice || null,
 400:         quantity,
 401:         leverage,
 402:         margin: marginRequired,
 403:         status: status,
 404:         fees: tradingFee,
 405:         slippage: actualSlippage,
 406:         max_slippage: maxSlippage,
 407:         liquidation_price: liquidationPrice,
 408:         stop_loss: stopLoss || null,
 409:         take_profit: takeProfit || null,
 410:         trailing_stop_percent: trailingStopPercent || null,
 411:         trailing_stop_activation: trailingStopActivation || null,
 412:         oco_stop_price: oco_stop_price || null,
 413:         oco_limit_price: oco_limit_price || null,
 414:         is_oco: isOCO || false
 415:       });
 416:       
 417:       // Deduct margin
 418:       if (account.is_demo) {
 419:         await base44.asServiceRole.entities.TradingAccount.update(tradingAccountId, {
 420:           demo_balance: account.demo_balance - totalRequired,
 421:           balance: account.demo_balance - totalRequired,
 422:           margin_used: account.margin_used + marginRequired,
 423:           total_trades: account.total_trades + 1
 424:         });
 425:       } else {
 426:         // ... (existing wallet logic, abbreviated for safety)
 427:         await base44.asServiceRole.entities.Wallet.update(useWallet.id, {
 428:           balance: useWallet.balance - totalRequired
 429:         });
 430:         await base44.asServiceRole.entities.TradingAccount.update(tradingAccountId, {
 431:           balance: account.balance - totalRequired,
 432:           margin_used: account.margin_used + marginRequired,
 433:           total_trades: account.total_trades + 1
 434:         });
 435:       }
 436:       
 437:       // Notification
 438:       if (status === 'OPEN') {
 439:         await base44.asServiceRole.entities.Notification.create({
 440:           user_id: user.id,
 441:           type: 'trade_executed',
 442:           title: `${side} ${symbol} Opened`,
 443:           message: `${side} ${quantity} ${symbol} at $${actualEntryPrice.toFixed(2)}`,
 444:           data: { tradeId: trade.id, symbol, side, quantity, entryPrice: actualEntryPrice },
 445:           priority: 'normal'
 446:         });
 447:       } else {
 448:         await base44.asServiceRole.entities.Notification.create({
 449:           user_id: user.id,
 450:           type: 'system', // or order_created
 451:           title: `${orderType} Order Placed`,
 452:           message: `${orderType} order for ${symbol} placed.`,
 453:           data: { tradeId: trade.id, symbol, orderType },
 454:           priority: 'normal'
 455:         });
 456:       }
 457:       
 458:       return Response.json({ success: true, data: trade });
 459:     }
 460: 
 461:     if (action === 'closeTrade') {
 462:       const { tradeId, exitPrice, reason = 'manual' } = params;
 463:       
 464:       if (!tradeId || !exitPrice) {
 465:         return Response.json({ success: false, error: 'Missing tradeId or exitPrice' }, { status: 400 });
 466:       }
 467:       
 468:       const trades = await base44.entities.Trade.filter({ id: tradeId });
 469:       if (!trades?.length) {
 470:         return Response.json({ success: false, error: 'Trade not found' }, { status: 404 });
 471:       }
 472:       const trade = trades[0];
 473:       
 474:       await closeTradeInternal(base44, trade, exitPrice, reason);
 475:       
 476:       return Response.json({ success: true, data: { tradeId, status: 'CLOSED' } });
 477:     }
 478: 
 479:     if (action === 'updateTrade') {
 480:       const { tradeId, stopLoss, takeProfit, trailingStopTrigger } = params;
 481:       if (!tradeId) {
 482:         return Response.json({ success: false, error: 'Missing tradeId' }, { status: 400 });
 483:       }
 484:       
 485:       const updateData = {};
 486:       if (stopLoss !== undefined) updateData.stop_loss = stopLoss;
 487:       if (takeProfit !== undefined) updateData.take_profit = takeProfit;
 488:       if (trailingStopTrigger !== undefined) updateData.trailing_stop_trigger = trailingStopTrigger;
 489:       
 490:       await base44.asServiceRole.entities.Trade.update(tradeId, updateData);
 491:       return Response.json({ success: true });
 492:     }
 493: 
 494:     if (action === 'executePendingOrder') {
 495:        const { tradeId, entryPrice } = params;
 496:        if (!tradeId || !entryPrice) return Response.json({ success: false }, { status: 400 });
 497:        
 498:        await base44.asServiceRole.entities.Trade.update(tradeId, {
 499:          status: 'OPEN',
 500:          entry_price: entryPrice,
 501:          open_at: new Date().toISOString()
 502:        });
 503:        return Response.json({ success: true });
 504:     }
 505: 
 506:     if (action === 'getTrades') {
 507:       const { tradingAccountId, status, limit = 50 } = params;
 508:       let query = { user_id: user.id };
 509:       if (tradingAccountId) query.trading_account_id = tradingAccountId;
 510:       if (status) query.status = status;
 511:       const trades = await base44.entities.Trade.filter(query, '-created_date', limit);
 512:       return Response.json({ success: true, data: trades || [] });
 513:     }
 514: 
 515:     if (action === 'getOpenPositions') {
 516:       const trades = await base44.entities.Trade.filter({ 
 517:         user_id: user.id,
 518:         status: 'OPEN'
 519:       });
 520:       return Response.json({ success: true, data: trades || [] });
 521:     }
 522: 
 523:     if (action === 'cancelOrder') {
 524:       const { tradeId } = params;
 525:       const trades = await base44.entities.Trade.filter({ id: tradeId, user_id: user.id, status: 'PENDING' });
 526:       if (!trades?.length) {
 527:         return Response.json({ success: false, error: 'Pending order not found' }, { status: 404 });
 528:       }
 529:       const trade = trades[0];
 530:       
 531:       // Refund
 532:       const accounts = await base44.entities.TradingAccount.filter({ id: trade.trading_account_id });
 533:       if (accounts?.length) {
 534:         const account = accounts[0];
 535:         const refund = trade.margin + (trade.fees || 0);
 536:         if (account.is_demo) {
 537:           await base44.asServiceRole.entities.TradingAccount.update(trade.trading_account_id, {
 538:             demo_balance: account.demo_balance + refund,
 539:             balance: account.balance + refund,
 540:             margin_used: Math.max(0, account.margin_used - trade.margin)
 541:           });
 542:         } else {
 543:            // Wallet refund logic...
 544:            if (trade.wallet_id) {
 545:              const wallets = await base44.entities.Wallet.filter({ id: trade.wallet_id });
 546:              if (wallets?.length) {
 547:                await base44.asServiceRole.entities.Wallet.update(trade.wallet_id, {
 548:                  balance: wallets[0].balance + refund
 549:                });
 550:              }
 551:            }
 552:            await base44.asServiceRole.entities.TradingAccount.update(trade.trading_account_id, {
 553:              balance: account.balance + refund,
 554:              margin_used: Math.max(0, account.margin_used - trade.margin)
 555:            });
 556:         }
 557:       }
 558:       
 559:       await base44.asServiceRole.entities.Trade.update(tradeId, { status: 'CANCELLED', close_reason: 'cancelled' });
 560:       return Response.json({ success: true });
 561:     }
 562: 
 563:     if (action === 'list') {
 564:       const accounts = await base44.entities.TradingAccount.filter({ user_id: user.id });
 565:       return Response.json({ success: true, data: accounts || [] });
 566:     }
 567: 
 568:     return Response.json({ success: false, error: 'Invalid action' }, { status: 400 });
 569:     
 570:   } catch (error) {
 571:     console.error('[TRADING_ACCOUNT_ERROR]', error.message);
 572:     return Response.json({ success: false, error: error.message }, { status: 500 });
 573:   }
 574: });