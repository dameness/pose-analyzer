import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

const mockPrisma = { user: { findUnique: jest.fn() } };

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  it('returns user without password', async () => {
    const user = { id: 1, email: 'a@b.com', name: 'A', createdAt: new Date() };
    mockPrisma.user.findUnique.mockResolvedValue(user);
    const result = await service.getMe(1);
    expect(result).toEqual(user);
    expect(result).not.toHaveProperty('password');
  });

  it('throws NotFoundException when user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(service.getMe(999)).rejects.toThrow(NotFoundException);
  });
});
