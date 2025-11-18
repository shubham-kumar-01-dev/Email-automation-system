import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from "typeorm";
import { Campaign } from "./Campaign";

@Entity()
export class Lead {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: "varchar" })
    email: string;

    @Column({ type: "varchar", nullable: true })
    firstName: string;

    @Column({ type: "varchar", nullable: true })
    companyName: string;

    @Column({ 
        type: "enum", 
        enum: ["PENDING", "ACTIVE", "COMPLETED", "REPLIED", "BOUNCED"], 
        default: "PENDING" 
    })
    status: "PENDING" | "ACTIVE" | "COMPLETED" | "REPLIED" | "BOUNCED";

    @Column({ type: "int", default: 0 })
    currentStep: number;

    @CreateDateColumn()
    createdAt: Date;

    // Relations
    @ManyToOne(() => Campaign, (campaign) => campaign.leads, { onDelete: "CASCADE" })
    campaign: Campaign;
}