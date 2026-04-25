import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { resolverUrlBanco } from '../../prisma/resolver-url-banco';

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
