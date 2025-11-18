import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Mailbox } from './entities/Mailbox';
import { Campaign } from './entities/Campaign';
import { CampaignStep } from './entities/CampaignStep';
import { Lead } from './entities/Lead';
import { EmailLog } from './entities/EmailLog';


export const AppDataSource = new DataSource({
  type: 'mysql',
  host: '127.0.0.1',
  port: 3306,
  username: 'root',
  password: 'root@123',
  database: 'outreach_db',
  synchronize: false,
  logging: true,
  entities: [Mailbox,Campaign,CampaignStep,Lead,EmailLog],
});
