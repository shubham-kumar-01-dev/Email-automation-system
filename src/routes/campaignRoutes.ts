import { Router, Request, Response } from "express"; // Request, Response import karna mat bhoolna
import { createCampaign } from "../controllers/CampaignController";
import { AppDataSource } from "../ormconfig";
import { Mailbox } from "../entities/Mailbox";

const router = Router();

router.post("/seed-mailbox", async (req: Request, res: Response) => {
    try {
        const mailbox = new Mailbox();
        mailbox.userId = 1;
        mailbox.email = "sender@test.com";
        mailbox.name = "Test Sender";
        mailbox.provider = "SMTP";
        mailbox.dailyLimit = 50;
        
        const saved = await AppDataSource.manager.save(mailbox);
        res.json({ message: "Mailbox Created!", id: saved.id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to create mailbox" });
    }
});

// POST http://localhost:5000/api/campaigns
router.post("/", createCampaign);

export default router;