import type { Prisma } from "@prisma/client";

declare module "@prisma/client" {
  // Augment PrismaClient typing in case the workspace TypeScript server
  // fails to pick up the generated model delegates from .prisma/client.
  interface PrismaClient<
    T extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
    U = "log" extends keyof T
      ? T["log"] extends Array<Prisma.LogLevel | Prisma.LogDefinition>
        ? Prisma.GetEvents<T["log"]>
        : never
      : never,
    ExtArgs extends Prisma.$Extensions.InternalArgs = Prisma.$Extensions.DefaultArgs
  > {
    coinFlipHistory: Prisma.CoinFlipHistoryDelegate<ExtArgs>;
  }
}
