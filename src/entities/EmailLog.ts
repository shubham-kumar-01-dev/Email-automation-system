import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from "typeorm";
import { Lead } from "./Lead";
import { CampaignStep } from "./CampaignStep";

@Entity()
export class EmailLog {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: "varchar", nullable: true })
    messageId: string; // Reply tracking key

    @Column({ 
        type: "enum", 
        enum: ["SENT", "OPENED", "CLICKED", "FAILED"], 
        default: "SENT" 
    })
    status: "SENT" | "OPENED" | "CLICKED" | "FAILED";

    @CreateDateColumn()
    sentAt: Date;

    // Relations
    @ManyToOne(() => Lead, { onDelete: "CASCADE" })
    lead: Lead;

    @ManyToOne(() => CampaignStep, { onDelete: "CASCADE" })
    step: CampaignStep;
}