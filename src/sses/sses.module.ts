import { Module } from '@nestjs/common';
import { SsesController } from './sses.controller';
import { SsesService } from './sses.service';

@Module({
  controllers: [SsesController],
  providers: [SsesService],
  exports: [SsesService],
})
export class SsesModule {}
