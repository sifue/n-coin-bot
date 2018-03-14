'use strict';

const Balance = require('../models/balance');
const Deal = require('../models/deal');
const AuctionItem = require('../models/auctionitem');
const AuctionBid = require('../models/auctionbid');
const loader = require('../models/sequelizeLoader');
const moment = require('moment');
const cron = require('node-cron');
const Sequelize = loader.Sequelize;
const sequelize = loader.database;
const dateFormat = 'YYYY-MM-DD HH:mm:ss';
const balanceDefaultValue = Balance.balanceDefaultValue;
const sendCoin = require('../models/sendCoin');

Balance.sync();
Deal.sync();
AuctionItem.sync();
AuctionBid.sync();
const maxPrice = 100000;
const auctionChannelId = 'C84P7122E';
const auctionItemMsgFormat =
  '[<id>] *<description>*\n出品者: <@<userId>>\n出品時刻: *<date>*\n入札受付期間: *残り<timeLimit>日*\nスタート価格: *<startPrice>N*';
const auctionBidLogMsgFormat =
  '　[<date>] <userName> が *<bidAmount>N* コインで入札';

module.exports = robot => {
  //毎時に商品の残り時間を更新
  cron.schedule(`0 0 * * * *`, () => {
    AuctionItem.findAll().then(auctionItems => {
      if (auctionItems.length) {
        auctionItems.forEach(auctionItem => {
          const createdAt = auctionItem.dataValues.createdAt;
          if (moment(createdAt).hours() === moment().hour()) {
            const timeLimit = auctionItem.dataValues.timeLimit;
            const auctionitemId = auctionItem.dataValues.id;
            const description = auctionItem.dataValues.description;
            const userId = auctionItem.dataValues.userId;
            //入札受付期間満了
            if (timeLimit <= 1) {
              AuctionBid.findAll({
                where: { auctionitemId: auctionitemId },
                order: [['bidAmount', 'DESC']]
              })
                .then(auctionBids => {
                  if (auctionBids.length) {
                    //入札者が居た場合
                    const finishPrice = auctionBids[0].dataValues.bidAmount;
                    const auctionWinnerId = auctionBids[0].dataValues.userId;
                    let bidLog = auctionBids
                      .map(m => {
                        const date = m.dataValues.createdAt;
                        const formatedDate = moment(date).format(dateFormat);
                        const bidAmount = m.dataValues.bidAmount;
                        const userId = m.dataValues.userId;
                        return auctionBidLogMsgFormat
                          .replace('<date>', formatedDate)
                          .replace('<userName>', `<@${userId}>`)
                          .replace('<bidAmount>', bidAmount);
                      })
                      .join('\n');

                    //オークションチャンネル
                    robot.messageRoom(
                      auctionChannelId,
                      `[${auctionitemId}] *${description}* を <@${auctionWinnerId}> が *${finishPrice}N* コインで落札しました！:tada:`
                    );

                    //出品者DM
                    robot.messageRoom(
                      userId,
                      `オークションに出品していた [${auctionitemId}] *${description}* の入札期限日になりました。\n結果: <@${auctionWinnerId}> が *${finishPrice}N* コインで落札しました！\n落札者と連絡を取りましょう、落札者と連絡が取れない場合は、入札履歴を確認して落札者を繰り上げましょう。\n入札履歴:\n${bidLog}`
                    );

                    //落札者DM
                    robot.messageRoom(
                      auctionWinnerId,
                      `[${auctionitemId}] *${description}* をあなたが *${finishPrice}N* コインで落札しました！:tada:\n出品者と連絡を取りましょう。`
                    );
                  } else {
                    //入札者無し 出品者DM
                    robot.messageRoom(
                      userId,
                      `オークションに出品していた [${auctionitemId}] *${description}* の入札期限日になりましたが、入札者は0人でした...:cry:。またのご利用をお待ちしております。`
                    );
                  }
                  return AuctionItem.destroy({ where: { id: auctionitemId } });
                })
                .then(auctionItem => {
                  //オークションアイテム削除時
                })
                .catch(e => {
                  robot.logger.error(e);
                });
            } else {
              AuctionItem.update(
                {
                  timeLimit: timeLimit - 1
                },
                {
                  where: { id: auctionitemId }
                }
              ).catch(e => {
                robot.logger.error(e);
              });
            }
          }
        });
      }
    });
  });

  //対象商品の詳細確認
  robot.hear(/!nc auction (\d+)/i, msg => {
    const parsed = msg.message.rawText.match(/!nc auction (\d+)$/);

    if (!parsed) {
      msg.send(
        '商品確認コマンドの形式が `!nc auction {オークションID}` ではありません。'
      );
    } else {
      const auctionitemId = parseInt(parsed[1]);
      let message = '';
      AuctionItem.find({
        where: { id: auctionitemId }
      })
        .then(auctionItem => {
          if (auctionItem) {
            message +=
              auctionItemMsgFormat
                .replace('<description>', auctionItem.dataValues.description)
                .replace('<userId>', auctionItem.dataValues.userId)
                .replace('<startPrice>', auctionItem.dataValues.startPrice)
                .replace('<timeLimit>', auctionItem.dataValues.timeLimit)
                .replace('<id>', auctionItem.dataValues.id)
                .replace(
                  '<date>',
                  moment(auctionItem.dataValues.createdAt).format(dateFormat)
                ) + '\n';
            return AuctionBid.findAll({
              limit: 10,
              where: { auctionitemId: auctionitemId },
              order: [['createdAt', 'DESC']]
            });
          } else {
            throw 'auction item not found';
          }
        })
        .then(auctionBids => {
          if (auctionBids.length) {
            const bidcount = auctionBids.length;
            message += `現在価格: *${auctionBids[0].dataValues.bidAmount}N*\n`;
            message += `入札履歴: (最新 -*${auctionBids.length}件*-)\n`;
            message += auctionBids
              .map(m => {
                const user = robot.brain.data.users[m.dataValues.userId];
                let userName = user.slack.profile.display_name
                  ? user.slack.profile.display_name
                  : user.slack.profile.real_name;
                //通知が飛ぶのを防ぐ為にユーザー名に「.」をインサート
                const insertIndex = userName.length - 1;
                userName =
                  userName.slice(0, insertIndex) +
                  '.' +
                  userName.slice(insertIndex);
                const date = m.dataValues.createdAt;
                const formatedDate = moment(date).format(dateFormat);
                return `　[${formatedDate}] ${userName} が *${
                  m.dataValues.bidAmount
                }N* コインで入札`;
              })
              .join('\n');
          } else {
            message += '入札数: *0*';
          }
          msg.send(message);
        })
        .catch(e => {
          switch (e) {
            case 'auction item not found':
              msg.send('対象商品が見つかりません。');
              break;
            default:
              robot.logger.error(e);
              break;
          }
        });
    }
  });

  // オークション出品状況確認コマンド
  robot.hear(/!nc auction$/i, msg => {
    //全商品検索
    AuctionItem.findAll({
      limit: 100,
      order: [['timeLimit', 'ASC']]
    })
      .then(auctionItems => {
        if (auctionItems) {
          let message = `■ オークション情報一覧 (残り時間が短い順 -*${
            auctionItems.length
          }件*-)\n`;
          message += auctionItems
            .map(auctionItem => {
              return (
                auctionItemMsgFormat
                  .replace('<description>', auctionItem.dataValues.description)
                  .replace('<userId>', auctionItem.dataValues.userId)
                  .replace('<startPrice>', auctionItem.dataValues.startPrice)
                  .replace('<timeLimit>', auctionItem.dataValues.timeLimit)
                  .replace('<id>', auctionItem.dataValues.id)
                  .replace(
                    '<date>',
                    moment(auctionItem.dataValues.createdAt).format(dateFormat)
                  ) + '\n'
              );
            })
            .join('\n\n');
          msg.send(message);
        } else {
          msg.send('現在オークションに出品されている商品はありません。');
        }
      })
      .catch(e => {
        robot.logger.error(e);
      });
  });

  // オークション出品コマンド
  robot.hear(/!nc auction add/i, msg => {
    const parsed = msg.message.rawText.match(
      /^!nc auction add (.+) (\d+) (\d+)$/
    );
    if (!parsed) {
      msg.send(
        'オークション出品コマンドの形式が `!nc auction add {商品説明} {初期価格(1以上)} {入札受付期間(30日以下)}` ではありません。'
      );
    } else {
      const userId = msg.message.user.id;
      const description = parsed[1];
      const startPrice = parseInt(parsed[2]);
      const timeLimit = parseInt(parsed[3]);
      createAuctionItem(robot, msg, userId, timeLimit, startPrice, description);
    }
  });

  // 入札
  robot.hear(/!nc auction bid/i, msg => {
    const parsed = msg.message.rawText.match(/^!nc auction bid (\d+) (\d+)$/);
    if (!parsed) {
      msg.send(
        '入札コマンドの形式が `!nc auction bid {オークションID} {入札額}` ではありません。'
      );
      return;
    }
    const userId = msg.message.user.id;
    const id = parseInt(parsed[1]);
    const bidAmount = parseInt(parsed[2]);
    bidAuctionItem(robot, msg, id, userId, bidAmount);
  });

  //オークション商品削除コマンド
  robot.hear(/!nc auction delete/i, msg => {
    const parsed = msg.message.rawText.match(/^!nc auction delete (\d+)$/);
    if (!parsed) {
      msg.send(
        `オークション商品削除コマンドの形式が``!nc auction delete {オークションID} ではありません。```
      );
    }
    const userId = msg.message.user.id;
    const id = parseInt(parsed[1]);
    AuctionItem.destroy({
      where: {
        id: id,
        userId: userId
      }
    }).then(auctionItem => {
      if (auctionItem) {
        msg.send(`オークションID [ *${id}* ] の商品を削除しました。`);
      }
    });
  });
};

