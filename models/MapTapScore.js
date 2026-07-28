module.exports = (sequelize, DataTypes) => {
    return sequelize.define('MapTapScore', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        userId: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        username: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        puzzleDate: {
            type: DataTypes.DATEONLY, // Calendar day of the puzzle (e.g. "July 20")
            allowNull: false,
        },
        roundScores: {
            type: DataTypes.JSON, // e.g. [81, 90, 87, 70, 5]
            allowNull: false,
            defaultValue: [],
        },
        finalScore: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        messageId: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        postedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
    }, {
        indexes: [
            {
                unique: true,
                fields: ['userId', 'puzzleDate'], // One score per user per puzzle
            },
            {
                fields: ['puzzleDate'],
            },
            {
                fields: ['postedAt'],
            },
        ],
    });
};
