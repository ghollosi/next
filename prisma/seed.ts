import { PrismaClient, BillingType, BillingCycle } from '@prisma/client';
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

  // Create Hungarian locations
  const location1 = await prisma.location.upsert({
    where: {
      networkId_code: {
        networkId: network.id,
        code: 'BP01',
      },
    },
    update: {},
    create: {
      networkId: network.id,
      name: 'Budapest - Nagykőrösi út',
      code: 'BP01',
      address: 'Nagykőrösi út 351',
      city: 'Budapest',
      zipCode: '1239',
      country: 'HU',
      timezone: 'Europe/Budapest',
    },
  });
  console.log(`Created location: ${location1.name} (${location1.code})`);

  const location2 = await prisma.location.upsert({
    where: {
      networkId_code: {
        networkId: network.id,
        code: 'GY01',
      },
    },
    update: {},
    create: {
      networkId: network.id,
      name: 'Győr - Ipari Park',
      code: 'GY01',
      address: 'Ipari Park utca 12',
      city: 'Győr',
      zipCode: '9027',
      country: 'HU',
      timezone: 'Europe/Budapest',
    },
  });
  console.log(`Created location: ${location2.name} (${location2.code})`);

  const location3 = await prisma.location.upsert({
    where: {
      networkId_code: {
        networkId: network.id,
        code: 'SZ01',
      },
    },
    update: {},
    create: {
      networkId: network.id,
      name: 'Szeged - Dorozsmai út',
      code: 'SZ01',
      address: 'Dorozsmai út 45',
      city: 'Szeged',
      zipCode: '6728',
      country: 'HU',
      timezone: 'Europe/Budapest',
    },
  });
  console.log(`Created location: ${location3.name} (${location3.code})`);

  // Create 10 Hungarian demo partner companies
  const demoPartners = [
    {
      code: 'HUNGATRANS',
      name: 'Hungatrans Kft.',
      contactName: 'Kovács István',
      email: 'info@hungatrans.hu',
      phone: '+36 1 234 5678',
      billingType: BillingType.CONTRACT,
      billingCycle: BillingCycle.MONTHLY,
      billingName: 'Hungatrans Szállítmányozási Kft.',
      billingAddress: 'Budapest, Váci út 123.',
      billingCity: 'Budapest',
      billingZipCode: '1138',
      billingCountry: 'HU',
      taxNumber: '12345678-2-41',
    },
    {
      code: 'WABERER',
      name: 'Waberer\'s International Zrt.',
      contactName: 'Nagy Péter',
      email: 'dispatch@waberers.hu',
      phone: '+36 1 345 6789',
      billingType: BillingType.CONTRACT,
      billingCycle: BillingCycle.MONTHLY,
      billingName: 'Waberer\'s International Nyrt.',
      billingAddress: 'Budapest, Nagykőrösi út 351.',
      billingCity: 'Budapest',
      billingZipCode: '1239',
      billingCountry: 'HU',
      taxNumber: '10387128-2-44',
    },
    {
      code: 'MASPED',
      name: 'Masped Logisztika Kft.',
      contactName: 'Szabó Anna',
      email: 'fuvarozas@masped.hu',
      phone: '+36 1 456 7890',
      billingType: BillingType.CONTRACT,
      billingCycle: BillingCycle.WEEKLY,
      billingName: 'Masped Logisztika Kft.',
      billingAddress: 'Budapest, Illatos út 9.',
      billingCity: 'Budapest',
      billingZipCode: '1097',
      billingCountry: 'HU',
      taxNumber: '23456789-2-43',
    },
    {
      code: 'EUROGATE',
      name: 'Eurogate Logistics Kft.',
      contactName: 'Tóth László',
      email: 'info@eurogate.hu',
      phone: '+36 96 567 890',
      billingType: BillingType.CONTRACT,
      billingCycle: BillingCycle.MONTHLY,
      billingName: 'Eurogate Logistics Kereskedelmi Kft.',
      billingAddress: 'Győr, Ipari Park út 15.',
      billingCity: 'Győr',
      billingZipCode: '9027',
      billingCountry: 'HU',
      taxNumber: '34567890-2-08',
    },
    {
      code: 'KAMIONSPED',
      name: 'KamionSped Trans Kft.',
      contactName: 'Horváth Gábor',
      email: 'diszpo@kamionsped.hu',
      phone: '+36 62 678 901',
      billingType: BillingType.CONTRACT,
      billingCycle: BillingCycle.MONTHLY,
      billingName: 'KamionSped Trans Kft.',
      billingAddress: 'Szeged, Budapesti út 3.',
      billingCity: 'Szeged',
      billingZipCode: '6728',
      billingCountry: 'HU',
      taxNumber: '45678901-2-06',
    },
    {
      code: 'ALFATRANS',
      name: 'Alfa-Trans Fuvarozó Kft.',
      contactName: 'Kiss Miklós',
      email: 'fuvar@alfatrans.hu',
      phone: '+36 72 789 012',
      billingType: BillingType.CONTRACT,
      billingCycle: BillingCycle.MONTHLY,
      billingName: 'Alfa-Trans Fuvarozó és Szolgáltató Kft.',
      billingAddress: 'Pécs, Megyeri út 76.',
      billingCity: 'Pécs',
      billingZipCode: '7632',
      billingCountry: 'HU',
      taxNumber: '56789012-2-02',
    },
    {
      code: 'DELTASPED',
      name: 'Delta-Sped Logisztika Kft.',
      contactName: 'Varga Zoltán',
      email: 'info@deltasped.hu',
      phone: '+36 46 890 123',
      billingType: BillingType.CONTRACT,
      billingCycle: BillingCycle.MONTHLY,
      billingName: 'Delta-Sped Logisztika Kft.',
      billingAddress: 'Miskolc, Szeles utca 2.',
      billingCity: 'Miskolc',
      billingZipCode: '3527',
      billingCountry: 'HU',
      taxNumber: '67890123-2-05',
    },
    {
      code: 'TRANSZPORT',
      name: 'Transzport Expressz Kft.',
      contactName: 'Molnár Ferenc',
      email: 'dispatch@transzport.hu',
      phone: '+36 52 901 234',
      billingType: BillingType.CASH,
      billingName: 'Transzport Expressz Szolgáltató Kft.',
      billingAddress: 'Debrecen, Vámospércsi út 84.',
      billingCity: 'Debrecen',
      billingZipCode: '4030',
      billingCountry: 'HU',
      taxNumber: '78901234-2-09',
    },
    {
      code: 'MEGASPED',
      name: 'Mega-Sped International Kft.',
      contactName: 'Németh Katalin',
      email: 'office@megasped.hu',
      phone: '+36 99 012 345',
      billingType: BillingType.CONTRACT,
      billingCycle: BillingCycle.MONTHLY,
      billingName: 'Mega-Sped International Kft.',
      billingAddress: 'Sopron, Bécsi út 55.',
      billingCity: 'Sopron',
      billingZipCode: '9400',
      billingCountry: 'HU',
      taxNumber: '89012345-2-08',
    },
    {
      code: 'CARGOLINE',
      name: 'CargoLine Hungary Kft.',
      contactName: 'Takács Béla',
      email: 'hungary@cargoline.eu',
      phone: '+36 76 123 456',
      billingType: BillingType.CONTRACT,
      billingCycle: BillingCycle.WEEKLY,
      billingName: 'CargoLine Hungary Logisztikai Kft.',
      billingAddress: 'Kecskemét, Matkói út 8.',
      billingCity: 'Kecskemét',
      billingZipCode: '6000',
      billingCountry: 'HU',
      taxNumber: '90123456-2-03',
    },
  ];

  const createdPartners = [];
  for (const partner of demoPartners) {
    const created = await prisma.partnerCompany.upsert({
      where: {
        networkId_code: {
          networkId: network.id,
          code: partner.code,
        },
      },
      update: {},
      create: {
        networkId: network.id,
        ...partner,
      },
    });
    createdPartners.push(created);
    console.log(`Created partner company: ${created.name} (${created.code})`);
  }

  // Create Hungarian service packages
  const kulsoBelsoMosas = await prisma.servicePackage.upsert({
    where: {
      networkId_code: {
        networkId: network.id,
        code: 'KULSO_BELSO',
      },
    },
    update: {},
    create: {
      networkId: network.id,
      name: 'Külső-belső mosás',
      code: 'KULSO_BELSO',
      description: 'Teljes külső és belső mosás vontatónak és pótkocsinak',
    },
  });
  console.log(`Created service package: ${kulsoBelsoMosas.name}`);

  const kulsoMosas = await prisma.servicePackage.upsert({
    where: {
      networkId_code: {
        networkId: network.id,
        code: 'KULSO',
      },
    },
    update: {},
    create: {
      networkId: network.id,
      name: 'Külső mosás',
      code: 'KULSO',
      description: 'Külső mosás vontatónak és/vagy pótkocsinak',
    },
  });
  console.log(`Created service package: ${kulsoMosas.name}`);

  const belsoMosas = await prisma.servicePackage.upsert({
    where: {
      networkId_code: {
        networkId: network.id,
        code: 'BELSO',
      },
    },
    update: {},
    create: {
      networkId: network.id,
      name: 'Belső takarítás',
      code: 'BELSO',
      description: 'Belső takarítás és fertőtlenítés',
    },
  });
  console.log(`Created service package: ${belsoMosas.name}`);

  const potkocsiMosas = await prisma.servicePackage.upsert({
    where: {
      networkId_code: {
        networkId: network.id,
        code: 'POTKOCSI',
      },
    },
    update: {},
    create: {
      networkId: network.id,
      name: 'Pótkocsi mosás',
      code: 'POTKOCSI',
      description: 'Csak pótkocsi külső mosás',
    },
  });
  console.log(`Created service package: ${potkocsiMosas.name}`);

  const tartalyMosas = await prisma.servicePackage.upsert({
    where: {
      networkId_code: {
        networkId: network.id,
        code: 'TARTALY',
      },
    },
    update: {},
    create: {
      networkId: network.id,
      name: 'Tartály mosás',
      code: 'TARTALY',
      description: 'Tartályautó belső és külső mosás',
    },
  });
  console.log(`Created service package: ${tartalyMosas.name}`);

  // Enable services at locations
  const services = [kulsoBelsoMosas.id, kulsoMosas.id, belsoMosas.id, potkocsiMosas.id, tartalyMosas.id];
  const locations = [location1.id, location2.id, location3.id];

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

  // Create demo driver for first partner
  const demoDriver = await prisma.driver.upsert({
    where: {
      id: '00000000-0000-0000-0000-000000000001',
    },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      networkId: network.id,
      partnerCompanyId: createdPartners[0].id,
      firstName: 'Demo',
      lastName: 'Sofőr',
      phone: '+36 30 123 4567',
      email: 'demo.sofor@example.hu',
      pinHash: hashPin('1234'),
    },
  });
  console.log(`Created demo driver: ${demoDriver.firstName} ${demoDriver.lastName}`);

  // Create invite for demo driver
  const invite = await prisma.driverInvite.upsert({
    where: { driverId: demoDriver.id },
    update: {
      inviteCode: 'DEMO01',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
    create: {
      networkId: network.id,
      driverId: demoDriver.id,
      inviteCode: 'DEMO01',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });
  console.log(`Created invite code: ${invite.inviteCode} (PIN: 1234)`);

  // Create demo vehicles
  const tractor1 = await prisma.vehicle.upsert({
    where: {
      networkId_plateNumber_plateState: {
        networkId: network.id,
        plateNumber: 'ABC-123',
        plateState: 'HU',
      },
    },
    update: {},
    create: {
      networkId: network.id,
      partnerCompanyId: createdPartners[0].id,
      type: 'TRACTOR',
      plateNumber: 'ABC-123',
      plateState: 'HU',
      make: 'Mercedes-Benz',
      model: 'Actros',
      year: 2022,
    },
  });
  console.log(`Created tractor: ${tractor1.plateNumber}`);

  const trailer1 = await prisma.vehicle.upsert({
    where: {
      networkId_plateNumber_plateState: {
        networkId: network.id,
        plateNumber: 'XYZ-456',
        plateState: 'HU',
      },
    },
    update: {},
    create: {
      networkId: network.id,
      partnerCompanyId: createdPartners[0].id,
      type: 'TRAILER',
      plateNumber: 'XYZ-456',
      plateState: 'HU',
      make: 'Kögel',
      model: 'Cargo',
      year: 2021,
    },
  });
  console.log(`Created trailer: ${trailer1.plateNumber}`);

  console.log('\n=== SEED COMPLETE ===');
  console.log('\nDemo adatok:');
  console.log(`  Network ID: ${network.id}`);
  console.log(`  Helyszín kódok: BP01, GY01, SZ01`);
  console.log(`  Meghívó kód: DEMO01`);
  console.log(`  PIN: 1234`);
  console.log(`\n10 demo partner létrehozva:`);
  createdPartners.forEach((p, i) => console.log(`  ${i + 1}. ${p.name} (${p.code})`));
  console.log('\nHasználd ezeket a PWA aktiváló endpoint teszteléséhez.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
