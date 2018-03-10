'use strict';
const loader = require('./sequelizeLoader');
const Sequelize = loader.Sequelize;

const Deal = loader.database.define(
  'deals',
  {
    dealId: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    fromUserId: {
      type: Sequelize.STRING,
      allowNull: false
    },
    toUserId: {
      type: Sequelize.STRING,
      allowNull: false
    },
    amount: {
      type: Sequelize.INTEGER,
      allowNull: false
    }
  },
  {
    freezeTableName: false,
    timestamps: true,
    indexes: [
      {
        fields: ['fromUserId']
      },
      {
        fields: ['toUserId']
      },
      {
        fields: ['createdAt']
      }
    ]
  }
);

module.exports = Deal;
