import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JobModule } from './job/job.module';
import { RedisModule } from './redis/redis.module';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module';

@Module({
  imports: [JobModule, RedisModule, RabbitmqModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
