import { Worker } from 'bullmq';
import { redisConnection } from '../config/redis';
import { AppDataSource } from '../ormconfig';
import { Lead } from '../entities/Lead';
import { EmailLog } from '../entities/EmailLog';
import imaps from 'imap-simple';
import dotenv from 'dotenv';

dotenv.config();

// ✅ Helper: Date Formatter for IMAP (DD-Mon-YYYY)
function formatDate(date: Date): string {
    const day = date.getDate();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

export const replyWorker = new Worker('reply-check-queue', async (job) => {
    console.log(`🕵️ Checking for new replies... (Time: ${new Date().toISOString()})`);

    const imapUser = process.env.IMAP_USER || '';
    const imapPass = process.env.IMAP_PASS || '';
    
    if (!imapUser || !imapPass) {
        console.error("❌ Error: IMAP credentials missing.");
        return;
    }

    try {
        const leadRepo = AppDataSource.getRepository(Lead);
        const logRepo = AppDataSource.getRepository(EmailLog);

        const config = {
            imap: {
                user: imapUser,
                password: imapPass,
                host: process.env.IMAP_HOST || 'imap.gmail.com',
                port: 993,
                tls: true,
                authTimeout: 10000,
                tlsOptions: { rejectUnauthorized: false } 
            }
        };

        console.log('🔌 Connecting to Gmail...');
        const connection = await imaps.connect(config);
        await connection.openBox('INBOX');

        // ✅ OPTIMIZATION: Sirf pichle 24 ghante ke emails dekho
        // Taaki agar inbox mein 1000 purane unread mails hain to worker slow na ho
        const pastTime = new Date();
        pastTime.setHours(pastTime.getHours() - 24); // 24 ghante ka buffer safe rehta hai
        const formattedDate = formatDate(pastTime);

        console.log(`📂 Searching UNSEEN emails since: ${formattedDate}`);

        const searchCriteria = [
            'UNSEEN', 
            ['SENTSINCE', formattedDate] // Sirf naye emails layega
        ];
        
        const fetchOptions = { bodies: ['HEADER'], markSeen: false };
        const messages = await connection.search(searchCriteria, fetchOptions);

        console.log(`📬 Found ${messages.length} recent unread emails.`);

        for (const item of messages) {
            const headerPart = item.parts.find((p: any) => p.which === 'HEADER');
            if (!headerPart || !headerPart.body) continue;

            const fromRaw = headerPart.body.from ? headerPart.body.from[0] : "";
            const emailMatch = fromRaw.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/);
            const senderEmail = emailMatch ? emailMatch[0] : "";

            const inReplyTo = headerPart.body['in-reply-to'] || headerPart.body['references'];
            
            let matchFound = false;
            let matchedLead: Lead | null = null;
            let matchedLog: EmailLog | null = null;

            // --- PLAN A: Message-ID Match ---
            if (inReplyTo) {
                const rawId = Array.isArray(inReplyTo) ? inReplyTo[0] : inReplyTo;
                const cleanId = rawId.replace(/^<|>$/g, '');

                const log = await logRepo.findOne({
                    where: { messageId: `<${cleanId}>` },
                    relations: ["lead"]
                });

                if (log && log.lead) {
                    console.log(`✅ PLAN A: Matched via Message-ID!`);
                    matchedLead = log.lead;
                    matchedLog = log;
                    matchFound = true;
                }
            }

            // --- PLAN B: Sender Email Match ---
            if (!matchFound && senderEmail) {
                const lead = await leadRepo.findOne({
                    where: [
                        { email: senderEmail, status: "ACTIVE" },
                        { email: senderEmail, status: "PENDING" }
                    ],
                    order: { createdAt: "DESC" }
                });

                if (lead) {
                    console.log(`⚠️ PLAN B: Matched via Sender Email (${senderEmail})!`);
                    matchedLead = lead;
                    matchFound = true;
                    
                    const lastLog = await logRepo.findOne({
                        where: { lead: { id: lead.id } },
                        order: { sentAt: "DESC" }
                    });
                    if (lastLog) matchedLog = lastLog;
                }
            }

            // --- ACTION: Update DB ---
            if (matchFound && matchedLead) {
                if (matchedLead.status !== 'REPLIED') {
                    matchedLead.status = 'REPLIED';
                    await leadRepo.save(matchedLead);
                    console.log(`🎉 Lead ${matchedLead.email} marked as REPLIED.`);
                }

                if (matchedLog && matchedLog.status !== 'REPLIED') {
                    matchedLog.status = 'REPLIED';
                    await logRepo.save(matchedLog);
                    console.log(`✅ EmailLog ID ${matchedLog.id} updated to REPLIED.`);
                }
            }
        }

        connection.end();
        console.log('🏁 Reply Check Finished.');

    } catch (error: any) {
        console.error(`❌ Reply Check Error:`, error.message || error);
    }

}, { 
    connection: redisConnection 
});