'use strict';

const Balance = require('../models/balance');
const Deal = require('../models/deal');
const Gambler = require('../models/gambler');
const loader = require('../models/sequelizeLoader');
const Sequelize = loader.Sequelize;
const sequelize = loader.database;
const balanceDefaultValue = Balance.balanceDefaultValue;
const moment = require('moment');
const dateFormat = 'YYYY-MM-DD HH:mm:ss';
const sendCoin = require('../models/sendCoin');

Balance.sync();
Deal.sync();

module.exports = robot => {
  // ヘルプ表示
  robot.hear(/^!nc help/i, msg => {
    msg.send(
      '■ Nコインとは\n' +
        'Nコインとは生徒全員が最初から100枚持っている学内仮想通貨です。' +
        '管理者はプログラミング講師となっています。' +
        'N高等学校の組織に対して良い行動をするとNコインがもらえます。' +
        '他の生徒への良いはたらきかけで1、' +
        '学習参加や、やってること自慢で10、' +
        '教え合いで30、' +
        '学外にも影響がある大きな成果で100以上がもらえます。' +
        'なお金銭との交換はできませんが、' +
        '生徒間で送金することができるほか、' +
        '学内ランキングを確認できます。' +
        'Nコインボットのチャンネルの目的と異なる場所への招待、取引を目的としたマルチポストを禁じます。' +
        'なお金銭との交換が発覚した場合、システムを停止する場合があります。\n' +
        '■ コマンド一覧\n' +
        '`!nc mybalance` で自身の残高とランキングの確認\n' +
        '`!nc balance {@ユーザー名}` でユーザーの残高確認\n' +
        '`!nc send {@ユーザー名} {送金額(正の整数)}` でユーザーに送金\n' +
        '`!nc top10` 残高ランキングトップ10を確認 (DMでの利用推奨)\n' +
        '`!nc top100` 残高ランキングトップ100を確認 (DMでの利用推奨)\n' +
        '`!nc deallog {表示件数(1000未満)}` 自分の取引履歴を確認 (DMでの利用推奨)\n' +
        '`!nc markethelp` マーケットボードの使い方の表示\n' +
        '`!nc auctionhelp` オークション機能の使い方の表示\n' +
        '`!nc couple {@ユーザー名}` *1N* コインで今日の相手との相性を占う\n' +
        '`!nc janken {グー or チョキ or パー} {ベッド額(正の整数)}` Nコインをかけてボットとジャンケン\n' +
        'リアクション `:nc+1:` を付けることで 1 Nコインを相手に送金'
    );
  });

  //送金スタンプを押すと送金
  robot.react(msg => {
    if (msg.message.type === 'added' && msg.message.reaction === 'nc+1') {
      const fromUser = msg.message.user;
      const toUserId = msg.message.item_user.id;
      sendCoin(robot, msg, fromUser, toUserId, 1);
    }
  });

  // 自身の残高確認コマンド
  robot.hear(/!nc mybalance/i, msg => {
    const user = msg.message.user;
    const userId = user.id;
    Balance.findOrCreate({
      where: { userId: userId },
      defaults: {
        userId: userId,
        name: user.name,
        realName: user.real_name,
        displayName: user.profile.display_name,
        balance: balanceDefaultValue,
        isAdmin: false
      }
    })
      .spread((balance, isCreated) => {
        if (balance.isAdmin) {
          msg.send(
            `<@${userId}>さんの残高は *${
              balance.balance
            }N* コインです。また管理者に設定されています。`
          );
        } else {
          Balance.findAll({
            where: { isAdmin: false },
            order: [['balance', 'DESC'], ['userId', 'ASC']]
          })
            .then(balances => {
              let rankMessage = 'またランキング順位は未定です。';
              balances.forEach((b, i) => {
                if (b.userId === userId) {
                  rankMessage =
                    'またランキング順位は *第' + (i + 1) + '位* です。';
                }
              });
              msg.send(
                `<@${userId}>さんの残高は *${balance.balance}N* コインです。` +
                  rankMessage
              );
            })
            .catch(e => {
              robot.logger.error(e);
            });
        }
        // 名前をアップデートしておく
        Balance.update(
          {
            name: user.name,
            realName: user.real_name,
            displayName: user.profile.display_name
          },
          { where: { userId: userId } }
        );
      })
      .catch(e => {
        robot.logger.error(e);
      });
  });

  // ユーザーの残高確認コマンド
  robot.hear(/!nc balance/i, msg => {
    const parsed = msg.message.rawText.match(/^!nc balance <@(.+)>\s*$/);
    const userId = parsed[1];

    if (!userId) {
      msg.send(
        '`!nc balance {@ユーザー名}` のように@と一緒にユーザー名を入力する必要があります。'
      );
    } else {
      Balance.findOrCreate({
        where: { userId: userId },
        defaults: {
          userId: userId,
          name: '',
          realName: '',
          displayName: '',
          balance: balanceDefaultValue,
          isAdmin: false
        }
      })
        .spread((balance, isCreated) => {
          if (balance.isAdmin) {
            msg.send(
              `<@${userId}>さんの残高は *${
                balance.balance
              }N* コインです。また<@${userId}>さんは管理者です。`
            );
          } else {
            msg.send(
              `<@${userId}>さんの残高は *${balance.balance}N* コインです。`
            );
          }
        })
        .catch(e => {
          robot.logger.error(e);
        });
    }
  });

  // 送金コマンド
  robot.hear(/!nc send/i, msg => {
    const parsed = msg.message.rawText.match(/^!nc send <@(.+)> (\d+)\s*$/);
    if (!parsed) {
      msg.send(
        '送金コマンドの形式が `!nc send {@ユーザー名} {送金額(正の整数)}` ではありません。'
      );
      return;
    }
    const toUserId = parsed[1];
    const amount = parseInt(parsed[2]);
    sendCoin(robot, msg, msg.message.user, toUserId, amount);
  });

  //取引履歴を照会 !nc deallog {表示数(1~100)}
  robot.hear(/!nc deallog/i, msg => {
    const user = msg.message.user;
    const userId = user.id;
    const parsed = msg.message.rawText.match(/^!nc deallog \d{1,3}\s*$/);

    if (!parsed) {
      msg.send(
        '照会コマンドの形式が `!nc deallog {表示数(1000未満)}` ではありません。'
      );
      return;
    }

    let showCount = parseInt(msg.message.text.split(' ')[2]);
    let log = '';

    Deal.findAll({
      limit: showCount,
      where: { fromUserId: userId },
      order: '"createdAt" DESC'
    })
      .then(deals => {
        let to;
        let date;
        let amount;
        let formatedDate;
        log += `*出金 - ${deals.length}件 -*\n`;
        deals.forEach(deal => {
          to = deal.dataValues.toUserId;
          date = deal.dataValues.createdAt;
          amount = deal.dataValues.amount;
          formatedDate = moment(date).format(dateFormat);
          log += `    [${formatedDate}] <@${to}>さんへ *${amount}N* コインを送金しました。\n`;
        });
        return Deal.findAll({
          limit: showCount,
          where: { toUserId: userId },
          order: '"createdAt" DESC'
        });
      })
      .then(deals => {
        let from;
        let amount;
        let date;
        let formatedDate;
        log += `\n*入金 - ${deals.length}件 -*\n`;
        deals.forEach(deal => {
          from = deal.dataValues.fromUserId;
          amount = deal.dataValues.amount;
          date = deal.dataValues.createdAt;
          formatedDate = moment(date).format(dateFormat);
          log += `    [${formatedDate}] <@${from}>さんから *${amount}N* コインを受け取りました。\n`;
        });
        msg.send(log);
      })
      .catch(e => {
        robot.logger.error(e);
      });
  });

  // トップ10コマンド
  robot.hear(/!nc top10$/i, msg => {
    const user = msg.message.user;
    const userId = user.id;
    Balance.findAll({
      limit: 10,
      where: { isAdmin: false },
      order: [['balance', 'DESC'], ['userId', 'ASC']]
    })
      .then(balances => {
        balances.forEach((b, i) => {
          b.rank = i + 1;
        });
        const messages = balances.map(b => {
          const rankingUser = robot.brain.data.users[b.userId];
          let rankingUserName = rankingUser.slack.profile.display_name
            ? rankingUser.slack.profile.display_name
            : rankingUser.slack.profile.real_name;
          const insertIndex = rankingUserName.length - 1;
          rankingUserName =
            rankingUserName.slice(0, insertIndex) +
            '.' +
            rankingUserName.slice(insertIndex);
          return `第${b.rank}位 : ${rankingUserName} *${b.balance}*`;
        });
        msg.send('■ 残高ランキングTop10\n' + messages.join(' , '));
      })
      .catch(e => {
        robot.logger.error(e);
      });
  });

  // トップ100コマンド
  robot.hear(/!nc top100$/i, msg => {
    const user = msg.message.user;
    const userId = user.id;
    Balance.findAll({
      limit: 100,
      where: { isAdmin: false },
      order: [['balance', 'DESC'], ['userId', 'ASC']]
    })
      .then(balances => {
        balances.forEach((b, i) => {
          b.rank = i + 1;
        });
        const messages = balances.map(b => {
          const rankingUser = robot.brain.data.users[b.userId];
          let rankingUserName = rankingUser.slack.profile.display_name
            ? rankingUser.slack.profile.display_name
            : rankingUser.slack.profile.real_name;
          const insertIndex = rankingUserName.length - 1;
          rankingUserName =
            rankingUserName.slice(0, insertIndex) +
            '.' +
            rankingUserName.slice(insertIndex);
          return `第${b.rank}位 : ${rankingUserName} *${b.balance}*`;
        });
        msg.send('■ 残高ランキングTop100\n' + messages.join(' , '));
      })
      .catch(e => {
        robot.logger.error(e);
      });
  });
};

