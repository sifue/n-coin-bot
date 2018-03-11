'use strict';

const Marketitem = require('../models/marketitem');
const loader = require('../models/sequelizeLoader');
const Sequelize = loader.Sequelize;
const sequelize = loader.database;

Marketitem.sync();

const maxPrice = 100000;

module.exports = robot => {
  // マーケットボードのヘルプ表示
  robot.hear(/^!nc markethelp/i, msg => {
    msg.send(
      '■ マーケットボードコマンド一覧\n' +
        '`!nc market` マーケットボードの表示(メンションが飛ぶためDMでの利用推奨)\n' +
        '`!nc buy {価格} {内容}` で「買います」項目の追加\n' +
        '`!nc sell {価格} {内容}` で「売ります」項目の追加\n' +
        '`!nc marketdelete {マーケット項目ID}` 項目の削除'
    );
  });

  // 買いますコマンド
  robot.hear(/^!nc buy/i, msg => {
    const parsed = msg.message.rawText.match(/^!nc buy (\d+) (.+)$/);

    if (!parsed) {
      msg.send(
        '買いますコマンドの形式が `!nc buy {価格} {内容}` ではありません。'
      );
      return;
    }

    const dataType = '買います';
    const user = msg.message.user;
    const price = parseInt(parsed[1]);
    const text = parsed[2].trim().slice(0, 255);
    createMarketitem(msg, dataType, user, price, text);
  });

  // 売りますコマンド
  robot.hear(/^!nc sell/i, msg => {
    const parsed = msg.message.rawText.match(/^!nc sell (\d+) (.+)$/);

    if (!parsed) {
      msg.send(
        '売りますコマンドの形式が `!nc sell {価格} {内容}` ではありません。'
      );
      return;
    }

    const dataType = '売ります';
    const user = msg.message.user;
    const price = parseInt(parsed[1]);
    const text = parsed[2].trim().slice(0, 255);
    createMarketitem(msg, dataType, user, price, text);
  });

  // マーケットボード表示コマンド
  robot.hear(/!nc market$/i, msg => {
    Marketitem.findAll({
      limit: 100,
      order: '"marketitemId" DESC'
    }).then(marketitems => {
      marketitems.forEach(e => {
        if (e.dataType === '売ります') {
          e.dataTypeValue = 1;
        } else {
          e.dataTypeValue = 0;
        }
      });

      const sortedMarketitems = marketitems.sort((a, b) => {
        if (a.dataTypeValue !== b.dataTypeValue) {
          return a.dataTypeValue - b.dataTypeValue;
        }
        return a.price - b.price;
      });

      let message =
        '■ マーケット情報一覧 (最新100件 - 出品タイプ/価格ソート)\n';
      message += sortedMarketitems
        .map(m => {
          return `[${m.marketitemId}] <@${m.userId}>が *${m.price}N* コインで${
            m.dataType
          } : ${m.text}`;
        })
        .join('\n');
      msg.send(message);
    });
  });

  // マーケットボードからの削除コマンド
  robot.hear(/!nc marketdelete/i, msg => {
    const parsed = msg.message.rawText.match(/^!nc marketdelete (\d+)$/);

    if (!parsed) {
      msg.send(
        'マーケットボードからの削除コマンドの形式が `!nc marketdelete {マーケット項目ID}` ではありません。'
      );
      return;
    }
    const user = msg.message.user;
    const userId = user.id;

    const marketitemId = parseInt(parsed[1]);
    Marketitem.destroy({
      where: {
        marketitemId: marketitemId,
        userId: userId // 自分のものだけを削除できるようにする
      }
    }).then(deleteCount => {
      if (deleteCount) {
        msg.send(
          `マーケットボードからマーケット項目ID [${marketitemId}] を削除しました。`
        );
      }
    });
  });
};

function createMarketitem(msg, dataType, user, price, text) {
  if (price > maxPrice) {
    msg.send(`*${maxPrice}N* コイン以上のものは扱えません。`);
    return;
  }

  if (price < 1) {
    msg.send('*1N* コインより小さいものは扱えません。');
    return;
  }

  const userId = user.id;
  Marketitem.create({
    userId,
    dataType,
    price,
    text
  }).then(marketitem => {
    msg.send(
      `マーケット情報追加: <@${userId}>さんが「${text}」を *${price}N* コインで${dataType}。`
    );
  });
}
