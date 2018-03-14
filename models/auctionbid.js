'use strict';
const loader = require('./sequelizeLoader');
const Sequelize = loader.Sequelize;

const Auctionbid = loader.database.define(
  'auctionbids',
  {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    auctionitemId: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    userId: {
      type: Sequelize.STRING,
      allowNull: false
    },
    bidAmount: {
      type: Sequelize.INTEGER,
      allowNull: false
    }
  },
  {
    freezeTableName: false,
    timestamps: true,
    indexes: [
      {
        fields: ['id']
      },
      {
        fields: ['auctionitemId']
      }
    ]
  }
);

module.exports = Auctionbid;
