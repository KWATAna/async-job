import { Request, Response } from "express";
import JobRequest from "../models/job-request";
import jobService from "../services/job-service";

class JobController {
  async createJob(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = JobRequest.validationSchema().validate(req.body);
      if (error) {
        res.status(400).json({
          error: "Validation failed",
          details: error.details,
        });
        return;
      }

      const job = await jobService.createJob(value);

      res.status(202).json({
        jobId: job.id,
        status: "queued",
        message: "Job accepted for processing",
      });
    } catch (error) {
      console.error("Error creating job:", error);
      res.status(500).json({
        error: "Internal server error",
      });
    }
  }

  async getJobStatus(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const job = await jobService.getJob(jobId);

      if (!job) {
        res.status(404).json({
          error: "Job not found",
        });
        return;
      }

      res.json(job);
    } catch (error) {
      console.error("Error getting job status:", error);
      res.status(500).json({
        error: "Internal server error",
      });
    }
  }
}

export default new JobController();
