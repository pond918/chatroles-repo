import { Controller, Get } from '@nestjs/common';
// import {
//   HealthCheck,
//   HealthCheckService,
//   HttpHealthIndicator,
// } from '@nestjs/terminus';

/** @see https://docs.nestjs.com/recipes/terminus */
@Controller('health')
export class HealthController {
  // constructor(
  //   private health: HealthCheckService,
  //   private http: HttpHealthIndicator,
  // ) {}

  // @Get()
  // @HealthCheck()
  // check() {
  //   return 'OK';
  //   // this.health.check([
  //   //   () => this.http.pingCheck('nestjs-docs', 'https://docs.nestjs.com'),
  //   // ]);
  // }
}
