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

////////// 各種定義 ///////////
const maxBed = 15; // 最大ベッド額
const maxPlayableBalance = 500; // ジャンケン可能最高残高
const chargeFreeMaxBalance = 100; // 手数料ゼロ最高残高 (以下の場合は逆にサービス)

/**
 * 賞金から差し引く手数料割合の計算関数
 * (残高 - 手数料ゼロ最大残高) / ジャンケン可能最高残高
 * 残高150の時、(150 - 100) / 500 = 10 / 100 = 10%
 * 残高500の時、 (500 - 100) / 500 = 80 / 100 = 80%
 * @param {Number} balance 残高
 * @returns {Number} 手数料割合
 */
function chargeRate(balance) {
  return (balance - chargeFreeMaxBalance) / maxPlayableBalance;
}

/**
 * 手数料ゼロ時の賞金のサービス割合の計算関数
 * 残高1の時、 (100 - 1) / 100  + 1 = 199 / 100 = 199%
 * 残高100の時、 (100 - 100) / 100  + 1 = 100 / 100 = 100%
 * @param {Number} balance 残高
 * @returns {Number} サービス割合
 */
function serviceRate(balance) {
  return (chargeFreeMaxBalance - balance) / chargeFreeMaxBalance + 1;
}
///////////////////////////////

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

    if (bed > maxBed) {
      msg.send(
        `*${maxBed}N* コイン以上をかけてジャンケンすることは禁止されています。`
      );
      return;
    }

    if (bed <= 0) {
      msg.send('*0N* コインより小さな数のNコインをかけることはできません。');
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
      if (bed > opponentBalance.balance) {
        msg.send(
          `<@${opponent.id}>さんの残高は *${
            opponentBalance.balance
          }N* コインしかないため、 *${bed}N* コインをかけてジャンケンをすることはできません。`
        );
      } else if (opponentBalance.balance > maxPlayableBalance) {
        msg.send(
          `<@${opponent.id}>さんの残高は *${
            opponentBalance.balance
          }N* コインもあり、 *${maxPlayableBalance}N* コインより多いためジャンケンすることはできません。`
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
              `すみません。わたしの残高は *${
                myBalance.balance
              }N* コインしかないため、 *${bed}N* コインをかけてジャンケンすることはできません。どなたか寄付をお願いします。`
            );
            return;
          } else {
            const myHands = ['グー', 'チョキ', 'パー'];
            const myHand = myHands[Math.floor(Math.random() * myHands.length)];

            if (myHand === opponentHand) {
              msg.send(
                `ジャンケン！ ${myHand}！... *あいこ* ですね。またの機会に。`
              );
              return;
            }

            const isWon =
              (myHand === 'グー' && opponentHand === 'チョキ') ||
              (myHand === 'チョキ' && opponentHand === 'パー') ||
              (myHand === 'パー' && opponentHand === 'グー');

            if (isWon) {
              msg.send(
                `ジャンケン！ ${myHand}！...あなたの *負け* ですね。 *${bed}N* コイン頂きます。`
              );
              sendCoin(robot, msg, opponent, myId, bed);
              return;
            } else {
              if (opponentBalance.balance <= chargeFreeMaxBalance) {
                // サービス時
                const rate = serviceRate(opponentBalance.balance);
                const sendAmount = Math.ceil(rate * bed);
                msg.send(
                  `ジャンケン！ ${myHand}！...あなたの *勝ち* ですね。 サービスで *${sendAmount}N* コインお支払いしましょう。`
                );
                sendCoin(robot, msg, me, opponent.id, sendAmount);
                return;
              } else {
                // 手数料必須時
                const rate = chargeRate(opponentBalance.balance);
                const charge = Math.floor(rate * bed);
                const sendAmount = bed - charge;
                msg.send(
                  `ジャンケン！ ${myHand}！...あなたの *勝ち* ですね。 *${charge}N* コインを手数料として頂き、 *${sendAmount}N* コインお支払いしましょう。`
                );
                sendCoin(robot, msg, me, opponent.id, sendAmount);
                return;
              }
            }
          }
        });
      }
    });
  });
};
