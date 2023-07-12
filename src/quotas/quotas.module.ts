import { Module } from '@nestjs/common';
import { QuotasService } from './quotas.service';

@Module({
  providers: [QuotasService],
  exports: [QuotasService],
})
export class QuotasModule {}
