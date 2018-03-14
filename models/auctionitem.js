'use strict';
const loader = require('./sequelizeLoader');
const Sequelize = loader.Sequelize;

const Auctionitem = loader.database.define(
  'auctionitems',
  {
    auctionitemId: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: Sequelize.STRING,
      allowNull: false
    },
    timeLimit: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    startPrice: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    description: {
      type: Sequelize.STRING,
      allowNull: false
    }
  },
  {
    freezeTableName: false,
    timestamps: true,
    indexes: [
      {
        fields: ['auctionitemId']
      },
      {
        fields: ['timeLimit']
      }
    ]
  }
);

module.exports = Auctionitem;
