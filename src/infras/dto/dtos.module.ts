import { Module } from '@nestjs/common';
import { DtoMapperProfile } from './dtos.automapper';

@Module({
  providers: [DtoMapperProfile],
})
export class DtosModule {}
