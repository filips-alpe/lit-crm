import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

// A tiny fixture: enough to log in, browse a type, a project and a few records,
// and for the e2e suite. For the real demo corpus (Benjamin Franklin, 25,827
// records) see the lit-crm-seeds repository and the README.

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: `${process.env.DATABASE_URL}` }),
});

const NOTE_LAYOUT = {
  fields: [
    { id: 'title', label: 'Title', kind: 'text', writeTo: 'title' },
    { id: 'text', label: 'Text', kind: 'markdown', writeTo: 'text' },
  ],
};

async function main() {
  // Destructive: wipes every user, project, type and record first.
  await prisma.projectRecord.deleteMany({});
  await prisma.record.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.type.deleteMany({});
  await prisma.user.deleteMany({});

  const alice = await prisma.user.create({
    data: { username: 'alice', name: 'Alice Example', color: '#3b6ea5', bio: 'Fixture user.' },
  });
  const bob = await prisma.user.create({
    data: { username: 'bob', name: 'Bob Example', color: '#8a2f3e', bio: 'Fixture user.' },
  });

  const note = await prisma.type.create({
    data: {
      code: 'note',
      description: 'A short note',
      color: '#3b6ea5',
      iconSeed: 'envelope',
      layout: NOTE_LAYOUT,
    },
  });

  const project = await prisma.project.create({
    data: {
      code: 'demo',
      description: 'Fixture project',
      color: '#2e6f7e',
      creatorId: alice.id,
      assigneeId: bob.id,
    },
  });

  const titles = ['First note', 'Second note', 'Third note'];
  for (const [i, title] of titles.entries()) {
    const record = await prisma.record.create({
      data: {
        typeId: note.id,
        creatorId: i % 2 ? bob.id : alice.id,
        title,
        text: `Body of the ${title.toLowerCase()}.`,
        createdAt: new Date(Date.UTC(2026, 0, 1 + i)),
      },
    });
    await prisma.projectRecord.create({ data: { projectId: project.id, recordId: record.id } });
  }

  console.log('\nSeed complete (fixture data).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
