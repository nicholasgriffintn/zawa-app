const TIME_OFFSET_CURSOR_PATTERN = /^-?\d+$/;

export function isValidBoardCursor(cursor: string): boolean {
  return (
    TIME_OFFSET_CURSOR_PATTERN.test(cursor) ||
    (cursor.includes("|") && cursor.indexOf("|") < cursor.length - 1)
  );
}
