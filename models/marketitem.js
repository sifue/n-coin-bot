'use strict';
const loader = require('./sequelizeLoader');
const Sequelize = loader.Sequelize;

const Marketitem = loader.database.define(
  'marketitems',
  {
    marketitemId: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: Sequelize.STRING,
      allowNull: false
    },
    dataType: {
      type: Sequelize.STRING,
      allowNull: false
    },
    price: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    text: {
      type: Sequelize.STRING,
      allowNull: false
    }
  },
  {
    freezeTableName: false,
    timestamps: true,
    indexes: [
      {
        fields: ['userId']
      }
    ]
  }
);

module.exports = Marketitem;
