import { PrismaTestingHelper } from '@chax-at/transactional-prisma-testing';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from 'nestjs-prisma';
import * as pactum from 'pactum';
import { LogLevel } from 'pactum/src/exports/settings';
import { AppModule } from '../../src/app.module';
import { bootstrapForTest } from '../../src/bootstrap';
import { mainPrismaServiceOptions } from '../../src/infras/repos/repos.module';

export let testApp: NestFastifyApplication;
let moduleFixture: TestingModule;
// Cache for the PrismaTestingHelper. Only one PrismaTestingHelper should be instantiated per test runner (i.e. only one if your tests run sequentially).
let prismaTestingHelper: PrismaTestingHelper<PrismaService> | undefined;
// Saves the PrismaService that will be used during test cases. Will always execute queries on the currently active transaction.
export let prismaServiceForTest: PrismaService;
let originalPrismaService: PrismaService;

// loglevel=3 npm run test:e2e -- --watch --testPathPattern chats -t 'chat to an actor member'
const log_level = parseInt(process.env.loglevel) || 0;
const log_levels = [
  'SILENT',
  'ERROR',
  'WARN',
  'INFO',
  'DEBUG',
  'TRACE',
  'VERBOSE',
];
const log_name = log_levels[log_level > 6 ? 6 : log_level] as LogLevel;
// console.log('LOG LEVEL:', log_name);

/** init functional as repos.modules */
const initOriginalPrismaService = () => {
  let log;
  switch (log_level) {
    case 0:
      log = [];
      break;
    case 1:
      log = ['error'];
      break;
    case 2:
      log = ['warn'];
      break;
    case 3:
      log = ['info'];
      break;
    default:
      log = [
        {
          emit: 'event',
          level: 'query',
        },
        'info',
      ];
  }
  // create as same as prod, from mainPrismaServiceOptions
  originalPrismaService = new PrismaService({
    ...mainPrismaServiceOptions,
    prismaOptions: { log },
  });
  originalPrismaService.$on('query', (e) => {
    console.log('Query: ' + e.query);
    console.log('Params: ' + e.params);
  });
};

// TODO reset prisma db beforeAll https://github.com/selimb/fast-prisma-tests
export const beforeAllFn = async () => {
  pactum.settings.setLogLevel(log_name);
  pactum.request.setDefaultTimeout(3000000);
  moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useFactory({
      factory: () => {
        // NestJS specific code: Replace the original PrismaService when creating a testing module
        // Note that it is possible to cache this result and use the same module for all tests. The prismaService will automatically route all calls to the currently active transaction

        if (prismaTestingHelper == null) {
          // Initialize testing helper if it has not been initialized before
          initOriginalPrismaService();
          // Seed your database / Create source database state that will be used in each test case (if needed)
          // ...
          prismaTestingHelper = new PrismaTestingHelper(originalPrismaService);
          // Save prismaService. All calls to this prismaService will be routed to the currently active transaction
          prismaServiceForTest = prismaTestingHelper.getProxyClient();
        }
        return prismaServiceForTest;
      },
    })
    .compile();

  // app = moduleFixture.createNestApplication();
  // await app.init();

  testApp = await bootstrapForTest(moduleFixture);
  // await app.init();
  await testApp.getHttpAdapter().getInstance().ready();

  let url = await testApp.getUrl();
  url = url.replace('[::1]', 'localhost');
  // console.log('listening on', url);
  pactum.request.setBaseUrl(url);
  return url;
};

export const afterAllFn = async () => {
  await testApp?.close();
  testApp = null;
};

// This function must be called before every test
export async function beforeEachFn() {
  prismaTestingHelper.startNewTransaction({ timeout: 888888 });
  await pactum.sleep(100);
  // const prisma = Reflect.get(
  //   prismaTestingHelper,
  //   'currentPrismaTransactionClient',
  // );
  // if (prisma) {
  //   const txScope = app.get(PrismaTransactionScope);
  //   await txScope.setClientIfNull(prisma);
  // }
}

// This function must be called after every test
export async function afterEachFn(): Promise<void> {
  await pactum.sleep(500);
  prismaTestingHelper?.rollbackCurrentTransaction();
}
