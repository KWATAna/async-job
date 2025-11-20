import { Injectable } from '@nestjs/common';
import { CreateJobDto } from './dto/create-job.dto';

@Injectable()
export class JobService {
  create(createJobDto: CreateJobDto) {
    console.log(createJobDto);
    return 'This action adds a new job';
  }

  findOne(id: number) {
    return `This action returns a #${id} job`;
  }
}
