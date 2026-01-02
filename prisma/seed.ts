import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

function hashPin(pin: string): string {
  return createHash('sha256').update(pin).digest('hex');
}

async function main() {
  console.log('Seeding database...');

  // Create a test network
  const network = await prisma.network.upsert({
    where: { slug: 'demo-network' },
    update: {},
    create: {
      name: 'Demo Network',
      slug: 'demo-network',
    },
  });
  console.log(`Created network: ${network.name} (${network.id})`);

  // Create locations
  const location1 = await prisma.location.upsert({
    where: {
      networkId_code: {
        networkId: network.id,
        code: 'WASH001',
      },
    },
    update: {},
    create: {
      networkId: network.id,
      name: 'Main Street Truck Wash',
      code: 'WASH001',
      address: '123 Main Street',
      city: 'Dallas',
      state: 'TX',
      zipCode: '75201',
      timezone: 'America/Chicago',
    },
  });
  console.log(`Created location: ${location1.name} (${location1.code})`);

  const location2 = await prisma.location.upsert({
    where: {
      networkId_code: {
        networkId: network.id,
        code: 'WASH002',
      },
    },
    update: {},
    create: {
      networkId: network.id,
      name: 'Highway 45 Wash Station',
      code: 'WASH002',
      address: '456 Highway 45',
      city: 'Houston',
      state: 'TX',
      zipCode: '77001',
      timezone: 'America/Chicago',
    },
  });
  console.log(`Created location: ${location2.name} (${location2.code})`);

  // Create partner companies
  const partnerCompany1 = await prisma.partnerCompany.upsert({
    where: {
      networkId_code: {
        networkId: network.id,
        code: 'SWIFT',
      },
    },
    update: {},
    create: {
      networkId: network.id,
      name: 'Swift Trucking Co',
      code: 'SWIFT',
      contactName: 'John Smith',
      email: 'dispatch@swift-trucking.example.com',
      phone: '555-123-4567',
    },
  });
  console.log(`Created partner company: ${partnerCompany1.name}`);

  const partnerCompany2 = await prisma.partnerCompany.upsert({
    where: {
      networkId_code: {
        networkId: network.id,
        code: 'PRIME',
      },
    },
    update: {},
    create: {
      networkId: network.id,
      name: 'Prime Logistics',
      code: 'PRIME',
      contactName: 'Jane Doe',
      email: 'operations@prime-logistics.example.com',
      phone: '555-987-6543',
    },
  });
  console.log(`Created partner company: ${partnerCompany2.name}`);

  // Create service packages
  const basicWash = await prisma.servicePackage.upsert({
    where: {
      networkId_code: {
        networkId: network.id,
        code: 'BASIC',
      },
    },
    update: {},
    create: {
      networkId: network.id,
      name: 'Basic Exterior Wash',
      code: 'BASIC',
      description: 'Exterior wash for tractor and trailer',
    },
  });
  console.log(`Created service package: ${basicWash.name}`);

  const premiumWash = await prisma.servicePackage.upsert({
    where: {
      networkId_code: {
        networkId: network.id,
        code: 'PREMIUM',
      },
    },
    update: {},
    create: {
      networkId: network.id,
      name: 'Premium Detail Wash',
      code: 'PREMIUM',
      description: 'Full exterior wash with detail cleaning and tire shine',
    },
  });
  console.log(`Created service package: ${premiumWash.name}`);

  const interiorWash = await prisma.servicePackage.upsert({
    where: {
      networkId_code: {
        networkId: network.id,
        code: 'INTERIOR',
      },
    },
    update: {},
    create: {
      networkId: network.id,
      name: 'Interior Detail',
      code: 'INTERIOR',
      description: 'Complete interior cleaning and sanitization',
    },
  });
  console.log(`Created service package: ${interiorWash.name}`);

  // Enable services at locations
  const services = [basicWash.id, premiumWash.id, interiorWash.id];
  const locations = [location1.id, location2.id];

  for (const locationId of locations) {
    for (const servicePackageId of services) {
      await prisma.locationServiceAvailability.upsert({
        where: {
          locationId_servicePackageId: {
            locationId,
            servicePackageId,
          },
        },
        update: {},
        create: {
          networkId: network.id,
          locationId,
          servicePackageId,
          isActive: true,
        },
      });
    }
  }
  console.log('Enabled services at all locations');

  // Create demo driver
  const demoDriver = await prisma.driver.upsert({
    where: {
      id: '00000000-0000-0000-0000-000000000001', // Use a fixed ID for demo
    },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      networkId: network.id,
      partnerCompanyId: partnerCompany1.id,
      firstName: 'Demo',
      lastName: 'Driver',
      phone: '555-DEMO-001',
      email: 'demo.driver@example.com',
      pinHash: hashPin('1234'), // PIN: 1234
    },
  });
  console.log(`Created demo driver: ${demoDriver.firstName} ${demoDriver.lastName}`);

  // Create invite for demo driver
  const invite = await prisma.driverInvite.upsert({
    where: { driverId: demoDriver.id },
    update: {
      inviteCode: 'DEMO01',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    },
    create: {
      networkId: network.id,
      driverId: demoDriver.id,
      inviteCode: 'DEMO01',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    },
  });
  console.log(`Created invite code: ${invite.inviteCode} (PIN: 1234)`);

  // Create demo vehicles
  const tractor1 = await prisma.vehicle.upsert({
    where: {
      networkId_plateNumber_plateState: {
        networkId: network.id,
        plateNumber: 'ABC1234',
        plateState: 'TX',
      },
    },
    update: {},
    create: {
      networkId: network.id,
      partnerCompanyId: partnerCompany1.id,
      type: 'TRACTOR',
      plateNumber: 'ABC1234',
      plateState: 'TX',
      make: 'Peterbilt',
      model: '579',
      year: 2022,
    },
  });
  console.log(`Created tractor: ${tractor1.plateNumber}`);

  const trailer1 = await prisma.vehicle.upsert({
    where: {
      networkId_plateNumber_plateState: {
        networkId: network.id,
        plateNumber: 'TRL5678',
        plateState: 'TX',
      },
    },
    update: {},
    create: {
      networkId: network.id,
      partnerCompanyId: partnerCompany1.id,
      type: 'TRAILER',
      plateNumber: 'TRL5678',
      plateState: 'TX',
      make: 'Great Dane',
      model: 'Freedom LT',
      year: 2021,
    },
  });
  console.log(`Created trailer: ${trailer1.plateNumber}`);

  console.log('\n=== SEED COMPLETE ===');
  console.log('\nDemo credentials:');
  console.log(`  Network ID: ${network.id}`);
  console.log(`  Location Code: WASH001 or WASH002`);
  console.log(`  Invite Code: DEMO01`);
  console.log(`  PIN: 1234`);
  console.log('\nUse these to test the PWA activation endpoint.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
