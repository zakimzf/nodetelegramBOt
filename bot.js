const Binance = require('node-binance-api');
const TelegramBot = require('node-telegram-bot-api');

const api_key = 'YOUR_API_KEY';
const api_secret = 'YOUR_SECRET_KEY';
const bot_token = 'YOUR_BOT_TOKEN';

const binance = new Binance().options({
  APIKEY: api_key,
  APISECRET: api_secret,
});

const bot = new TelegramBot(bot_token, { polling: true });

function get_price_change(symbol, interval) {
  return new Promise((resolve, reject) => {
    binance.candlesticks(symbol, interval, (error, ticks) => {
      if (error) {
        reject(error);
      } else {
        const df = ticks.map(([timestamp, open, high, low, close, volume, close_time, quote_asset_volume, number_of_trades, taker_buy_base_asset_volume, taker_buy_quote_asset_volume, ignore]) => ({
          timestamp: new Date(Number(timestamp)),
          open: Number(open),
          high: Number(high),
          low: Number(low),
          close: Number(close),
          volume: Number(volume),
          close_time: new Date(Number(close_time)),
          quote_asset_volume: Number(quote_asset_volume),
          number_of_trades: Number(number_of_trades),
          taker_buy_base_asset_volume: Number(taker_buy_base_asset_volume),
          taker_buy_quote_asset_volume: Number(taker_buy_quote_asset_volume),
          ignore: ignore,
        }));
        const price_change = (df[df.length - 1].close / df[0].close) - 1;
        resolve(price_change);
      }
    }, { limit: 2 });
  });
}

async function top_gainers(msg) {
  try {
    const tickers = await binance.prices();
    const price_changes = {};
    for (const [symbol, price] of Object.entries(tickers)) {
      const price_change_1h = await get_price_change(symbol, '1h');
      const price_change_10m = await get_price_change(symbol, '10m');
      if (price_change_1h > 0) {
        price_changes[symbol] = { '1hr': price_change_1h, '10m': price_change_10m };
      }
    }
    const sorted_price_changes = Object.entries(price_changes).sort((a, b) => b[1]['1hr'] - a[1]['1hr']);
    let top_10_gainers = 'Top 10 gainers in the past 1 hour:\n';
    for (let i = 0; i < 10 && i < sorted_price_changes.length; i++) {
      const [symbol, price_changes] = sorted_price_changes[i];
      top_10_gainers += `\n${i+1}. ${symbol}: ${(price_changes['1hr']*100).toFixed(2)}%`;
    }
    await bot.sendMessage(msg.chat.id, top_10_gainers);

    let alert_1h = 'Tokens with more than 10% gain in the past 1 hour:\n';
    for (const [symbol, price_changes] of Object.entries(price_changes)) {
      if (price_changes['1hr'] >= 0.1) {
        alert_1h += `\n${symbol}: ${(price_changes['1hr']*100).toFixed(2)}%`;
      }
    }
    await bot.sendMessage(msg.chat.id, alert_1h);

    let alert_10m = 'Tokens with more than 10% gain in the past 10 minutes:\n';
    for (const [symbol, price_changes] of Object.entries(price_changes)) {
      if (price_changes['10m'] >= 0.1) {
        alert_10m += `\n${symbol}: ${(price_changes['10m']*100).toFixed(2)}%`;
      }
    }
    await bot.sendMessage(msg.chat.id, alert_10m);

  } catch (error) {
    console.error(error);
  }
}

bot.onText(/\/topgainers/, top_gainers);
