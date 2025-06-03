export function escapeMarkdown(text = '') {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, (match) => `\\${match}`);
}

export function shuffleArray(array) {
  return [...array].sort(() => Math.random() - 0.5);
}
