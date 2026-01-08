import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

export async function ensureUser(req, res, next) {
  const { id, email } = req.user;

  await prisma.user.upsert({
    where: { id },
    create: { id, email },
    update: {}
  });

  next();
}