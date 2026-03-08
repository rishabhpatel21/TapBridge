export const createId = () => {
  const rand = Math.random().toString(36).slice(2, 8);
  const time = Date.now().toString(36);
  return `${time}-${rand}`;
};
