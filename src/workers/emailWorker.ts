import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis';
import { AppDataSource } from '../ormconfig';
import { EmailLog } from '../entities/EmailLog';
import { Lead } from '../entities/Lead';
import { CampaignStep } from '../entities/CampaignStep';

// Ye hai humara Worker (Postman)
export const emailWorker = new Worker('email-queue', async (job) => {
    const { campaignId, leadId, stepOrder, email, subject, body } = job.data;

    console.log(`⚙️ Processing Job #${job.id}: Sending email to ${email}...`);

    try {
        // ----------------------------------------
        // 1. Yahan Actual Email Sending Logic aayega (Nodemailer)
        // ----------------------------------------
        // Abhi ke liye hum bas print kar rahe hain simulate karne ke liye
        console.log(`
        --------------------------------------------
        📧 MOCK EMAIL SENT!
        To: ${email}
        Subject: ${subject.replace('{firstName}', 'User')} 
        Body: ${body}
        --------------------------------------------
        `);

        // 2. Database mein Log Save karna
        // Humein Lead aur Step ka reference chahiye
        const leadRepo = AppDataSource.getRepository(Lead);
        const stepRepo = AppDataSource.getRepository(CampaignStep);
        const logRepo = AppDataSource.getRepository(EmailLog);

        const lead = await leadRepo.findOneBy({ id: leadId });
        
        // Step dhoondne ke liye campaignId aur order chahiye
        const step = await stepRepo.findOne({ 
            where: { campaign: { id: campaignId }, stepOrder: stepOrder } 
        });

        if (lead && step) {
            const log = new EmailLog();
            log.lead = lead;
            log.step = step;
            log.status = "SENT";
            log.messageId = `msg-${Date.now()}`; // Dummy Message ID
            
            await logRepo.save(log);
            console.log(`✅ Database Log Updated for ${email}`);
        }

    } catch (error) {
        console.error(`❌ Failed to send email to ${email}:`, error);
        throw error; // Taaki BullMQ isko "Failed" mark kare
    }

}, { 
    connection: redisConnection,
    concurrency: 5 // Ek saath 5 emails bhejne ki taqat
});

console.log("👷 Email Worker Started and Listening...");