import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@famerace/db";
import { battles as battlesMod, market as marketMod } from "../src";
import { makeUser, resetDb } from "./helpers";

let seq = 0;
async function liveCreator() {
  seq += 1;
  const handle = `battler${seq}`;
  const owner = await makeUser({ roles: ["CREATOR"] });
  const creator = await prisma.creator.create({
    data: { userId: owner.id, displayName: handle.toUpperCase(), handle, category: "MUSICIAN", fameScore: 30 + seq, status: "LIVE" },
  });
  await prisma.creatorMarket.create({
    data: { creatorId: creator.id, ticker: handle.toUpperCase(), status: "GENESIS_CURVE" },
  });
  return { owner, creator };
}

describe("fandom wars: battles and arena unlocks", () => {
  beforeEach(resetDb);

  it("opens one battle between the top two live creators and settles it by supporter gain", async () => {
    const { creator: a } = await liveCreator();
    const { creator: b } = await liveCreator();

    expect(await battlesMod.ensureBattle()).toBe(1);
    expect(await battlesMod.ensureBattle()).toBe(0); // idempotent while one is open

    const open = await battlesMod.openBattles();
    expect(open).toHaveLength(1);
    expect(open[0]!.a.gained).toBe(0);

    // One fan backs creator A during the battle window → A gains a supporter.
    const fan = await makeUser();
    const marketA = await prisma.creatorMarket.findUniqueOrThrow({ where: { creatorId: a.id } });
    await marketMod.buy(fan.id, marketA.id, 2500);

    const during = await battlesMod.battleForCreator(a.id);
    const mySide = during!.a.creator?.id === a.id ? during!.a : during!.b;
    expect(mySide.gained).toBe(1);

    // Force the deadline and resolve: A wins.
    await prisma.battle.updateMany({ data: { endsAt: new Date(Date.now() - 1000) } });
    expect(await battlesMod.resolveDueBattles()).toBe(1);
    const settled = await prisma.battle.findFirstOrThrow();
    expect(settled.status).toBe("SETTLED");
    expect(settled.winnerId).toBe(a.id);
    void b;
  });

  it("flips an arena unlock when the crowd hits the goal and notifies every supporter", async () => {
    const { owner, creator } = await liveCreator();
    await battlesMod.setUnlock(owner.id, 1, "Unreleased demo for the room");

    // Not reached yet? Depending on seed the creator may already have supporters;
    // force a clean check by targeting current+1 first.
    const before = await battlesMod.supporterCount(creator.id);
    await prisma.arenaUnlock.updateMany({ data: { atSeats: before + 1 } });
    expect(await battlesMod.checkUnlocks()).toBe(0);

    const fan = await makeUser();
    const market = await prisma.creatorMarket.findUniqueOrThrow({ where: { creatorId: creator.id } });
    await marketMod.buy(fan.id, market.id, 2500);
    expect(await battlesMod.checkUnlocks()).toBe(1);

    const unlock = await prisma.arenaUnlock.findFirstOrThrow();
    expect(unlock.unlocked).toBe(true);
    const fanNote = await prisma.notification.findFirst({
      where: { userId: fan.id, title: { contains: "Unlocked" } },
    });
    expect(fanNote).not.toBeNull();
  });
});
