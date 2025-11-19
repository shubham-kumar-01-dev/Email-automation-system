import { Router, Request, Response } from "express"; // Request, Response import karna mat bhoolna
import { AppDataSource } from "../ormconfig";
import { Mailbox } from "../entities/Mailbox";
import {
    createCampaign,
    listCampaigns,
    getCampaign,
    updateCampaign,
    deleteCampaign,
} from "../controllers/CampaignController";

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
router.post("/", createCampaign);       // create campaign
router.get("/", listCampaigns);         // list campaigns (pagination)
router.get("/:id", getCampaign);        // get single campaign w/ steps
router.put("/:id", updateCampaign);     // update campaign (and steps if provided)
router.delete("/:id", deleteCampaign);  // delete campaign

export default router;