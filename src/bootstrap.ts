import compression from '@fastify/compress';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { useContainer } from 'class-validator';
import { FastifyRequest } from 'fastify';
import { PrismaService } from 'nestjs-prisma';
import { AppConstant } from './app.constants';
import { AppModule } from './app.module';

const logger = new Logger('bootstrap');

async function bootstrap(app: NestFastifyApplication, port: string) {
  // (BigInt.prototype as any).toJSON = function () {
  //   return Number(this);
  // };
  const configService = app.get(ConfigService);

  ///// api
  app.setGlobalPrefix('api');
  // https://www.thisdot.co/blog/nestjs-api-versioning-strategies
  // header 'x-api-version' based versioning
  // matching version from high to low.
  const DEFAULT_API_VERSION = configService.get<string>(
    'DEFAULT_API_VERSION',
    '1',
  );
  const extractor = (request: FastifyRequest): string | string[] => {
    const requestedVersion =
      <string>request.headers['x-api-version'] ?? DEFAULT_API_VERSION;
    // If requested version is N, then this generates an array like: ['N', 'N-1', 'N-2', ... , '1']
    return Array.from(
      { length: parseInt(requestedVersion) },
      (_, i) => `${i + 1}`,
    ).reverse();
  };
  app.enableVersioning({
    type: VersioningType.CUSTOM,
    extractor,
    defaultVersion: DEFAULT_API_VERSION,
  });

  ////// fastify cookie support
  // await app.register(fastifyCookie, {
  //   secret: configService.getOrThrow<string>('COOKIE_SECRET'), // for cookies signature
  // });

  ///// api docs
  const devDocVersion = configService.get<string>('DOCUMENTATION_VERSION');
  if (devDocVersion) {
    const config = new DocumentBuilder()
      .setTitle('roles.chat repo')
      .setDescription(
        'The <a href="https://roles.chat" target="_blank">roles.chat</a> repo API',
      )
      .setVersion(devDocVersion)
      .addBearerAuth(undefined, 'defaultBearerAuth')
      .build();

    const devJwtToken = app.get(JwtService).sign({
      id: AppConstant.systemUsername,
      ts: Date.now(),
    });
    // console.debug('devJwtToken:', devJwtToken);
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs/api', app, document, {
      swaggerOptions: {
        authAction: {
          defaultBearerAuth: {
            name: 'defaultBearerAuth',
            schema: {
              description: 'Default',
              type: 'http',
              in: 'header',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
            value: devJwtToken,
          },
        },
      },
    });
  }

  //// validation
  app.useGlobalPipes(
    new ValidationPipe({
      enableDebugMessages: !!devDocVersion,
      disableErrorMessages: !devDocVersion,
      validationError: {
        target: !!devDocVersion,
        value: !!devDocVersion,
      },
      whitelist: true,
      transform: true,
    }),
  );
  ///// validator injection: e.g. EntityIdExistsRule
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  // enable shutdown hook, deprecated for data-proxy
  const prismaService: PrismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  await app.register(compression, { encodings: ['gzip', 'deflate'] });

  await app.listen(port, '0.0.0.0', () =>
    logger.warn('Application is listening on port %s', port),
  );
  return app;
}

export async function bootstrapForProd() {
  const app: NestFastifyApplication =
    await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter(),
      {
        logger: ['error', 'warn', 'log'],
      },
    );
  return bootstrap(app, process.env.PORT || '3000');
}

export async function bootstrapForTest(moduleFixtureForTest: any) {
  const app: NestFastifyApplication =
    await moduleFixtureForTest.createNestApplication(new FastifyAdapter());
  logger.warn('Application running from moduleFixtureForTest!!!!!!');
  return bootstrap(app, process.env.PORT || '0');
}
