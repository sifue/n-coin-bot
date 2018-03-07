'use strict';

const Balance = require('../models/balance');
const Deal = require('../models/deal');
const loader = require('../models/sequelizeLoader');
const Sequelize = loader.Sequelize;
const sequelize = loader.database;

Balance.sync();
Deal.sync();

module.exports = (robot) => {

  // ヘルプ表示
  robot.hear(/!nc help/i, (msg) => {
    msg.send(
      '■ コマンド一覧\n' +
      '`!nc mybalance` で自身の残高確認\n' +
      '`!nc balance {@ユーザー名}` でユーザーの残高確認\n' +
      '`!nc send {@ユーザー名} {送金額(整数)}` でユーザーに送金\n' +
      '`!nc top10` 残高ランキングトップ10を確認\n' +
      '`!nc top100` 残高ランキングトップ100を確認'
    );
  });

  // 自身の残高確認コマンド
  robot.hear(/!nc mybalance/i, (msg) => {
    const user = msg.message.user;
    const userId = user.id;
    Balance.findOrCreate({
      where: { userId: userId },
      defaults: {
        userId: userId,
        name: user.name,
        realName: user.real_name,
        displayName: user.profile.display_name,
        balance: 100,
        isAdmin: false
      }
    }).spread((balance, isCreated) => {
      msg.send(`<@${userId}>さんの残高は ${balance.balance} Nコインです。`);
      // 名前をアップデートしておく
      Balance.update({
        name: user.name,
        realName: user.real_name,
        displayName: user.profile.display_name,
      }, { where: { userId: userId } });
    })
      .catch(e => {
        robot.logger.error(e);
      });
  });

  // ユーザーの残高確認コマンド
  robot.hear(/!nc balance/i, (msg) => {
    const parsed = msg.message.rawText.match(/^!nc balance <@(.+)>\s*$/);
    const userId = parsed[1];

    if (!userId) {
      msg.send('`!nc balance {@ユーザー名}`のように@と一緒にユーザー名を入力する必要があります。');
    } else {
      Balance.findOrCreate({
        where: { userId: userId },
        defaults: {
          userId: userId,
          name: '',
          realName: '',
          displayName: '',
          balance: 100,
          isAdmin: false
        }
      }).spread((balance, isCreated) => {
        msg.send(`<@${userId}>さんの残高は ${balance.balance} Nコインです。`);
      })
        .catch(e => {
          robot.logger.error(e);
        });
    }
  });

  // 送金コマンド
  robot.hear(/!nc send/i, (msg) => {
    const user = msg.message.user;
    const userId = user.id;
    sequelize.transaction((t) => {
      return Balance.findOrCreate({
        where: { userId: userId },
        defaults: {
          userId: userId,
          name: user.name,
          realName: user.real_name,
          displayName: user.profile.display_name,
          balance: 100,
          isAdmin: false
        },
        transaction: t
      }).spread((fromBalance, isCreated) => {
        let displayName = fromBalance.displayName;
        if (!displayName) {
          displayName = fromBalance.name;
        }
        const parsed = msg.message.rawText.match(/^!nc send <@(.+)> (\d+)\s*$/);
        const toUserId = parsed[1];
        const amount = parseInt(parsed[2]);

        if (amount > fromBalance.balance) {
          msg.send(`<@${userId}>さんの残高は ${fromBalance.balance} Nコインしかないため、${amount} Nコインを送金することはできません。`);
        } else if (toUserId === userId) {
          msg.send(`<@${userId}>さん自身に送金することはできません。`);
        } else {
          return Balance.findOrCreate({
            where: { userId: toUserId },
            defaults: {
              userId: toUserId,
              name: '',
              realName: '',
              displayName: '',
              balance: 100,
              isAdmin: false
            },
            transaction: t
          }).spread((toBalance, isCreated) => {
            // 取引更新処理
            const pUpdate1 = Balance.update({ balance: fromBalance.balance - amount },
              { where: { userId: userId } },
              { transaction: t });
            const pUpdate2 = pUpdate1.then(() => {
              return Balance.update({ balance: toBalance.balance + amount },
                { where: { userId: toUserId } },
                { transaction: t });
            });
            const pCreateLog = pUpdate2.then(() => {
              // ログ作成処理
              return Deal.create({
                fromUserId: userId,
                toUserId: toUserId,
                amount: amount
              }, { transaction: t });
            });
            return pCreateLog.then(() => {
              msg.send(`<@${userId}>さんから<@${toUserId}>さんへ ${amount} Nコインが送金されました。`);
            });
          });
        }
      })
        .catch(e => {
          robot.logger.error(e);
        });

    }).then((result) => {
      // result is whatever the result of the promise chain returned to the transaction callback
    }).catch((e) => {
      robot.logger.error(e);
    });
  });


  // トップ10コマンド
  robot.hear(/!nc top10/i, (msg) => {
    const user = msg.message.user;
    const userId = user.id;
    Balance.findAll({
      limit: 10,
      where: { isAdmin: false },
      order: [['balance', 'DESC']]
    }).then((balances) => {
      balances.forEach((b, i) => {
        b.rank = i + 1;
      });
      const messages = balances.map((b) => {
        return `第${b.rank}位: <@${b.userId}> ${b.balance}`;
      });
      msg.send('■ 残高ランキングTop10\n' + messages.join(' ,'));
    })
      .catch(e => {
        robot.logger.error(e);
      });
  });

  // トップ100コマンド
  robot.hear(/!nc top100/i, (msg) => {
    const user = msg.message.user;
    const userId = user.id;
    Balance.findAll({
      limit: 100,
      where: { isAdmin: false },
      order: [['balance', 'DESC']]
    }).then((balances) => {
      balances.forEach((b, i) => {
        b.rank = i + 1;
      });
      const messages = balances.map((b) => {
        return `第${b.rank}位: <@${b.userId}> ${b.balance}`;
      });
      msg.send('■ 残高ランキングTop100\n' + messages.join(' ,'));
    })
      .catch(e => {
        robot.logger.error(e);
      });
  });

};