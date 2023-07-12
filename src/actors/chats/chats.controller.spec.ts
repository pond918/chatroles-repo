import { Test, TestingModule } from '@nestjs/testing';
import { ChatsService } from './chats.service';
import { ChatsController } from './chats.controller';

class ChatsServiceMock {
  chatEntry = jest.fn();
}

describe('ChatsController', () => {
  let service: ChatsController;
  let chatsService: ChatsServiceMock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatsController],
      providers: [
        {
          provide: ChatsService,
          useClass: ChatsServiceMock,
        },
      ],
    }).compile();

    service = module.get(ChatsController);
    chatsService = module.get(ChatsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('chatNoCtx', () => {
    it('should', () => {});
  });

  describe('chat', () => {
    it('should', () => {});
  });

  describe('chatEntryNoCtx', () => {
    it('should', () => {});
  });

  describe('chatEntry', () => {
    it('should', () => {});
  });
});
