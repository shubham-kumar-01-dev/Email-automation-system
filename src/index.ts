import "reflect-metadata";
import app from "./app";
import { AppDataSource } from "./ormconfig";

// 👇 YE IMPORT SABSE ZAROORI HAI
// Isse Worker start hoga aur Queue ko listen karna shuru karega
import "./workers/emailWorker"; 
import "./workers/replyWorker";

// 2. Scheduler Function Import karein
import { scheduleReplyChecks } from "./queues/replyQueue";

const PORT = process.env.PORT || 5000;

AppDataSource.initialize()
  .then(async () => {
    console.log("✅ Database connected successfully");

       // 3. YAHAN MAGIC HOGA: Reply Check ka Schedule Start karein
    // Server start hote hi ye Redis mein job add kar dega
     const replyCheckJob = await scheduleReplyChecks(); 
     console.log("⏰ Reply Check Scheduler Initialized.");
    
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
      console.log(`👉 Health check: http://localhost:${PORT}/api/health`);
    });
  })
  .catch((error) => {
    console.error("❌ Database connection failed:", error);
    process.exit(1);
  });