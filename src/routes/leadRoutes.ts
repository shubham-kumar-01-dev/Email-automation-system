import { Router } from "express";
import {
    createLead,
    listLeads,
    getLead,
    updateLead,
    deleteLead,
} from "../controllers/leadController";

const router = Router();

router.post("/", createLead);
router.get("/", listLeads);
router.get("/:id", getLead);
router.put("/:id", updateLead);
router.delete("/:id", deleteLead);

export default router;
