import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config(); 

const createTransporter = async () => {
    console.log("🐛 Entering createTransporter function.");
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        console.log("🐛 Using real SMTP config.");
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST || "smtp.gmail.com",
            port: parseInt(process.env.SMTP_PORT || "465"),
            secure: parseInt(process.env.SMTP_PORT || "465") === 465, 
            auth: {
                user: process.env.SMTP_USER, // Login ke liye ye ID (Brevo ID)
                pass: process.env.SMTP_PASS,
            },
        });
    }

    console.log("⚠️ No SMTP Config found. Using Ethereal (Fake) Mail.");
    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
            user: testAccount.user,
            pass: testAccount.pass,
        },
    });
};

export const sendEmail = async (to: string, subject: string, html: string, customMessageId?: string) => {
    console.log(`🐛 Entering sendEmail function. To: ${to}`);
    try {
        const transporter = await createTransporter();
        
        // 👇 MAIN FIX: Ab hum 'SENDER_EMAIL' use karenge, 'SMTP_USER' nahi
        // Agar SENDER_EMAIL nahi mila, to SMTP_USER try karega (Gmail ke case mein)
        const senderEmail = process.env.SENDER_EMAIL || process.env.SMTP_USER || 'bot@example.com';
        const senderName = "Shubham from Outreach";

        const mailOptions: any = {
            from: `"${senderName}" <${senderEmail}>`, // Ab ye Valid Email hoga
            to: to,
            subject: subject,
            html: html,
        };

        if (customMessageId) {
            mailOptions.messageId = customMessageId;
            mailOptions.headers = {
                'References': customMessageId
            };
        }

        const info = await transporter.sendMail(mailOptions);

        console.log("📨 Real Email Sent! Message ID: %s", info.messageId);
        
        if (!process.env.SMTP_USER) {
            console.log("👀 Preview URL: %s", nodemailer.getTestMessageUrl(info));
        }
        
        return info;
    } catch (error) {
        console.error("❌ Error sending email:", error);
        throw error;
    }
};