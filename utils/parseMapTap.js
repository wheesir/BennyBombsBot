// Parses maptap.gg share text, e.g.:
// www.maptap.gg July 20
// 81🌟 90👑 87🎉 70😂 5😭
// Final score: 570

const HEADER_REGEX = /maptap\.gg\s+([A-Za-z]+)\s+(\d{1,2})/i;
const FINAL_SCORE_REGEX = /Final score:\s*(\d+)/i;
const ROUND_REGEX = /(\d{1,3})\s*\p{Extended_Pictographic}/gu;

/**
 * @param {string} content Message content to parse
 * @param {number} fallbackYear Year to assume for the puzzle date (the share text has no year)
 * @returns {{ puzzleDate: string, roundScores: number[], finalScore: number } | null}
 */
function parseMapTapShare(content, fallbackYear) {
    const headerMatch = content.match(HEADER_REGEX);
    const finalMatch = content.match(FINAL_SCORE_REGEX);
    if (!headerMatch || !finalMatch) return null;

    const [, monthName, dayStr] = headerMatch;
    const parsedDate = new Date(`${monthName} ${dayStr}, ${fallbackYear}`);
    if (isNaN(parsedDate.getTime())) return null;

    const roundScores = [...content.matchAll(ROUND_REGEX)].map(m => parseInt(m[1], 10));
    const finalScore = parseInt(finalMatch[1], 10);

    // puzzleDate as YYYY-MM-DD (local), matching Sequelize DATEONLY expectations
    const puzzleDate = [
        parsedDate.getFullYear(),
        String(parsedDate.getMonth() + 1).padStart(2, '0'),
        String(parsedDate.getDate()).padStart(2, '0'),
    ].join('-');

    return { puzzleDate, roundScores, finalScore };
}

module.exports = { parseMapTapShare };
