import { beforeEach, describe, expect, it } from "vitest";
import * as draftMod from "../src/modules/draft";
import * as usersMod from "../src/modules/users";
import { makeUser, resetDb } from "./helpers";

describe("security hardening", () => {
  beforeEach(resetDb);

  it("rejects javascript: URLs in nominations (rendered as <a href>)", async () => {
    const scout = await makeUser();
    await expect(
      draftMod.nominate(scout.id, {
        nameOrHandle: "EVIL",
        category: "MUSICIAN",
        thesis: "A perfectly reasonable-looking nomination with a poisoned link.",
        externalLink: "javascript:alert(document.cookie)",
      }),
    ).rejects.toThrow();
    // https stays allowed
    const ok = await draftMod.nominate(scout.id, {
      nameOrHandle: "FINE",
      category: "MUSICIAN",
      thesis: "A perfectly reasonable nomination with a normal link.",
      externalLink: "https://tiktok.com/@fine",
    });
    expect(ok.profile.externalLink).toBe("https://tiktok.com/@fine");
  });

  it("locks logins after repeated failures", async () => {
    await usersMod.signup({
      username: "locky",
      email: "locky@test.dev",
      password: "correct-horse-1",
      displayName: "Locky",
      dobAttested18: true,
    });
    for (let i = 0; i < 5; i += 1) {
      await expect(usersMod.login("locky", "wrong-password")).rejects.toMatchObject({ code: "BAD_CREDENTIALS" });
    }
    // Sixth attempt hits the lockout — even with the right password.
    await expect(usersMod.login("locky", "correct-horse-1")).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });
});

describe("paywalled media access", () => {
  beforeEach(resetDb);

  it("locks sharp POST media to members/holders; avatars stay public", async () => {
    const { prisma } = await import("@famerace/db");
    const mediaMod = await import("../src/modules/media");
    const owner = await makeUser({ roles: ["CREATOR"] });
    const creator = await prisma.creator.create({
      data: { userId: owner.id, displayName: "MIRA", handle: "mira", category: "MUSICIAN", status: "LIVE" },
    });
    const PNG = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
      "base64",
    );
    const { assetId, url } = await mediaMod.storeMedia(owner.id, { bytes: PNG }, "POST");
    await prisma.backstagePost.create({
      data: { creatorId: creator.id, title: "Locked stills", body: "Members only", visibility: "MEMBERS", mediaUrl: url },
    });
    const asset = (await mediaMod.getAsset(assetId))!;

    const stranger = await makeUser();
    expect(await mediaMod.canViewSharp(asset, null)).toBe(false);
    expect(await mediaMod.canViewSharp(asset, stranger.id)).toBe(false);
    expect(await mediaMod.canViewSharp(asset, owner.id)).toBe(true);

    // A holder unlocks MEMBERS media (holder-gated Backstage, PRD §9.7).
    const market = await prisma.creatorMarket.create({
      data: { creatorId: creator.id, ticker: "MIRA", status: "GENESIS_CURVE", priceCents: 100, supplyUnits: 10, holderCount: 1 },
    });
    await prisma.holding.create({
      data: { userId: stranger.id, creatorMarketId: market.id, amountUnits: 2, avgEntryCents: 100 },
    });
    expect(await mediaMod.canViewSharp(asset, stranger.id)).toBe(true);

    // Avatars are always public.
    const avatar = await mediaMod.storeAvatar(owner.id, { bytes: PNG }, "user");
    const avatarAsset = (await mediaMod.getAsset(avatar.assetId))!;
    expect(await mediaMod.canViewSharp(avatarAsset, null)).toBe(true);
  });
});
