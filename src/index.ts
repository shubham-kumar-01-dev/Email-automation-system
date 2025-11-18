import "reflect-metadata";
import app from "./app";
import { AppDataSource } from "./ormconfig";

// 👇 YE IMPORT SABSE ZAROORI HAI
// Isse Worker start hoga aur Queue ko listen karna shuru karega
import "./workers/emailWorker"; 

const PORT = process.env.PORT || 5000;

AppDataSource.initialize()
  .then(() => {
    console.log("✅ Database connected successfully");
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
      console.log(`👉 Health check: http://localhost:${PORT}/api/health`);
    });
  })
  .catch((error) => {
    console.error("❌ Database connection failed:", error);
    process.exit(1);
  });