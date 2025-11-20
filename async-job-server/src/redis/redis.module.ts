import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

@Global() // so you don't have to import everywhere
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
