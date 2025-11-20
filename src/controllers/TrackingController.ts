import { Request, Response } from "express";
import { AppDataSource } from "../ormconfig";
import { EmailLog } from "../entities/EmailLog";

const PIXEL_BUFFER = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64"
);

export const trackOpen = async (req: Request, res: Response) => {
    // 1. Sabse pehle Image Bhejo (Taaki browser wait na kare)
    // Headers: Google ko bolo ki is image ko CACHE MAT KARE
    res.writeHead(200, {
        "Content-Type": "image/gif",
        "Content-Length": PIXEL_BUFFER.length,
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
    });
    res.end(PIXEL_BUFFER);

    // 2. Background mein Database Update karo
    try {
        const logId = parseInt(req.params.id);
        const userAgent = req.headers['user-agent'] || 'Unknown';

        console.log(`🔔 Tracking Hit: LogID ${logId} | UA: ${userAgent}`);

        if (!isNaN(logId)) {
            const logRepo = AppDataSource.getRepository(EmailLog);
            
            // Check karo current status kya hai
            const log = await logRepo.findOneBy({ id: logId });

            if (log) {
                // Sirf tab update karo agar wo abhi tak 'SENT' hai
                // (Taaki agar pehle hi 'REPLIED' ho chuka ho to overwrite na ho)
                if (log.status === "SENT") {
                    log.status = "OPENED";
                    await logRepo.save(log);
                    console.log(`✅ SUCCESS: Email Opened! Updated Log ID: ${logId}`);
                } else {
                    console.log(`ℹ️ Skipped Update: Log ID ${logId} is already '${log.status}'`);
                }
            } else {
                console.error(`❌ Error: Log ID ${logId} not found in DB.`);
            }
        }
    } catch (error) {
        console.error("❌ Tracking Error:", error);
    }
};