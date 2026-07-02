import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@famerace/db";
import * as mediaMod from "../src/modules/media";
import { makeUser, resetDb } from "./helpers";

// Smallest valid PNG (1×1 transparent pixel).
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

describe("media: avatar pipeline", () => {
  beforeEach(resetDb);

  it("stores a real PNG, sniffs the mime, and points the user's avatarUrl at /img/<id>", async () => {
    const user = await makeUser();
    const { assetId, url } = await mediaMod.storeAvatar(user.id, { bytes: PNG_1PX }, "user");
    expect(url).toBe(`/img/${assetId}`);

    const asset = await mediaMod.getAsset(assetId);
    expect(asset?.mime).toBe("image/png");
    expect(Buffer.from(asset!.bytes).equals(PNG_1PX)).toBe(true);

    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(fresh.avatarUrl).toBe(url);
  });

  it("rejects bytes that are not a real image, whatever the client claims", async () => {
    const user = await makeUser();
    await expect(
      mediaMod.storeAvatar(user.id, { bytes: Buffer.from("<svg onload=alert(1)>"), declaredMime: "image/png" }, "user"),
    ).rejects.toMatchObject({ code: "BAD_IMAGE" });
  });

  it("rejects oversize uploads", async () => {
    const user = await makeUser();
    const huge = Buffer.concat([PNG_1PX, Buffer.alloc(mediaMod.MAX_AVATAR_BYTES)]);
    await expect(mediaMod.storeAvatar(user.id, { bytes: huge }, "user")).rejects.toMatchObject({
      code: "FILE_TOO_LARGE",
    });
  });

  it("creator target requires owning a creator profile and updates the creator, not the user", async () => {
    const fan = await makeUser();
    await expect(mediaMod.storeAvatar(fan.id, { bytes: PNG_1PX }, "creator")).rejects.toMatchObject({
      code: "NOT_A_CREATOR",
    });

    const owner = await makeUser({ roles: ["CREATOR"] });
    const creator = await prisma.creator.create({
      data: { userId: owner.id, displayName: "MIRA", handle: "mira", category: "MUSICIAN" },
    });
    const { url } = await mediaMod.storeAvatar(owner.id, { bytes: PNG_1PX }, "creator");
    const [freshCreator, freshUser] = await Promise.all([
      prisma.creator.findUniqueOrThrow({ where: { id: creator.id } }),
      prisma.user.findUniqueOrThrow({ where: { id: owner.id } }),
    ]);
    expect(freshCreator.avatarUrl).toBe(url);
    expect(freshUser.avatarUrl).toBeNull();
  });
});
