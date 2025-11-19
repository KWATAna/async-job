import { Router } from "express";
import jobController from "../controllers/job-controller";

const router: Router = Router();

router.post("/jobs", jobController.createJob.bind(jobController));
router.get("/job/:jobId", jobController.getJobStatus.bind(jobController));

export default router;