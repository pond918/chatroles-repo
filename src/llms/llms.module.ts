import { Module } from '@nestjs/common';
import { LLMsService } from './llms.service';

@Module({
  providers: [LLMsService],
  exports: [LLMsService],
})
export class LLMsModule {}
