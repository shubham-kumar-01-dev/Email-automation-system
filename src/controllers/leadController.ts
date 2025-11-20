import { Request, Response } from "express";
import { AppDataSource } from "../ormconfig";
import { Lead } from "../entities/Lead";
import { Campaign } from "../entities/Campaign";
import { emailQueue } from "../queues/emailQueue";
// import { validate } from "class-validator"; // No longer needed
// import { plainToClass } from "class-transformer"; // No longer needed
import { In } from "typeorm";

/**
 * Create one or more leads and attach them to a campaign.
 * The endpoint now accepts a campaignId and an array of leads.
 */
export const createLead = async (req: Request, res: Response): Promise<void> => {
    const { campaignId, leads: leadsDto } = req.body;

    if (typeof campaignId !== 'number' || !Array.isArray(leadsDto)) {
        res.status(400).json({ error: "Invalid request body. Expected campaignId (number) and leads (array)." });
        return;
    }
  
    const campaignRepo = AppDataSource.getRepository(Campaign);
    const leadRepo = AppDataSource.getRepository(Lead);
  
    try {
      // 1. Authorize and load campaign, steps, and mailbox
      const campaign = await campaignRepo.findOne({
        where: { id: campaignId}, // Check ownership
        relations: ["mailbox", "steps"],
      });
  
      if (!campaign) {
        res.status(404).json({ error: "Campaign not found or access denied" });
        return;
      }
  
      // 2. Find the first step for the campaign
      const firstStep = (campaign.steps ?? []).slice().sort((a, b) => a.stepOrder - b.stepOrder)[0];
  
      // 3. Deduplicate leads before insertion
      const leadEmails = leadsDto.map((l: any) => l.email?.trim().toLowerCase()).filter(Boolean); // Filter out undefined emails
      const existingLeads = await leadRepo.find({
        where: {
          campaign: { id: campaignId },
          email: In(leadEmails),
        },
      });
      const existingEmails = new Set(existingLeads.map(l => l.email));
  
      const results = { created: 0, duplicates: 0, failed: 0, duplicateEmails: [] as string[] };
      const newLeadsToSave: Lead[] = [];
  
      for (const leadDto of leadsDto) {
        if (!leadDto.email || typeof leadDto.email !== 'string') {
            results.failed++;
            continue;
        }

        const email = leadDto.email.trim().toLowerCase();
        if (existingEmails.has(email)) {
          results.duplicates++;
          results.duplicateEmails.push(email);
          continue;
        }
  
        const lead = new Lead();
        lead.email = email;
        lead.name = leadDto.Name ?? null; // Changed from lead.Name to lead.name
        lead.companyName = leadDto.companyName ?? null;
        lead.customFields = leadDto.customFields ?? null;
        lead.campaign = campaign;
        lead.userId = campaign.userId;
        lead.status = "PENDING";
        lead.currentStep = firstStep ? firstStep.stepOrder : 1;
        newLeadsToSave.push(lead);
        existingEmails.add(email); // Avoid duplicate entries from the same payload
      }
  
      if (newLeadsToSave.length === 0) {
        res.status(200).json({ message: "Lead processing complete. No new leads were created.", results });
        return;
      }
  
      // 4. Save new leads
      const savedLeads = await leadRepo.save(newLeadsToSave);
      results.created = savedLeads.length;
  
      // 5. Queue emails for the first step
      if (firstStep && campaign.mailbox) {
        const delayMs = Math.max(0, Math.floor(firstStep.waitDays ?? 0) * 24 * 60 * 60 * 1000);
        for (const savedLead of savedLeads) {
          const jobPayload = {
            campaignId: campaign.id,
            leadId: savedLead.id,
            stepId: firstStep.id,
            stepOrder: firstStep.stepOrder,
            email: savedLead.email,
            subject: firstStep.subject,
            body: firstStep.body,
            mailboxId: campaign.mailbox.id,
          };
          const emailResult =await emailQueue.add("send-email", jobPayload, { delay: delayMs });
          console.log(`Queued email job ${emailResult.id} for lead ${savedLead.email}`);
        }
      }
  
      res.status(201).json({ message: "Lead processing complete.", results });
  
    } catch (err) {
      console.error("createLead error:", err);
      res.status(500).json({ error: "Internal Server Error" });
    }
  };

/**
 * List leads for the authenticated user (optionally filter by campaignId).
 */
export const listLeads = async (req: Request, res: Response): Promise<void> => {
  try {
    const campaignId = req.query.campaignId ? Number(req.query.campaignId) : undefined;
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.max(1, Number(req.query.limit ?? 50));
    const skip = (page - 1) * limit;
    const userId = Number(req.query.userId);

    const leadRepo = AppDataSource.getRepository(Lead);
    const where: any = { userId };
    if (campaignId) {
        where.campaign = { id: campaignId, userId };
    }


    const [items, total] = await leadRepo.findAndCount({
      where,
      relations: ["campaign"],
      order: { id: "DESC" },
      skip,
      take: limit,
    });

    res.json({ data: items, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error("listLeads error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * Get a single lead by id for the authenticated user.
 */
export const getLead = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const userId = Number(req.query.userId); // Adjusted to get userId from query for this example

    if (!id) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const lead = await AppDataSource.getRepository(Lead).findOne({
        where: { id, userId },
        relations: ["campaign"],
      });

    if (!lead) {
      res.status(404).json({ error: "Lead not found or access denied" });
      return;
    }

    res.json({ data: lead });
  } catch (err) {
    console.error("getLead error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * Update lead for the authenticated user.
 */
export const updateLead = async (req:Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const userId = Number(req.query.userId); // Adjusted to get userId from query for this example

    if (!id) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const { status, currentStep,name, companyName, customFields } = req.body;
    const leadRepo = AppDataSource.getRepository(Lead);

    const lead = await leadRepo.findOne({ where: { id, userId } });
    if (!lead) {
      res.status(404).json({ error: "Lead not found or access denied" });
      return;
    }

    if (typeof status !== "undefined") lead.status = status;
    if (typeof currentStep !== "undefined") lead.currentStep = Number(currentStep);
    if (typeof name !== "undefined") lead.name = name; // Changed from lead.Name to lead.name
    if (typeof companyName !== "undefined") lead.companyName = companyName;

    if (typeof customFields !== "undefined") {
      if (customFields === null) {
        lead.customFields = null;
      } else if (typeof customFields === "object") {
        lead.customFields = { ...(lead.customFields ?? {}), ...customFields };
      } else {
        res.status(400).json({ error: "customFields must be an object or null" });
        return;
      }
    }

    const updated = await leadRepo.save(lead);
    res.json({ message: "Lead updated", data: updated });
  } catch (err) {
    console.error("updateLead error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * Delete a lead for the authenticated user.
 */
export const deleteLead = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const userId = Number(req.query.userId); // Adjusted to get userId from query for this example`

    if (!id) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const leadRepo = AppDataSource.getRepository(Lead);
    const result = await leadRepo.delete({ id, userId });

    if (result.affected === 0) {
      res.status(404).json({ error: "Lead not found or access denied" });
      return;
    }

    res.json({ message: "Lead deleted" });
  } catch (err) {
    console.error("deleteLead error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
