// This file patches PrismaClient to work without explicit adapter argument
// by auto-constructing the libsql adapter from DATABASE_URL.
// It is required before seed.ts runs so that `new PrismaClient()` works in Prisma 7.
const path = require('path');
const Module = require('module');

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  const result = originalLoad.apply(this, arguments);
  if (request === '@prisma/client' || request.endsWith('/@prisma/client')) {
    const { PrismaLibSql } = require('@prisma/adapter-libsql');
    const OriginalPrismaClient = result.PrismaClient;

    function resolveUrl(databaseUrl) {
      if (
        databaseUrl.startsWith('file:./') ||
        databaseUrl.startsWith('file:../')
      ) {
        const rel = databaseUrl.replace(/^file:/, '');
        const abs = path.resolve(process.cwd(), rel);
        return 'file://' + abs;
      }
      return databaseUrl;
    }

    class PatchedPrismaClient extends OriginalPrismaClient {
      constructor(opts) {
        if (!opts) {
          const url = resolveUrl(
            process.env.DATABASE_URL ?? 'file:./prisma/dev.db',
          );
          const adapter = new PrismaLibSql({ url });
          super({ adapter });
        } else {
          super(opts);
        }
      }
    }

    result.PrismaClient = PatchedPrismaClient;
  }
  return result;
};
