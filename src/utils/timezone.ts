/**
 * Retorna a data/hora atual em UTC-3 (horário de Brasília)
 */
export const getNowInBrasilia = (): Date => {
  const now = new Date();
  // Converter para UTC-3 (Brasília)
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const brasiliaTime = new Date(utc + (3600000 * -3)); // UTC-3
  return brasiliaTime;
};

/**
 * Converte data/hora de jogo (sempre em Brasília) para Date
 */
export const getGameDateTimeInBrasilia = (date: string, time: string): Date => {
  // Assume que date e time já estão em horário de Brasília
  const dateTimeString = `${date}T${time}-03:00`; // Força UTC-3
  return new Date(dateTimeString);
};
