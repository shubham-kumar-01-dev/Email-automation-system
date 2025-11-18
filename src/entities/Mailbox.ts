import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from "typeorm";
import { Campaign } from "./Campaign";

@Entity()
export class Mailbox {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: "int" })
    userId: number;

    @Column({ type: "varchar" })
    email: string;

    @Column({ type: "varchar", nullable: true })
    name: string;

    @Column({ type: "enum", enum: ["GOOGLE", "OUTLOOK", "SMTP"] })
    provider: "GOOGLE" | "OUTLOOK" | "SMTP";

    @Column({ type: "text", nullable: true })
    accessToken: string;

    @Column({ type: "text", nullable: true })
    refreshToken: string;

    @Column({ type: "int", default: 50 })
    dailyLimit: number;

    @Column({ type: "int", default: 0 })
    sentToday: number;

    @Column({ type: "boolean", default: true })
    isActive: boolean;

    @CreateDateColumn()
    createdAt: Date;

    // Relations
    @OneToMany(() => Campaign, (campaign) => campaign.mailbox)
    campaigns: Campaign[];
}