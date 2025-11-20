import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis';
import { AppDataSource } from '../ormconfig';
import { EmailLog } from '../entities/EmailLog';
import { Lead } from '../entities/Lead';
import { CampaignStep } from '../entities/CampaignStep';
import { sendEmail } from '../services/emailService';
import { emailQueue } from '../queues/emailQueue'; // Import Queue for next steps

// --- HELPER: Magic Replacer ---
const replaceVariables = (text: string, variables: Record<string, any>): string => {
    if (!text) return "";
    return text.replace(/{{?\s*(\w+)\s*}}?/g, (_, key) => {
        const lowerKey = key.toLowerCase();
        if (variables[key]) return variables[key];
        const varKey = Object.keys(variables).find(k => k.toLowerCase() === lowerKey);
        return varKey ? variables[varKey] : ""; 
    });
};

const TRACKING_DOMAIN = process.env.APP_URL || "http://localhost:5000"; 

export const emailWorker = new Worker('email-queue', async (job) => {
    const { campaignId, leadId, stepOrder } = job.data;

    console.log(`⚙️ Processing Job #${job.id} (Step ${stepOrder})...`);

    try {
        const leadRepo = AppDataSource.getRepository(Lead);
        const stepRepo = AppDataSource.getRepository(CampaignStep);
        const logRepo = AppDataSource.getRepository(EmailLog);

        const lead = await leadRepo.findOneBy({ id: leadId });
        const step = await stepRepo.findOne({ 
            where: { campaign: { id: campaignId }, stepOrder: stepOrder } 
        });

        if (!lead || !step) {
            console.error("❌ Lead or Step not found!");
            return;
        }

        if (lead.status === "REPLIED") {
            console.log(`⛔ Skipping email for ${lead.email} (Status: ${lead.status})`);
            return;
        }

        // 1. Create Log (Pending)
        const log = new EmailLog();
        log.lead = lead;
        log.step = step;
        log.status = "SENT";
        const savedLog = await logRepo.save(log);

        // 👇 CRITICAL: Generate Custom ID for Reply Detection
        // Format: <timestamp.leadId.stepId@outreach.local>
        const customMessageId = `<${Date.now()}.${lead.id}.${step.id}@outreach.local>`;

        // 2. Create Tracking Pixel
        const trackingPixel = `<img src="${TRACKING_DOMAIN}/api/track/open/${savedLog.id}" width="1" height="1" style="display:none;" alt="" />`;
        
        // 3. Variables Prepare
        const variables = {
            email: lead.email,
            name: lead.name,             
            companyname: lead.companyName,
            companyName: lead.companyName,
            Company: lead.companyName,
            ...lead.customFields
        };
        console.log("🔧 Variables:", variables);

        const finalSubject = replaceVariables(step.subject || "", variables);
        const finalBody = replaceVariables(step.body || "", variables) + trackingPixel;

        console.log(`
        --------------------------------------------
        📧 SENDING EMAIL VIA NODEMAILER
        To:      ${lead.email}
        Subject: ${finalSubject}
        ID:      ${customMessageId}
        --------------------------------------------
        `);

        // 4. Send Email with CUSTOM ID
        // Note: We pass customMessageId as the 4th argument
        await sendEmail(lead.email, finalSubject, finalBody, customMessageId);

        // 5. Update Database with SAME ID
        savedLog.messageId = customMessageId;
        await logRepo.save(savedLog);

        // Update Lead Status
        lead.currentStep = stepOrder;
        lead.status = "ACTIVE";
        await leadRepo.save(lead);

        console.log(`✅ Log Updated with Matchable ID: ${customMessageId}`);

        // 6. Schedule Next Step (Chain Reaction)
        const nextStepOrder = stepOrder + 1;
        const nextStep = await stepRepo.findOne({
            where: { campaign: { id: campaignId }, stepOrder: nextStepOrder }
        });

        if (nextStep) {
            console.log(`⏳ Scheduling Step ${nextStepOrder}...`);
            
            // Delay Calculation (Days to MS)
            // Testing: 10 seconds * waitDays
            // Production: replace 1000 with (24 * 60 * 60 * 1000)
            const delayMs = nextStep.waitDays * 24 * 60 * 60 * 1000; 

            await emailQueue.add('send-email', {
                campaignId,
                leadId,
                stepOrder: nextStepOrder,
            }, {
                delay: delayMs
            });
            console.log(`📅 Next email queued in ${nextStep.waitDays} days`);
        } else {
            console.log("🏁 Campaign Completed for this lead.");
            // lead.status = "COMPLETED"; // Optional: mark as completed
            // await leadRepo.save(lead);
        }

    } catch (error) {
        console.error(`❌ Job Failed:`, error);
    }

}, { 
    connection: redisConnection,
    concurrency: 5 
});

console.log("👷 Email Worker Started...");