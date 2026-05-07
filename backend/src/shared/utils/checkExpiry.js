export function checkExpiry(date) {
  if (!date) {
    return false;
  }

  const diff = new Date(date).getTime() - Date.now();
  return diff < 7 * 24 * 60 * 60 * 1000;
}
