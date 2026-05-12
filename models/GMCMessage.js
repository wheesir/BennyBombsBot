module.exports = (sequelize, DataTypes) => {
	return sequelize.define('GMCMessage', {
    date: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      },
    emojis: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  });
};