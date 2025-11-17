const express = require("express");
const jobController = require("../controllers/job-controller");

const router = express.Router();

router.post("/api/jobs", jobController.createJob);
router.get("/api/job/:jobId", jobController.getJobStatus);

module.exports = router;
