import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import jobsRouter from "./routes/jobs";
import queueService from "./services/queue-service";
import redisService from "./services/redis-service";

const app: Express = express();
const PORT: number = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api", jobsRouter); // Added prefix for better API structure

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    rabbitmq: queueService.channel ? "connected" : "disconnected",
    redis: redisService.client?.status === "ready" ? "connected" : "disconnected",
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ 
    error: "Internal server error",
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler for unmatched routes
app.use("*", (req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

// Start server
const startServer = async (): Promise<void> => {
  try {
    console.log("Starting server initialization...");
    
    await queueService.connect();

    app.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
      console.log(`📊 Health check available at http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Start the application
startServer();

export default app;