import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

const mockPrisma = {
  user: { findUnique: jest.fn(), create: jest.fn() },
};
const mockJwt = { sign: jest.fn().mockReturnValue('mock.jwt.token') };
const mockConfig = {
  get: jest.fn((key: string) => ({ BCRYPT_ROUNDS: 10, JWT_EXPIRES_IN: '24h' }[key])),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('returns user without password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 1, email: 'a@b.com', name: 'A', createdAt: new Date(),
      });
      const result = await service.register({ email: 'a@b.com', password: 'senha123', name: 'A' });
      expect(result).toHaveProperty('id');
      expect(result).not.toHaveProperty('password');
    });

    it('throws ConflictException when email exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 1 });
      await expect(service.register({ email: 'a@b.com', password: 'senha123', name: 'A' }))
        .rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('returns token and user on valid credentials', async () => {
      const hash = await bcrypt.hash('senha123', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1, email: 'a@b.com', password: hash, name: 'A', createdAt: new Date(),
      });
      const result = await service.login({ email: 'a@b.com', password: 'senha123' });
      expect(result).toHaveProperty('token');
      expect(result.user).not.toHaveProperty('password');
    });

    it('throws UnauthorizedException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login({ email: 'x@x.com', password: 'wrong' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException on wrong password', async () => {
      const hash = await bcrypt.hash('correct', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1, email: 'a@b.com', password: hash, name: 'A', createdAt: new Date(),
      });
      await expect(service.login({ email: 'a@b.com', password: 'wrong' }))
        .rejects.toThrow(UnauthorizedException);
    });
  });
});
