import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  NotFoundException,
} from '@nestjs/common';
import { JobService } from './job.service';
import { CreateJobDto } from './dto/create-job.dto';

@Controller('jobs')
export class JobController {
  constructor(private readonly jobService: JobService) {}

  @Post('create')
  async create(@Body() dto: CreateJobDto) {
    const job = await this.jobService.createJob(dto);
    return job; // Nest auto-serializes
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    const job = await this.jobService.getJob(id);
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    return job;
  }
}
