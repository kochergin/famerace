import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@famerace/db";
import * as callsMod from "../src/modules/calls";
import { makeUser, resetDb } from "./helpers";

async function liveCreator() {
  const owner = await makeUser({ roles: ["CREATOR"] });
  const creator = await prisma.creator.create({
    data: { userId: owner.id, displayName: "MIRA", handle: "mira", category: "MUSICIAN", fameScore: 30, status: "LIVE" },
  });
  return { owner, creator };
}

const givePoints = (userId: string, points: number) =>
  prisma.user.update({ where: { id: userId }, data: { points } });

describe("calls: prediction layer", () => {
  beforeEach(resetDb);

  it("only platform or the creator can open a call; fans cannot", async () => {
    const { owner, creator } = await liveCreator();
    const fan = await makeUser();
    await expect(
      callsMod.createCall(fan.id, { creatorId: creator.id, question: "Will MIRA hit Fame 50 this week on the index?", metric: "FAME_SCORE", threshold: 50 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const call = await callsMod.createCall(owner.id, {
      creatorId: creator.id,
      question: "Will MIRA hit Fame 50 this week on the index?",
      metric: "FAME_SCORE",
      threshold: 50,
    });
    expect(call.status).toBe("OPEN");
  });

  it("stakes move Taste Points, compute the yes share, and block double or overdrawn stakes", async () => {
    const { owner, creator } = await liveCreator();
    const [alice, bob] = await Promise.all([makeUser(), makeUser()]);
    await givePoints(alice.id, 100);
    await givePoints(bob.id, 100);
    const call = await callsMod.createCall(owner.id, {
      creatorId: creator.id,
      question: "Will MIRA reach Fame Score 50 before the deadline?",
      metric: "FAME_SCORE",
      threshold: 50,
    });

    await callsMod.stake(alice.id, call.id, "YES", 60);
    await callsMod.stake(bob.id, call.id, "NO", 40);
    const updated = await prisma.call.findUniqueOrThrow({ where: { id: call.id } });
    expect(callsMod.yesShare(updated)).toBeCloseTo(0.6);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: alice.id } })).points).toBe(40);

    await expect(callsMod.stake(alice.id, call.id, "NO", 10)).rejects.toMatchObject({ code: "ALREADY_STAKED" });
    const poor = await makeUser();
    await expect(callsMod.stake(poor.id, call.id, "YES", 10)).rejects.toMatchObject({ code: "NOT_ENOUGH_POINTS" });
  });

  it("auto-resolves at deadline from the live metric and pays parimutuel with largest remainder", async () => {
    const { owner, creator } = await liveCreator(); // fameScore 30
    const [a, b, c] = await Promise.all([makeUser(), makeUser(), makeUser()]);
    for (const u of [a, b, c]) await givePoints(u.id, 100);

    // Threshold 25 → resolves YES (30 >= 25). a+b on YES, c on NO.
    const call = await callsMod.createCall(owner.id, {
      creatorId: creator.id,
      question: "Will MIRA hold a Fame Score of at least 25 at the deadline?",
      metric: "FAME_SCORE",
      threshold: 25,
      deadlineHours: 1,
    });
    await callsMod.stake(a.id, call.id, "YES", 30);
    await callsMod.stake(b.id, call.id, "YES", 40);
    await callsMod.stake(c.id, call.id, "NO", 50);

    // Nothing resolves before the deadline.
    expect(await callsMod.resolveDueCalls(new Date())).toBe(0);
    const after = new Date(Date.now() + 2 * 3600_000);
    expect(await callsMod.resolveDueCalls(after)).toBe(1);
    // Idempotent: second sweep finds nothing.
    expect(await callsMod.resolveDueCalls(after)).toBe(0);

    const resolved = await prisma.call.findUniqueOrThrow({ where: { id: call.id } });
    expect(resolved.status).toBe("RESOLVED_YES");
    expect(resolved.resolvedValue).toBe(30);

    // Losing pool = 50 split 30:40 → 21.43/28.57 → floors 21+28, remainder 1
    // goes to the larger fractional share (a at .43 vs b at .57 → b).
    const stakes = await prisma.callStake.findMany({ where: { callId: call.id } });
    const payoutOf = (userId: string) => stakes.find((s) => s.userId === userId)!.payout;
    expect(payoutOf(a.id) + payoutOf(b.id)).toBe(30 + 40 + 50); // every point accounted for
    expect(payoutOf(c.id)).toBe(0);
    expect(payoutOf(a.id)).toBe(30 + 21);
    expect(payoutOf(b.id)).toBe(40 + 29);

    // Balances updated (started 100, staked, paid out).
    expect((await prisma.user.findUniqueOrThrow({ where: { id: a.id } })).points).toBe(100 - 30 + 51);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: c.id } })).points).toBe(50);

    const record = await callsMod.callRecord(a.id);
    expect(record).toEqual({ wins: 1, losses: 0, netPoints: 21 });
  });

  it("refunds everyone when nobody staked the winning side", async () => {
    const { owner, creator } = await liveCreator(); // fameScore 30
    const a = await makeUser();
    await givePoints(a.id, 100);
    const call = await callsMod.createCall(owner.id, {
      creatorId: creator.id,
      question: "Will MIRA reach a Fame Score of 90 before this closes?",
      metric: "FAME_SCORE",
      threshold: 90,
      deadlineHours: 1,
    });
    await callsMod.stake(a.id, call.id, "YES", 80); // resolves NO, no NO stakers
    await callsMod.resolveDueCalls(new Date(Date.now() + 2 * 3600_000));
    expect((await prisma.user.findUniqueOrThrow({ where: { id: a.id } })).points).toBe(100);
    const stakeRow = await prisma.callStake.findFirstOrThrow({ where: { callId: call.id } });
    expect(stakeRow.payout).toBe(80);
  });
});