//出品
function createAuctionItem(
  robot,
  msg,
  userId,
  timeLimit,
  startPrice,
  description
) {
  if (startPrice >= maxPrice) {
    msg.send(`*${maxPrice}N* コイン以上のものは扱えません。`);
    return;
  }

  if (startPrice < 1) {
    msg.send('*1N* コインより小さいものは扱えません。');
    return;
  }

  if (timeLimit > 30 || timeLimit < 1) {
    msg.send('入札受付期間が *1~30日* 以内で無いと扱えません。');
    return;
  }

  AuctionItem.create({
    userId,
    timeLimit,
    startPrice,
    description
  }).then(auctionItem => {
    let message = '*オークションに出品されました*\n';
    message +=
      auctionItemMsgFormat
        .replace('<description>', description)
        .replace('<userId>', userId)
        .replace('<startPrice>', startPrice)
        .replace('<timeLimit>', timeLimit)
        .replace('<id>', auctionItem.dataValues.id)
        .replace(
          '<date>',
          moment(auctionItem.dataValues.createdAt).format(dateFormat)
        ) + '\n';
    robot.messageRoom(auctionChannelId, message);
  });
}

//入札
function bidAuctionItem(robot, msg, auctionitemId, userId, bidAmount) {
  if (bidAmount >= maxPrice) {
    msg.send(`*${maxPrice}N* コイン以上は扱えません。`);
    return;
  }

  if (bidAmount < 1) {
    msg.send('*1N* コインより小さいものは扱えません。');
    return;
  }

  let description;
  let elapsedDay;
  let timeLimit;
  AuctionItem.find({ where: { id: auctionitemId } })
    .then(auctionItem => {
      if (auctionItem) {
        elapsedDay =
          moment().day() - moment(auctionItem.dataValues.createdAt).day();
        timeLimit = auctionItem.dataValues.timeLimit;
        description = auctionItem.dataValues.description;
        if (auctionItem.dataValues.userId === userId) {
          throw 'seller and bidder are same';
        }
        return AuctionBid.find({
          where: { auctionitemId: auctionitemId },
          order: [['bidAmount', 'DESC']]
        });
      } else {
        throw 'auction item not found';
      }
    })
    .then(lastBid => {
      if (lastBid) {
        const lastBidAmount = lastBid.dataValues.bidAmount;
        if (lastBidAmount >= bidAmount) {
          throw 'invalid bid amount';
        }
      }
      return AuctionBid.create({ auctionitemId, userId, bidAmount });
    })
    .then(auctionBid => {
      if (auctionBid) {
        robot.messageRoom(
          auctionChannelId,
          `<@${userId}>さんが [${auctionitemId}] *${description}* に *${bidAmount}N* コインで入札しました`
        );
      }
    })
    .catch(e => {
      switch (e) {
        case 'invalid bid amount':
          msg.send(`現在価格より上の額でないと入札は出来ません。`);
          break;
        case 'auction item not found':
          msg.send('該当商品が見つかりません。');
          break;
        case 'seller and bidder are same':
          msg.send('出品者本人が入札する事は出来ません。');
          break;
        default:
          msg.send(`入札に失敗しました。`);
          robot.logger.error(e);
          break;
      }
    });
}
