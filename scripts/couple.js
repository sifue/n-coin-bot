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

const priceCoupleCommand = 1;

module.exports = robot => {
  // 今日の相性占いコマンド
  robot.hear(/!nc couple/i, msg => {
    const parsed = msg.message.rawText.match(/^!nc couple <@(.+)>\s*$/);
    const targetId = parsed[1];

    if (!targetId) {
      msg.send(
        '`!nc couple {@ユーザー名}` のように@と一緒にユーザー名を入力する必要があります。'
      );
      return;
    } else {
      const me = msg.message.user;
      const myId = me.id;

      if (myId === targetId) {
        msg.send('自分自身との相性占いはできません。');
        return;
      }

      Balance.findOrCreate({
        where: { userId: myId },
        defaults: {
          userId: me.id,
          name: me.name,
          realName: me.real_name,
          displayName: me.profile.display_name,
          balance: balanceDefaultValue,
          isAdmin: false
        }
      }).spread((myBalance, isCreateOpponent) => {
        if (myBalance.balance < priceCoupleCommand) {
          msg.send(
            `<@${myBalance.id}>さんの残高は *${
              myBalance.balance
            } N* コインしかないため、 *${priceCoupleCommand}N* コインの相性占いをすることはできません。`
          );
          return;
        }

        const targetChemistoryPoint = chemistoryPoint(targetId);
        const myChemistoryPoint = chemistoryPoint(myId);

        // カップル相性は、 10 - (相性値の差の絶対値) で 10～1
        const coupleChemistory =
          10 - Math.abs(targetChemistoryPoint - myChemistoryPoint);
        const persentage = coupleChemistory * 10;
        const firstMessage = `<@${myId}>さんと<@${targetId}>さんとの今日の相性は *${persentage}%* です。\n`;
        const afterMessage = `\n今日の相性占いのお代として *${priceCoupleCommand}N* コイン頂きます。`;

        if (coupleChemistory === 1) {
          msg.send(
            firstMessage +
              '今日は相手のことを思いやったコミュニケーションを心がけるようにしましょう。' +
              afterMessage
          );
        } else if (coupleChemistory === 2) {
          msg.send(
            firstMessage +
              '今日は相手のやさしさや頑張りをもっとねぎらってあげるのが良いでしょう。' +
              afterMessage
          );
        } else if (coupleChemistory === 3) {
          msg.send(
            firstMessage +
              '今日は相手が何か言いたいことがあるのかもしれません。相手の話をしっかり聞いてあげましょう。' +
              afterMessage
          );
        } else if (coupleChemistory === 4) {
          msg.send(
            firstMessage +
              '今日は関係性が変わるできごとがあるかもしれません。チャンスを逃さないよう相手をよくみていると良いでしょう。' +
              afterMessage
          );
        } else if (coupleChemistory === 5) {
          msg.send(
            firstMessage +
              '今日は相手との相性が良くなり始めているタイミングです。積極的にコミュニケーションをとると良いでしょう。' +
              afterMessage
          );
        } else if (coupleChemistory === 6) {
          msg.send(
            firstMessage +
              '今日は相性が良いです。二人で何かをするときっと良い方向にことが動くでしょう。' +
              afterMessage
          );
        } else if (coupleChemistory === 7) {
          msg.send(
            firstMessage +
              '今日は相性がそこそこ良い日です。相手がナーバスになっているときには良いがげましができるでしょう。' +
              afterMessage
          );
        } else if (coupleChemistory === 8) {
          msg.send(
            firstMessage +
              '今日は相性のバランスが良い日です。自分から何かを打ち明けるには良い日になるでしょう。' +
              afterMessage
          );
        } else if (coupleChemistory === 9) {
          msg.send(
            firstMessage +
              '今日は相性がかなり良いです。何か二人で面白いことを企画するには最高の日でしょう。' +
              afterMessage
          );
        } else {
          msg.send(
            firstMessage +
              '今日は相性が絶好調です。相手を信頼して何かを一緒にすると良いでしょう。' +
              afterMessage
          );
        }
        sendCoin(robot, msg, me, robot.adapter.self.id, priceCoupleCommand);
      });
    }
  });
};

/**
 * 相性値を計算する
 * ユーザーIDの全てのコードポイントを足した10の剰余に日付をかけたものへの10の剰余
 * @param {*} userId
 */
function chemistoryPoint(userId) {
  let sum = 0;
  for (let i = 0; i < userId.length; i++) {
    sum += userId.charCodeAt(i);
  }
  const result = ((sum % 10) * new Date().getDate()) % 10;
  return result;
}
