import { Router } from "express";
import { trackOpen } from "../controllers/TrackingController";

const router = Router();

// GET http://localhost:5000/api/track/open/123
router.get("/open/:id", trackOpen);

export default router;