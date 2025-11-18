import { Request, Response } from "express";
import { AppDataSource } from "../ormconfig"; // Ensure this points to your active config file
import { Campaign } from "../entities/Campaign";
import { CampaignStep } from "../entities/CampaignStep";
import { Lead } from "../entities/Lead";
import { Mailbox } from "../entities/Mailbox";
import { emailQueue } from "../queues/emailQueue";

export const createCampaign = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, mailboxId, steps, leads } = req.body;

        // 1. Check Mailbox
        const mailbox = await AppDataSource.getRepository(Mailbox).findOneBy({ id: mailboxId });
        if (!mailbox) {
            res.status(404).json({ error: "Mailbox not found" });
            return;
        }

        // 2. Create Campaign
        const campaign = new Campaign();
        campaign.name = name;
        campaign.userId = 1; // Hardcoded for testing
        campaign.mailbox = mailbox;
        campaign.status = "DRAFT";
        
        const savedCampaign = await AppDataSource.manager.save(campaign);

        // 3. Add Steps (Sequence)
        if (steps && steps.length > 0) {
            for (const stepData of steps) {
                const step = new CampaignStep();
                step.campaign = savedCampaign;
                step.stepOrder = stepData.stepOrder;
                step.subject = stepData.subject;
                step.body = stepData.body;
                step.waitDays = stepData.waitDays;
                await AppDataSource.manager.save(step);
            }
        }

        // 4. Add Leads
        if (leads && leads.length > 0) {
            const firstStep = steps && steps.length > 0 ? steps[0] : null;

            for (const leadData of leads) {
                const lead = new Lead();
                lead.campaign = savedCampaign;
                lead.email = leadData.email;
                lead.firstName = leadData.firstName;
                lead.status = "PENDING";
                lead.currentStep = 1;
                
                const savedLead = await AppDataSource.manager.save(lead);

                // --- QUEUE LOGIC START ---
                // Agar campaign ka pehla step exist karta hai, toh job queue mein daalo
                if (firstStep) {
                    await emailQueue.add('send-email', {
                        campaignId: savedCampaign.id,
                        leadId: savedLead.id,
                        stepOrder: 1,
                        email: savedLead.email,
                        subject: firstStep.subject,
                        body: firstStep.body
                    }, {
                        // Delay logic: Agar waitDays 1 hai, toh 1 din (ms mein) wait karo
                        delay: firstStep.waitDays * 24 * 60 * 60 * 1000
                    });
                    
                    console.log(`✅ Queued email for ${savedLead.email}`);
                }
                // --- QUEUE LOGIC END ---
            }
        }

        res.status(201).json({ message: "Campaign Created & Queued!", campaignId: savedCampaign.id });

    } catch (error) {
        console.error("Error creating campaign:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};