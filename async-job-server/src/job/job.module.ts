import { Module } from '@nestjs/common';
import { JobService } from './job.service';
import { JobController } from './job.controller';
import { JobPublisher } from './job.publisher';

@Module({
  controllers: [JobController],
  providers: [JobService, JobPublisher], // services, repositories, factories, and helpers need to be listed for DI
})
export class JobModule {}
