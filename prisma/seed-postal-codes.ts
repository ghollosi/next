/**
 * Seed script for EU postal codes from GeoNames
 * Source: https://download.geonames.org/export/zip/
 *
 * Usage:
 *   npx ts-node prisma/seed-postal-codes.ts
 *
 * This will download and import postal codes for EU countries
 */

import { PrismaClient } from '@prisma/client';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const prisma = new PrismaClient();

// EU countries to import (ISO 3166-1 alpha-2 codes)
const EU_COUNTRIES = [
  'HU', // Hungary - priority
  'AT', // Austria
  'SK', // Slovakia
  'RO', // Romania
  'SI', // Slovenia
  'HR', // Croatia
  'DE', // Germany
  'CZ', // Czech Republic
  'PL', // Poland
  'IT', // Italy
  'FR', // France
  'NL', // Netherlands
  'BE', // Belgium
  'ES', // Spain
  'PT', // Portugal
  'BG', // Bulgaria
  'GR', // Greece
  'SE', // Sweden
  'DK', // Denmark
  'FI', // Finland
  'IE', // Ireland
  'LU', // Luxembourg
  'EE', // Estonia
  'LV', // Latvia
  'LT', // Lithuania
  'MT', // Malta
  'CY', // Cyprus
];

interface PostalCodeEntry {
  countryCode: string;
  postalCode: string;
  city: string;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        https.get(response.headers.location!, (redirectResponse) => {
          redirectResponse.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        }).on('error', reject);
      } else {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }
    }).on('error', reject);
  });
}

async function parseGeoNamesFile(filePath: string): Promise<PostalCodeEntry[]> {
  const entries: PostalCodeEntry[] = [];

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    // GeoNames format: country_code, postal_code, place_name, admin_name1, admin_code1, admin_name2, admin_code2, admin_name3, admin_code3, latitude, longitude, accuracy
    const parts = line.split('\t');
    if (parts.length < 11) continue;

    const [countryCode, postalCode, city, adminName1, , , , , , latStr, lonStr] = parts;

    const latitude = latStr ? parseFloat(latStr) : null;
    const longitude = lonStr ? parseFloat(lonStr) : null;

    entries.push({
      countryCode,
      postalCode,
      city,
      state: adminName1 || null,
      latitude: latitude && !isNaN(latitude) ? latitude : null,
      longitude: longitude && !isNaN(longitude) ? longitude : null,
    });
  }

  return entries;
}

async function seedPostalCodes() {
  console.log('Starting postal codes seeding...');

  const tempDir = path.join(__dirname, 'temp-postal-codes');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  let totalImported = 0;

  for (const countryCode of EU_COUNTRIES) {
    console.log(`\nProcessing ${countryCode}...`);

    const zipUrl = `https://download.geonames.org/export/zip/${countryCode}.zip`;
    const zipPath = path.join(tempDir, `${countryCode}.zip`);
    const txtPath = path.join(tempDir, `${countryCode}.txt`);

    try {
      // Download zip file
      console.log(`  Downloading ${zipUrl}...`);
      await downloadFile(zipUrl, zipPath);

      // Extract (using unzip command)
      const { execSync } = await import('child_process');
      execSync(`unzip -o "${zipPath}" -d "${tempDir}"`, { stdio: 'pipe' });

      // Parse and import
      if (fs.existsSync(txtPath)) {
        const entries = await parseGeoNamesFile(txtPath);
        console.log(`  Found ${entries.length} postal codes`);

        // Batch insert with upsert (in batches of 1000)
        const batchSize = 1000;
        for (let i = 0; i < entries.length; i += batchSize) {
          const batch = entries.slice(i, i + batchSize);

          await prisma.$transaction(
            batch.map(entry =>
              prisma.postalCode.upsert({
                where: {
                  countryCode_postalCode: {
                    countryCode: entry.countryCode,
                    postalCode: entry.postalCode,
                  }
                },
                create: entry,
                update: {
                  city: entry.city,
                  state: entry.state,
                  latitude: entry.latitude,
                  longitude: entry.longitude,
                },
              })
            )
          );

          process.stdout.write(`\r  Imported ${Math.min(i + batchSize, entries.length)}/${entries.length}`);
        }

        totalImported += entries.length;
        console.log(` - Done!`);
      }

      // Cleanup
      if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
      if (fs.existsSync(txtPath)) fs.unlinkSync(txtPath);

    } catch (error: any) {
      console.error(`  Error processing ${countryCode}: ${error.message}`);
    }
  }

  // Cleanup temp directory
  if (fs.existsSync(tempDir)) {
    fs.rmdirSync(tempDir, { recursive: true });
  }

  console.log(`\n\nSeeding completed! Total imported: ${totalImported} postal codes`);
}

seedPostalCodes()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
