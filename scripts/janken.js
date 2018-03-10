'use strict';

const Balance = require('../models/balance');
const Deal = require('../models/deal');
const loader = require('../models/sequelizeLoader');
const Sequelize = loader.Sequelize;
const sequelize = loader.database;
const balanceDefaultValue = Balance.balanceDefaultValue;
const sendCoin = require('../models/sendCoin');

Balance.sync();
Deal.sync();

module.exports = robot => {
  // ジャンケンコマンド
  robot.hear(/!nc janken/i, msg => {
    const parsed = msg.message.rawText.match(
      /^!nc janken (グー|チョキ|パー) (\d+)\s*$/
    );
    if (!parsed) {
      msg.send(
        'ジャンケンコマンドの形式が `!nc janken {グー or チョキ or パー} {ベッド額(正の整数)}` ではありません。'
      );
      return;
    }
    const opponentHand = parsed[1];
    const bed = parseInt(parsed[2]);
    const maxBed = 30;

    if (bed > maxBed) {
      msg.send(
        `${maxBed} Nコイン以上をかけてジャンケンすることは禁止されています。`
      );
      return;
    }

    if (bed <= 0) {
      msg.send('0 Nコインより小さな数のNコインをかけることはできません。');
      return;
    }

    const opponent = msg.message.user;
    const opponentId = opponent.id;
    const me = robot.adapter.self;
    me.profile = {
      display_name: '' // 仮の情報設定
    };
    const myId = me.id;

    Balance.findOrCreate({
      where: { userId: opponentId },
      defaults: {
        userId: opponent.id,
        name: opponent.name,
        realName: opponent.real_name,
        displayName: opponent.profile.display_name,
        balance: balanceDefaultValue,
        isAdmin: false
      }
    }).spread((opponentBalance, isCreateOpponent) => {
      if (myBalance.balance <= 10){
        msg.send(
          `<@${opponent.id}>さんの残高は ${
            opponentBalance.balance
          } Nコインしかないため、${bed} これ以上ジャンケンは出来ません。`
        );
        return;
      }
      else if (bed > opponentBalance.balance) {
        msg.send(
          `<@${opponent.id}>さんの残高は ${
            opponentBalance.balance
          } Nコインしかないため、${bed} Nコインをかけてジャンケンすることはできません。`
        );
      } else if (bed <= 0) {
        msg.send('正の整数のベッド額しかしかかけることはできません。');
      } else {
        Balance.findOrCreate({
          where: { userId: myId },
          defaults: {
            userId: myId,
            name: me.name,
            realName: me.real_name,
            displayName: me.profile.display_name,
            balance: balanceDefaultValue,
            isAdmin: true
          }
        }).spread((myBalance, isCreatedTo) => {
          if (myBalance.balance < bed) {
            msg.send(
              `すみません。わたしの残高は ${
                myBalance.balance
              } Nコインしかないため、${bed} Nコインをかけてジャンケンすることはできません。どなたか寄付をお願いします。`
            );
            return;
          } else {
            const myHands = ['グー', 'チョキ', 'パー'];
            const myHand = myHands[Math.floor(Math.random() * myHands.length)];

            if (myHand === opponentHand) {
              msg.send(
                `ジャンケン！ ${myHand}！...あいこですね。またの機会に。`
              );
              return;
            }

            const isWon =
              (myHand === 'グー' && opponentHand === 'チョキ') ||
              (myHand === 'チョキ' && opponentHand === 'パー') ||
              (myHand === 'パー' && opponentHand === 'グー');

            if (isWon) {
              msg.send(
                `ジャンケン！ ${myHand}！...あなたの負けですね。${bed} Nコイン頂きます。`
              );
              sendCoin(robot, msg, opponent, myId, bed);
              return;
            } else {
              msg.send(
                `ジャンケン！ ${myHand}！...あなたの勝ちですね。${bed} Nコインお支払いしましょう。`
              );
              sendCoin(robot, msg, me, opponent.id, bed);
              return;
            }
          }
        });
      }
    });
  });
};
