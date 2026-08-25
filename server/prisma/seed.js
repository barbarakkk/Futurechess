require("dotenv").config();
const { prisma } = require("../src/lib/prisma");

const coaches = [
  {
    name: "Nino",
    surname: "Gaprindashvili",
    title: "Woman Grandmaster (WGM)",
    experienceYears: 15,
    bio: "Former national champion focused on tactical sharpness and endgame technique for intermediate to advanced players.",
    photoUrl: null,
    fideRating: 2350,
    specialties: ["Endgames", "Tactics", "Tournament prep"],
    languages: ["en", "ka"],
    hourlyRate: 40,
    email: "nino.coach@example.com",
  },
  {
    name: "David",
    surname: "Meskhi",
    title: "FIDE Master (FM)",
    experienceYears: 8,
    bio: "Specializes in opening repertoire building and practical decision-making under time pressure.",
    photoUrl: null,
    fideRating: 2280,
    specialties: ["Openings", "Time management"],
    languages: ["en", "ka"],
    hourlyRate: 25,
    email: "david.coach@example.com",
  },
  {
    name: "Elene",
    surname: "Kapanadze",
    title: "National Coach",
    experienceYears: 6,
    bio: "Loves working with beginners and scholastic players building a strong foundation.",
    photoUrl: null,
    fideRating: null,
    specialties: ["Beginners", "Fundamentals"],
    languages: ["ka"],
    hourlyRate: 15,
    email: "elene.coach@example.com",
  },
  {
    name: "Levan",
    surname: "Tsiklauri",
    title: "International Master (IM)",
    experienceYears: 12,
    bio: "High-performance coaching for competitive players preparing for rated tournaments.",
    photoUrl: null,
    fideRating: 2410,
    specialties: ["Tournament prep", "Middlegame strategy"],
    languages: ["en"],
    hourlyRate: 55,
    email: "levan.coach@example.com",
  },
];

/** A handful of open slots per coach over the next week — 3 one-hour slots/day at 10:00, 14:00, 18:00 local time. */
function buildSlots(daysAhead) {
  const slots = [];
  const hours = [10, 14, 18];

  for (let day = 1; day <= daysAhead; day++) {
    for (const hour of hours) {
      const startTime = new Date();
      startTime.setDate(startTime.getDate() + day);
      startTime.setHours(hour, 0, 0, 0);
      const endTime = new Date(startTime.getTime() + 60 * 60_000);
      slots.push({ startTime, endTime });
    }
  }

  return slots;
}

async function main() {
  for (const coachData of coaches) {
    const coach = await prisma.coach.upsert({
      where: { email: coachData.email },
      update: coachData,
      create: coachData,
    });

    const existingSlotCount = await prisma.coachAvailability.count({ where: { coachId: coach.id } });

    if (existingSlotCount === 0) {
      const slots = buildSlots(7);
      await prisma.coachAvailability.createMany({
        data: slots.map((slot) => ({ ...slot, coachId: coach.id })),
      });
      console.log(`Seeded coach ${coach.name} ${coach.surname} with ${slots.length} open slots`);
    } else {
      console.log(`Coach ${coach.name} ${coach.surname} already has slots — left untouched`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
