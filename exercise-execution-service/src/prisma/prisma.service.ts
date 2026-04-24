import * as path from 'node:path';
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

/**
 * Resolve a URL de banco de dados para o formato absoluto exigido pelo @libsql/client.
 * O libsql não aceita caminhos relativos como "file:./dev.db".
 */
function resolverUrlBanco(databaseUrl: string): string {
  if (databaseUrl.startsWith('file:./') || databaseUrl.startsWith('file:../')) {
    const caminho = databaseUrl.replace(/^file:/, '');
    const caminhoAbsoluto = path.resolve(process.cwd(), caminho);
    return `file://${caminhoAbsoluto}`;
  }
  return databaseUrl;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const urlBanco = resolverUrlBanco(
      process.env.DATABASE_URL ?? 'file:./prisma/dev.db',
    );
    const adapter = new PrismaLibSql({ url: urlBanco });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