// その他、直接コインの機能に関係のない機能
// 宝くじ
let deposit = 0;
robot.hear(/!nc lottery/, (msg) => {
  msg.send('*Ｎコイン宝くじ*\n' +
           '賭け金 : 10NC\n' +
           '当選金は全員の賭け金から支払われます\n' +
           '  一等 : 70%\n' +
           '  二等 : 20%\n' +
           '  三等 : 10%\n' +
           '抽選日 : 毎週日曜日 １２：００\n' +
           '※注意事項※' +
           '宝くじ購入者が５人に満たない場合は抽選が行われません（返金されます）\n' +
           '当落を問わず損失が出る可能性があります。また損失について開発者を含め誰も責任を負いません（最重要）\n' +
           '購入後取り消すことはできません' +
           '購入方法 : ```!nc lottery bet```');
});
robot.hear(/!nc lottery now/, (msg) => {
  msg.send('*Ｎコイン宝くじ　現在の状況*\n' +
           `賭け金合計 : ${deposit}\n`);
})
robot.hear(/!nc lottery bet/, (msg) => {
  const user = msg.messages.user;
  const userId = user.id;
  Gambler.findOrCreate({
           where: {userId: userId},
           defaults: {
             userId: userId,
             isBet: false
           }
         })
      .spread((gambler, isCreatedGambler) => {
        if (gambler.isBet) {
          msg.send(`${userId}さんは既に今週の宝くじを購入しているのでこれ以上買うことはできません。\n`);
        } else {
          Balance.findOrCreate({
                   where: {userId: userId},
                   defaults: {
                     userId: userId,
                     name: user.name,
                     realName: user.real_name,
                     displayName: user.profile.display_name,
                     balance: balanceDefaultValue,
                     isAdmin: false
                   }
                 })
              .spread((balance, isCreated) => {
                if (balance.balance < 10) {
                  msg.send(`${userId}さんの残高が10NCに満たないので購入できませんでした。\n`);
                } else {
                  sequelize.transaction((t) => {
                    const newBalanceValue = balance.balance - 10;
                    const update = Balance.update(
                        {balance: newBalanceValue},
                        {where: {userId: userId}},
                        {transaction: t});
                    const addDeposit = update.then(() => {
                      deposit += 10;
                    });
                    return addDeposit.then(() => {
                      msg.send(`Ｎコイン宝くじ、ご購入ありがとうございます！` +
                               `代金として 10NC 頂いたので、${userId}さんの残高は ${balance.balance} Ｎコインになりました。`);
                    });
                  });
                }
              })
              .catch((e) => {
                robot.logger.error(e);
              });
        }
      })
});
