import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";
import { Campaign } from "./Campaign";

@Entity()
export class CampaignStep {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: "int" })
    stepOrder: number; // 1, 2, 3

    @Column({ type: "varchar", nullable: true })
    subject: string;

    @Column({ type: "text", nullable: true })
    body: string;

    @Column({ type: "int", default: 0 })
    waitDays: number; // Pichle step ke baad kitna wait karna hai

    // Relations
    @ManyToOne(() => Campaign, (campaign) => campaign.steps, { onDelete: "CASCADE" })
    campaign: Campaign;
}