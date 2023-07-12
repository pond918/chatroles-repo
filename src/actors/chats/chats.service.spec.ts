import { Test, TestingModule } from '@nestjs/testing';
import { HostsService } from '../../hosts/hosts.service';
import { ScopedStorageMan } from '../../infras/repos/scoped-storage.service';
import { ChatsService } from './chats.service';

class ScopedStorageManMock {
  createScope = jest.fn();
  getScope = jest.fn();
  destroyScope = jest.fn();
}

class HostsServiceMock {
  getMemberActor = jest.fn();
  create = jest.fn();
  update = jest.fn();
  findOne = jest.fn();
  findNewestByRoleId = jest.fn();
  remove = jest.fn();
  onMemberEntry = jest.fn();
  onEntry = jest.fn();
}

describe('ChatsService', () => {
  let service: ChatsService;
  let scopedStorageMan: ScopedStorageManMock;
  let hostsService: HostsServiceMock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatsService],
      providers: [
        {
          provide: ScopedStorageMan,
          useClass: ScopedStorageManMock,
        },
        {
          provide: HostsService,
          useClass: HostsServiceMock,
        },
      ],
    }).compile();

    service = module.get(ChatsService);
    scopedStorageMan = module.get(ScopedStorageMan);
    hostsService = module.get(HostsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('chatEntry', () => {
    it('should', () => {});
  });
});
