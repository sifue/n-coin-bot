'use strict';
const loader = require('./sequelizeLoader');
const Sequelize = loader.Sequelize;

const Balance = loader.database.define(
  'balances',
  {
    userId: {
      type: Sequelize.STRING,
      primaryKey: true,
      allowNull: false
    },
    name: {
      type: Sequelize.STRING,
      allowNull: true
    },
    realName: {
      type: Sequelize.STRING,
      allowNull: true
    },
    displayName: {
      type: Sequelize.STRING,
      allowNull: true
    },
    balance: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 100
    },
    isAdmin: {
      type: Sequelize.BOOLEAN,
      allowNull: false
    }
  },
  {
    freezeTableName: false,
    timestamps: true,
    indexes: [
      {
        fields: ['balance']
      },
      {
        fields: ['isAdmin']
      }
    ]
  }
);

module.exports = Balance;
