import nodemailer from "nodemailer";

// Development ke liye hum Ethereal use karenge (Fake SMTP)
// Production mein aap yahan Gmail/SendGrid use karenge
const createTransporter = async () => {
    // Ethereal ka test account generate karein (Sirf ek baar)
    const testAccount = await nodemailer.createTestAccount();

    // Transporter banayein
    const transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false, 
        auth: {
            user: testAccount.user, 
            pass: testAccount.pass, 
        },
    });

    return transporter;
};

export const sendEmail = async (to: string, subject: string, html: string) => {
    try {
        const transporter = await createTransporter();

        const info = await transporter.sendMail({
            from: '"Outreach Bot" <bot@example.com>', // Sender address
            to: to, 
            subject: subject, 
            html: html, 
        });

        console.log("📨 Message sent: %s", info.messageId);
        // Ethereal aapko ek URL dega jahan aap email dekh sakte hain
        console.log("👀 Preview URL: %s", nodemailer.getTestMessageUrl(info));
        
        return info;
    } catch (error) {
        console.error("❌ Error sending email:", error);
        throw error;
    }
};