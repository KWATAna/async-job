import { Module } from '@nestjs/common';
import { JobService } from './job.service';
import { JobController } from './job.controller';

@Module({
  controllers: [JobController],
  providers: [JobService], // services, repositories, factories, and helpers
})
export class JobModule {}
