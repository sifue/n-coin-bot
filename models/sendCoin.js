'use strict';

const Balance = require('./balance');
const Deal = require('./deal');
const loader = require('./sequelizeLoader');
const Sequelize = loader.Sequelize;
const sequelize = loader.database;
const logChannelId = 'C9N87D70X';
const balanceDefaultValue = Balance.balanceDefaultValue;

Balance.sync();
Deal.sync();

// user : apiのuserオブジェクト 例) msg.message.user
function sendCoin(robot, msg, user, toUserId, amount) {
  Balance.findOrCreate({
    where: { userId: user.id },
    defaults: {
      userId: user.id,
      name: user.name,
      realName: user.real_name,
      displayName: user.profile.display_name,
      balance: balanceDefaultValue,
      isAdmin: false
    }
  }).spread((fromBalance, isCreatedFrom) => {
    let displayName = fromBalance.displayName;
    if (!displayName) {
      displayName = fromBalance.name;
    }

    if (amount > fromBalance.balance) {
      msg.send(
        `<@${user.id}>さんの残高は *${
          fromBalance.balance
        }N* コインしかないため、*${amount}N* コインを送金することはできません。`
      );
    } else if (toUserId === user.id) {
      msg.send(`<@${user.id}>さん自身に送金することはできません。`);
    } else if (amount <= 0) {
      msg.send('正の整数の送金額しか送ることはできません。');
    } else {
      Balance.findOrCreate({
        where: { userId: toUserId },
        defaults: {
          userId: toUserId,
          name: '',
          realName: '',
          displayName: '',
          balance: balanceDefaultValue,
          isAdmin: false
        }
      }).spread((toBalance, isCreatedTo) => {
        sequelize
          .transaction(t => {
            const newFromBalanceValue = fromBalance.balance - amount;
            const newToBalanceValue = toBalance.balance + amount;
            // Transaction は Updateと DealCreate の時だけ
            const pUpdate1 = Balance.update(
              { balance: newFromBalanceValue },
              { where: { userId: user.id } },
              { transaction: t }
            );
            const pUpdate2 = pUpdate1.then(() => {
              return Balance.update(
                { balance: newToBalanceValue },
                { where: { userId: toUserId } },
                { transaction: t }
              );
            });
            const pCreateLog = pUpdate2.then(() => {
              // ログ作成処理
              return Deal.create(
                {
                  fromUserId: user.id,
                  toUserId: toUserId,
                  amount: amount
                },
                { transaction: t }
              );
            });
            return pCreateLog.then(() => {
              msg.send(
                `<@${
                  user.id
                }>さんから<@${toUserId}>さんへ *${amount}N* コインが送金されました。\n` +
                  `<@${user.id}>さん 残高 *${newFromBalanceValue}N* コイン , ` +
                  `<@${toUserId}>さん 残高 *${newToBalanceValue}N* コイン`
              );
              robot.messageRoom(
                toUserId,
                `<@${user.id}> さんから *${amount}N* コインを受け取りました。`
              );
              robot.messageRoom(
                logChannelId,
                `<@${
                  user.id
                }>さんから<@${toUserId}>さんへ *${amount}N* コインが送金されました。`
              );
            });
          })
          .then(result => {
            // result is whatever the result of the promise chain returned to the transaction callback
          })
          .catch(e => {
            robot.logger.error(e);
          });
      });
    }
  });
}

module.exports = sendCoin;