describe("calls: auto-calls and flip alerts", () => {
  beforeEach(resetDb);

  it("ensureAutoCalls opens one call per fresh market, idempotently", async () => {
    const owner = await makeUser({ roles: ["CREATOR"] });
    const creator = await prisma.creator.create({
      data: { userId: owner.id, displayName: "MIRA", handle: "mira", category: "MUSICIAN", status: "LIVE" },
    });
    await prisma.creatorMarket.create({
      data: { creatorId: creator.id, ticker: "MIRA", status: "GENESIS_CURVE", priceCents: 100, holderCount: 3, supplyUnits: 100 },
    });
    expect(await callsMod.ensureAutoCalls()).toBe(1);
    expect(await callsMod.ensureAutoCalls()).toBe(0); // idempotent
    const call = await prisma.call.findFirstOrThrow({ where: { creatorId: creator.id } });
    expect(call.metric).toBe("HOLDER_COUNT");
    expect(call.threshold).toBe(10); // max(10, holders*2)
  });

  it("notifies existing stakers when the majority flips", async () => {
    const owner = await makeUser({ roles: ["CREATOR"] });
    const creator = await prisma.creator.create({
      data: { userId: owner.id, displayName: "MIRA", handle: "mira", category: "MUSICIAN", fameScore: 30, status: "LIVE" },
    });
    const [a, b] = await Promise.all([makeUser(), makeUser()]);
    await prisma.user.updateMany({ where: { id: { in: [a.id, b.id] } }, data: { points: 200 } });
    const call = await callsMod.createCall(owner.id, {
      creatorId: creator.id,
      question: "Will MIRA hold a Fame Score of 25 through the weekend?",
      metric: "FAME_SCORE",
      threshold: 25,
    });
    await callsMod.stake(a.id, call.id, "YES", 40); // 100% yes
    await callsMod.stake(b.id, call.id, "NO", 100); // flips majority to NO
    const alerts = await prisma.notification.findMany({ where: { userId: a.id } });
    expect(alerts.some((n) => n.title.includes("flipped to NO"))).toBe(true);
    // No alert for the staker who caused the flip.
    expect(await prisma.notification.count({ where: { userId: b.id } })).toBe(0);
  });
});
