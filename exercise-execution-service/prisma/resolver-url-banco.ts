import * as path from 'node:path';

export function resolverUrlBanco(databaseUrl: string): string {
  if (databaseUrl.startsWith('file:./') || databaseUrl.startsWith('file:../')) {
    const caminho = databaseUrl.replace(/^file:/, '');
    const caminhoAbsoluto = path.resolve(process.cwd(), caminho);
    return `file://${caminhoAbsoluto}`;
  }
  return databaseUrl;
}
