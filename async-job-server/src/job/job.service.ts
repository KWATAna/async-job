import { Injectable } from '@nestjs/common';
import { CreateJobDto } from './dto/create-job.dto';
import { Job } from './entities/job.entity';
import { RedisService } from '../redis/redis.service';
import { JobPublisher } from './job.publisher';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class JobService {
  constructor(
    private readonly redisService: RedisService,
    private readonly jobPublisher: JobPublisher,
  ) {}

  private jobKey(id: string) {
    return `job:${id}`;
  }

  async createJob(dto: CreateJobDto): Promise<Job> {
    const id = uuidv4();

    const job: Job = {
      id,
      title: dto.title,
      payload: dto.payload,
      status: 'queued',
      createdAt: new Date(),
    };

    await this.redisService.set(this.jobKey(id), job);

    this.jobPublisher.publishJobCreated(job);

    return job;
  }

  async getJob(id: string): Promise<Job | null> {
    const job = await this.redisService.get<Job>(this.jobKey(id));
    return job;
  }
}
