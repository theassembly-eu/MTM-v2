import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import LVL from '../models/LVL.js';
import User from '../models/User.js';
import TargetAudience from '../models/TargetAudience.js';
import OutputFormat from '../models/OutputFormat.js';
import Language from '../models/Language.js';

// MongoDB Connection
const MONGODB_DATABASE = 'fcc88fe703403b6bc797e032f52200a2';
let mongoUri;
if (process.env.APP_CONFIG) {
  const config = JSON.parse(process.env.APP_CONFIG);
  const mongoPassword = process.env.MONGO_PASSWORD;
  if (config.mongo && mongoPassword) {
    const hostString = config.mongo.hostString;
    if (hostString.includes('/')) {
      const slashIndex = hostString.indexOf('/');
      const hostPart = hostString.substring(0, slashIndex);
      const pathPart = hostString.substring(slashIndex + 1);
      if (pathPart.includes('?')) {
        const questionIndex = pathPart.indexOf('?');
        const queryPart = pathPart.substring(questionIndex);
        mongoUri = `mongodb://${config.mongo.user}:${encodeURIComponent(mongoPassword)}@${hostPart}/${MONGODB_DATABASE}${queryPart}`;
      } else {
        mongoUri = `mongodb://${config.mongo.user}:${encodeURIComponent(mongoPassword)}@${hostPart}/${MONGODB_DATABASE}`;
      }
    } else if (hostString.includes('?')) {
      const questionIndex = hostString.indexOf('?');
      const hostPart = hostString.substring(0, questionIndex);
      const queryPart = hostString.substring(questionIndex);
      mongoUri = `mongodb://${config.mongo.user}:${encodeURIComponent(mongoPassword)}@${hostPart}/${MONGODB_DATABASE}${queryPart}`;
    } else {
      mongoUri = `mongodb://${config.mongo.user}:${encodeURIComponent(mongoPassword)}@${hostString}/${MONGODB_DATABASE}`;
    }
  } else {
    mongoUri = `mongodb://localhost:27017/${MONGODB_DATABASE}`;
  }
} else {
  mongoUri = process.env.MONGODB_URI || `mongodb://localhost:27017/${MONGODB_DATABASE}`;
}

async function seed() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    // Seed LVLs
    console.log('\nSeeding LVLs...');
    const lvls = [
      { name: 'Local', code: 'LOCAL', description: 'Gemeentelijk niveau' },
      { name: 'Provincial', code: 'PROVINCIAL', description: 'Provinciaal niveau' },
      { name: 'Regional', code: 'REGIONAL', description: 'Gewestelijk niveau (Vlaams Gewest, Brussels Gewest, Waals Gewest)' },
      { name: 'Community', code: 'COMMUNITY', description: 'Gemeenschapsniveau (Vlaamse Gemeenschap, Franse Gemeenschap, Duitstalige Gemeenschap)' },
      { name: 'Federal', code: 'FEDERAL', description: 'Federaal niveau' },
    ];

    for (const lvlData of lvls) {
      const existing = await LVL.findOne({ code: lvlData.code });
      if (!existing) {
        await LVL.create(lvlData);
        console.log(`  ✓ Created LVL: ${lvlData.name} (${lvlData.code})`);
      } else {
        console.log(`  - LVL already exists: ${lvlData.name} (${lvlData.code})`);
      }
    }

    // Seed Target Audiences
    console.log('\nSeeding Target Audiences...');
    const targetAudiences = [
      { name: 'Algemeen', description: 'For a broad audience, like "your uncle at the family party."' },
      { name: 'Jongeren', description: 'For a 20-year-old audience, using modern, engaging, and slightly informal language' },
      { name: 'Ouderen', description: 'For an elderly audience, using formal, respectful, and very clear language' },
    ];

    for (const taData of targetAudiences) {
      const existing = await TargetAudience.findOne({ name: taData.name });
      if (!existing) {
        await TargetAudience.create(taData);
        console.log(`  ✓ Created Target Audience: ${taData.name}`);
      } else {
        console.log(`  - Target Audience already exists: ${taData.name}`);
      }
    }

    // Seed Output Formats
    console.log('\nSeeding Output Formats...');
    const outputFormats = [
      { name: 'Samenvatting', description: 'Provide a concise summary' },
      { name: 'Korte versie (Instagram-achtig)', description: 'Very short, engaging, and attention-grabbing text suitable for Instagram' },
      { name: 'Medium versie (LinkedIn-achtig)', description: 'Professional, informative, and engaging medium-length text suitable for LinkedIn' },
      { name: 'Opsommingstekens', description: 'Output in bullet points' },
    ];

    for (const ofData of outputFormats) {
      const existing = await OutputFormat.findOne({ name: ofData.name });
      if (!existing) {
        await OutputFormat.create(ofData);
        console.log(`  ✓ Created Output Format: ${ofData.name}`);
      } else {
        console.log(`  - Output Format already exists: ${ofData.name}`);
      }
    }

    // Seed Languages
    console.log('\nSeeding Languages...');
    const languages = [
      { name: 'Dutch', code: 'DUTCH', description: 'Nederlands' },
      { name: 'English', code: 'ENGLISH', description: 'Engels' },
      { name: 'French', code: 'FRENCH', description: 'Frans' },
    ];

    for (const langData of languages) {
      const existing = await Language.findOne({ code: langData.code });
      if (!existing) {
        await Language.create(langData);
        console.log(`  ✓ Created Language: ${langData.name} (${langData.code})`);
      } else {
        console.log(`  - Language already exists: ${langData.name} (${langData.code})`);
      }
    }

    // Create initial SUPER_ADMIN user
    console.log('\nCreating initial SUPER_ADMIN user...');
    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@mensentaalmachine.be';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123';

    const existingAdmin = await User.findOne({ email: adminEmail });
    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      await User.create({
        email: adminEmail,
        name: 'Super Admin',
        passwordHash,
        role: 'SUPER_ADMIN',
        teams: [],
      });
      console.log(`  ✓ Created SUPER_ADMIN user: ${adminEmail}`);
      console.log(`  ⚠️  Default password: ${adminPassword} - Please change this after first login!`);
    } else {
      console.log(`  - SUPER_ADMIN user already exists: ${adminEmail}`);
    }

    console.log('\n✅ Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  }
}

seed();

