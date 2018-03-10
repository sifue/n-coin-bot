'use strict';
const loader = require('./sequelizeLoader');
const Sequerlize = loader.Sequelize;

const Gambler = loader.database.define(
    'gamblers',
    {
      userId: {
        type: Sequerlize.STRING,
        primaryKey: true,
        allowNull: false
      },
      isBet: {
        type: Sequerlize.BOOLEAN,
        allowNull: false
      }
    });

module.exports = Lottery;
