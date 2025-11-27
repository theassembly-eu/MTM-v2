import 'dotenv/config';
import mongoose from 'mongoose';
import LVL from '../models/LVL.js';

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

// Belgian places data
const placesData = {
  LOCAL: [
    // Major Flemish municipalities
    'Antwerpen', 'Gent', 'Brugge', 'Leuven', 'Mechelen', 'Aalst', 'Kortrijk', 'Hasselt',
    'Sint-Niklaas', 'Oostende', 'Genk', 'Roeselare', 'Geel', 'Lier', 'Turnhout',
    'Dendermonde', 'Lokeren', 'Beveren', 'Vilvoorde', 'Mouscron', 'Waregem',
    // Major Walloon municipalities
    'Charleroi', 'Liège', 'Namur', 'Mons', 'La Louvière', 'Tournai', 'Seraing',
    'Verviers', 'Mouscron', 'Arlon', 'Bastogne', 'Dinant', 'Huy', 'Wavre',
    // Brussels municipalities
    'Brussel', 'Schaarbeek', 'Anderlecht', 'Molenbeek', 'Elsene', 'Etterbeek',
    'Sint-Jans-Molenbeek', 'Sint-Gillis', 'Jette', 'Evere', 'Ganshoren', 'Koekelberg',
    'Sint-Agatha-Berchem', 'Sint-Joost-ten-Node', 'Oudergem', 'Sint-Pieters-Woluwe',
    'Ukkel', 'Vorst', 'Watermaal-Bosvoorde', 'Sint-Lambrechts-Woluwe'
  ],
  PROVINCIAL: [
    'Antwerpen', 'Oost-Vlaanderen', 'West-Vlaanderen', 'Vlaams-Brabant', 'Limburg',
    'Henegouwen', 'Waals-Brabant', 'Luik', 'Luxemburg', 'Namen'
  ],
  REGIONAL: [
    'Vlaams Gewest', 'Brussels Gewest', 'Waals Gewest'
  ],
  COMMUNITY: [
    'Vlaamse Gemeenschap', 'Franse Gemeenschap', 'Duitstalige Gemeenschap'
  ],
  FEDERAL: [
    'België', 'Belgium'
  ]
};

async function migrateLvlPlaces() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB\n');

    console.log('Migrating LVL places...\n');

    for (const [code, places] of Object.entries(placesData)) {
      const lvl = await LVL.findOne({ code });
      
      if (!lvl) {
        console.log(`  ⚠️  LVL not found: ${code} - skipping`);
        continue;
      }

      // Only update if places array is empty or doesn't exist
      if (!lvl.places || lvl.places.length === 0) {
        lvl.places = places;
        await lvl.save();
        console.log(`  ✓ Updated ${lvl.name} (${code}): Added ${places.length} places`);
      } else {
        console.log(`  - ${lvl.name} (${code}) already has ${lvl.places.length} places - skipping`);
      }
    }

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during migration:', error);
    process.exit(1);
  }
}

migrateLvlPlaces();

