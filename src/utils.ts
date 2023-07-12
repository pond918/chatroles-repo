import { jsonrepair } from 'jsonrepair';

export const toJSON = (str: string, isArray = false) => {
  if (!str) return undefined;
  if (str.trim().toLowerCase() == 'null') return null;

  let idx = str.indexOf(isArray ? '[' : '{');
  if (idx > 0) str = str.substring(idx);
  idx = str.lastIndexOf(isArray ? ']' : '}');
  if (idx > 0) str = str.substring(0, idx + 1);

  str = jsonrepair(str);
  return JSON.parse(str);
};
