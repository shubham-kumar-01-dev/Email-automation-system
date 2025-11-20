import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis';
import { AppDataSource } from '../ormconfig';
import { EmailLog } from '../entities/EmailLog';
import { Lead } from '../entities/Lead';
import { CampaignStep } from '../entities/CampaignStep';
import { sendEmail } from '../services/emailService';

// --- HELPER: Magic Replacer (Updated for {{ }} and { }) ---
const replaceVariables = (text: string, variables: Record<string, any>): string => {
    if (!text) return "";
    // Ye Regex ab {{name}} aur {name} dono ko pakdega
    // Case-insensitive matching ke liye hum key ko lowercase mein convert karke check karenge
    return text.replace(/{{?\s*(\w+)\s*}}?/g, (_, key) => {
        const lowerKey = key.toLowerCase(); // Template key (e.g. "Name" -> "name")
        
        // Variables mein dhoondo (Direct match ya Lowercase match)
        // 1. Direct match (e.g. "companyName")
        if (variables[key]) return variables[key];
        
        // 2. Lowercase match (e.g. "Name" -> "name")
        const varKey = Object.keys(variables).find(k => k.toLowerCase() === lowerKey);
        return varKey ? variables[varKey] : ""; 
    });
};

export const emailWorker = new Worker('email-queue', async (job) => {
    const { campaignId, leadId, stepOrder } = job.data;

    console.log(`⚙️ Processing Job #${job.id} (Step ${stepOrder})...`);

    try {
        const leadRepo = AppDataSource.getRepository(Lead);
        const stepRepo = AppDataSource.getRepository(CampaignStep);
        const logRepo = AppDataSource.getRepository(EmailLog);

        // 1. Fresh Data Fetch karo
        const lead = await leadRepo.findOneBy({ id: leadId });
        const step = await stepRepo.findOne({ 
            where: { campaign: { id: campaignId }, stepOrder: stepOrder } 
        });

        if (!lead || !step) {
            console.error("❌ Lead or Step not found!");
            return;
        }

        // 2. Variables Prepare karo
        const variables = {
            email: lead.email,
            name: lead.name,             
            companyname: lead.companyName, // Lowercase alias for safety
            companyName: lead.companyName,
            Company:lead.companyName,
            ...lead.customFields
        };
        console.log("🔧 Variables", variables);


        // 3. Subject aur Body ko Dynamic Banao
        const finalSubject = replaceVariables(step.subject || "", variables);
        const finalBody = replaceVariables(step.body || "", variables);

        console.log(`
        --------------------------------------------
        📧 SENDING EMAIL VIA NODEMAILER
        To:      ${lead.email}
        Subject: ${finalSubject}
        Body:    ${finalBody}
        --------------------------------------------
        `);

        // 4. Asli Email Bhejo
        const info = await sendEmail(lead.email, finalSubject, finalBody);

        // 5. Log Save karo
        const log = new EmailLog();
        log.lead = lead;
        log.step = step;
        log.status = "SENT";
        log.messageId = info.messageId;
        
        await logRepo.save(log);
        console.log(`✅ Log Saved for ${lead.email}`);

        // (Next Step logic can be added here)

    } catch (error) {
        console.error(`❌ Job Failed:`, error);
    }

}, { 
    connection: redisConnection,
    concurrency: 5 
});

console.log("👷 Email Worker Started and Listening...");