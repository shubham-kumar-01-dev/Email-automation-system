import { Request, Response } from "express";
import { AppDataSource } from "../ormconfig";
import { Campaign } from "../entities/Campaign";
import { CampaignStep } from "../entities/CampaignStep";
import { Mailbox } from "../entities/Mailbox";
import { QueryRunner } from "typeorm";

/**
 * Create campaign (WITHOUT leads). Accepts:
 * {
 *   name: string,
 *   mailboxId: number,
 *   status?: string, // default "DRAFT"
 *   steps?: [{ stepOrder, subject, body, waitDays }]
 * }
 */
export const createCampaign = async (req: Request, res: Response): Promise<void> => {
  const { name, mailboxId, steps, status } = req.body;
  const queryRunner: QueryRunner = AppDataSource.createQueryRunner();

  try {
    if (!name || !mailboxId) {
      res.status(400).json({ error: "name and mailboxId are required" });
      return;
    }

    const mailbox = await AppDataSource.getRepository(Mailbox).findOneBy({ id: mailboxId });
    if (!mailbox) {
      res.status(404).json({ error: "Mailbox not found" });
      return;
    }

    await queryRunner.connect();
    await queryRunner.startTransaction();

    const campaignRepo = queryRunner.manager.getRepository(Campaign);
    const stepRepo = queryRunner.manager.getRepository(CampaignStep);

    const campaign = new Campaign();
    campaign.name = name;
    campaign.mailbox = mailbox;
    campaign.userId = mailbox?.userId ?? 1; // if you have auth middleware, replace this; else 1 for testing
    campaign.status = status ?? "DRAFT";

    const savedCampaign = await campaignRepo.save(campaign);

    if (Array.isArray(steps) && steps.length > 0) {
      for (const s of steps) {
        const step = new CampaignStep();
        step.campaign = savedCampaign;
        step.stepOrder = s.stepOrder ?? 1;
        step.subject = s.subject ?? "";
        step.body = s.body ?? "";
        step.waitDays = s.waitDays ?? 0;
        await stepRepo.save(step);
      }
    }

    await queryRunner.commitTransaction();
    res.status(201).json({ message: "Campaign created", campaignId: savedCampaign.id });
  } catch (err) {
    await queryRunner.rollbackTransaction();
    console.error("createCampaign error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    await queryRunner.release();
  }
};

/**
 * List campaigns (pagination optional)
 * Query params: ?page=1&limit=20
 */
export const listCampaigns = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const limit = Math.max(1, parseInt(String(req.query.limit || "20"), 10));
    const skip = (page - 1) * limit;

    const campaignRepo = AppDataSource.getRepository(Campaign);

    const [items, total] = await campaignRepo.findAndCount({
      relations: ["mailbox"], // include mailbox; remove if not desired
      order: { id: "DESC" },
      skip,
      take: limit,
    });

    res.json({
      data: items,
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("listCampaigns error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * Get single campaign by id (includes steps)
 */
export const getCampaign = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const campaign = await AppDataSource.getRepository(Campaign).findOne({
      where: { id },
      relations: ["mailbox", "steps"],
    });

    if (!campaign) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }

    res.json({ data: campaign });
  } catch (err) {
    console.error("getCampaign error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * Update campaign (WITHOUT leads). Accepts partial fields and optional steps array.
 * If steps are provided, existing steps for campaign will be deleted and replaced with provided array.
 *
 * Body example:
 * { name?: string, mailboxId?: number, status?: string, steps?: [...] }
 */
export const updateCampaign = async (req: Request, res: Response): Promise<void> => {
  const campaignId = parseInt(req.params.id, 10);
  const { name, mailboxId, status, steps } = req.body;
  const queryRunner = AppDataSource.createQueryRunner();

  try {
    if (!campaignId) {
      res.status(400).json({ error: "Invalid campaign id" });
      return;
    }

    const campaignRepo = AppDataSource.getRepository(Campaign);
    const mailboxRepo = AppDataSource.getRepository(Mailbox);
    const stepRepo = AppDataSource.getRepository(CampaignStep);

    const existing = await campaignRepo.findOne({ where: { id: campaignId }, relations: ["steps"] });
    if (!existing) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }

    // If mailboxId present, ensure mailbox exists
    let mailbox = undefined;
    if (typeof mailboxId !== "undefined") {
      mailbox = await mailboxRepo.findOneBy({ id: mailboxId });
      if (!mailbox) {
        res.status(404).json({ error: "Mailbox not found" });
        return;
      }
    }

    await queryRunner.connect();
    await queryRunner.startTransaction();

    const manager = queryRunner.manager;

    // update basic fields
    if (typeof name !== "undefined") existing.name = name;
    if (typeof status !== "undefined") existing.status = status;
    if (mailbox) existing.mailbox = mailbox;

    await manager.getRepository(Campaign).save(existing);

    // Replace steps if steps array provided
    if (Array.isArray(steps)) {
      // remove existing steps
      await manager.getRepository(CampaignStep).delete({ campaign: { id: campaignId } } as any);
      // add new steps
      for (const s of steps) {
        const step = new CampaignStep();
        step.campaign = existing;
        step.stepOrder = s.stepOrder ?? 1;
        step.subject = s.subject ?? "";
        step.body = s.body ?? "";
        step.waitDays = s.waitDays ?? 0;
        await manager.getRepository(CampaignStep).save(step);
      }
    }

    await queryRunner.commitTransaction();
    res.json({ message: "Campaign updated", campaignId });
  } catch (err) {
    await queryRunner.rollbackTransaction();
    console.error("updateCampaign error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    await queryRunner.release();
  }
};

/**
 * Delete campaign and its steps (leads are NOT touched here).
 */
export const deleteCampaign = async (req: Request, res: Response): Promise<void> => {
  const campaignId = parseInt(req.params.id, 10);
  const queryRunner = AppDataSource.createQueryRunner();

  try {
    if (!campaignId) {
      res.status(400).json({ error: "Invalid campaign id" });
      return;
    }

    const campaignRepo = AppDataSource.getRepository(Campaign);
    const existing = await campaignRepo.findOne({ where: { id: campaignId }, relations: ["steps"] });
    if (!existing) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }

    await queryRunner.connect();
    await queryRunner.startTransaction();

    // delete steps first (if your entity isn't cascade-delete)
    await queryRunner.manager.getRepository(CampaignStep).delete({ campaign: { id: campaignId } } as any);

    // delete campaign
    await queryRunner.manager.getRepository(Campaign).delete({ id: campaignId });

    await queryRunner.commitTransaction();
    res.json({ message: "Campaign deleted" });
  } catch (err) {
    await queryRunner.rollbackTransaction();
    console.error("deleteCampaign error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  } finally {
    await queryRunner.release();
  }
};
