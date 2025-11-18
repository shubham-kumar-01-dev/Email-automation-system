import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany } from "typeorm";
import { Mailbox } from "./Mailbox";
import { CampaignStep } from "./CampaignStep";
import { Lead } from "./Lead";

@Entity()
export class Campaign {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: "int" })
    userId: number;

    @Column({ type: "varchar" })
    name: string;

    @Column({ type: "enum", enum: ["DRAFT", "RUNNING", "PAUSED", "COMPLETED"], default: "DRAFT" })
    status: "DRAFT" | "RUNNING" | "PAUSED" | "COMPLETED";

    @CreateDateColumn()
    createdAt: Date;

    // Relations
    @ManyToOne(() => Mailbox, (mailbox) => mailbox.campaigns, { onDelete: "SET NULL" })
    mailbox: Mailbox;

    @OneToMany(() => CampaignStep, (step) => step.campaign)
    steps: CampaignStep[];

    @OneToMany(() => Lead, (lead) => lead.campaign)
    leads: Lead[];
}