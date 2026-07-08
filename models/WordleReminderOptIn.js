module.exports = (sequelize, DataTypes) => {
    return sequelize.define('WordleReminderOptIn', {
        userId: {
            type: DataTypes.STRING,
            primaryKey: true,
            allowNull: false,
        },
        username: {
            type: DataTypes.STRING,
            allowNull: false,
        },
    });
};
