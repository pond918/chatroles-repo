/** copied/changed from https://github.com/lukeed/templite */
// FIXME jexl get first value of the array, e.g.: a.array.length will result undefined
import jexl from '@digifi/jexl';

const RGX = /<[<|?](.*?)[?|>]>/g;
jexl.addUnaryOp('typeof', (v: any) => typeof v);
jexl.addFunction('len', (v: any) => v.length);

/**
 * @returns object if <?exp?>, else string
 */
export const templiteAsync = async <T extends Values>(
  template: string,
  values: T,
) => {
  return replaceAsync(template, RGX, async (match, key) => {
    return key ? await jexl.eval(key, values) : key;
  });
};

/**
 * @returns object if <?exp?>, else string
 */
export const templite = <T extends Values>(
  template: string,
  values: T,
): string | any => {
  const data = [];
  template.replace(RGX, (match, key) => {
    data.push(key ? jexl.evalSync(key, values) : key);
    return match;
  });

  // no toString, return original data
  if (template.startsWith('<?') && template.endsWith('?>') && data.length == 1)
    return data[0];

  return template.replace(RGX, () => {
    const s = data.shift();
    return typeof s === 'string' ? s : JSON.stringify(s);
  });
};

const replaceAsync = async (
  str: string,
  regex: RegExp,
  asyncFn: (match: any, ...args: any) => Promise<any>,
) => {
  const promises: Promise<any>[] = [];
  str.replace(regex, (match, ...args) => {
    promises.push(asyncFn(match, ...args));
    return match;
  });
  const data = await Promise.all(promises);

  // no toString, return original data
  if (str.startsWith('<?') && str.endsWith('?>') && data.length == 1)
    return data[0];

  return str.replace(regex, () => {
    const s = data.shift();
    return typeof s === 'string' ? s : JSON.stringify(s);
  });
};

type Values = Record<string, any> | any[];
