import { prisma } from "@famerace/db";
import { DomainError } from "../errors";

// Avatar media pipeline. Bytes live in the database (MediaAsset) and are
// served by the web app from /img/<id>; avatarUrl columns store that path.
// DraftProfile is intentionally not a valid target — unclaimed people stay
// name-only until they claim (consent gate, PRD §2 / §9A.2).

export const MAX_AVATAR_BYTES = 4 * 1024 * 1024;

const MAGIC: { mime: string; test: (b: Uint8Array) => boolean }[] = [
  { mime: "image/png", test: (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: "image/jpeg", test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: "image/webp",
    test: (b) =>
      b.length > 12 &&
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
];

/** Sniff the real content type from magic bytes — never trust the client mime. */
export function sniffImageMime(bytes: Uint8Array): string | null {
  return MAGIC.find((m) => m.test(bytes))?.mime ?? null;
}

/**
 * Store an uploaded avatar and point the target's avatarUrl at it.
 * target "user" updates the caller's own avatar; "creator" requires the
 * caller to own a creator profile and updates its public avatar.
 */
export async function storeAvatar(
  userId: string,
  input: { bytes: Uint8Array; declaredMime?: string },
  target: "user" | "creator",
): Promise<{ assetId: string; url: string }> {
  if (input.bytes.length === 0) throw new DomainError("EMPTY_FILE", "That file is empty");
  if (input.bytes.length > MAX_AVATAR_BYTES) {
    throw new DomainError("FILE_TOO_LARGE", "Avatar must be 4MB or less");
  }
  const mime = sniffImageMime(input.bytes);
  if (!mime) throw new DomainError("BAD_IMAGE", "Avatar must be a PNG, JPEG or WebP image");

  let creatorId: string | null = null;
  if (target === "creator") {
    const creator = await prisma.creator.findUnique({ where: { userId }, select: { id: true } });
    if (!creator) throw new DomainError("NOT_A_CREATOR", "No creator profile for this account");
    creatorId = creator.id;
  }

  const asset = await prisma.mediaAsset.create({
    data: { ownerUserId: userId, kind: "AVATAR", mime, bytes: Buffer.from(input.bytes) },
    select: { id: true },
  });
  const url = `/img/${asset.id}`;
  if (creatorId) {
    await prisma.creator.update({ where: { id: creatorId }, data: { avatarUrl: url } });
  } else {
    await prisma.user.update({ where: { id: userId }, data: { avatarUrl: url } });
  }
  return { assetId: asset.id, url };
}

/** Fetch asset bytes for serving. */
export async function getAsset(id: string) {
  return prisma.mediaAsset.findUnique({ where: { id } });
}

/**
 * Can this viewer see the SHARP asset? Avatars are public; POST/DROP media is
 * the paywalled product — CSS blur is not access control, this is. (The
 * blurred /img/:id/blur variant stays public: it IS the tease.)
 */
export async function canViewSharp(
  asset: { id: string; kind: string; ownerUserId: string },
  viewerUserId: string | null,
): Promise<boolean> {
  if (asset.kind === "AVATAR") return true;
  if (viewerUserId === asset.ownerUserId) return true;
  const url = `/img/${asset.id}`;

  if (asset.kind === "POST") {
    const post = await prisma.backstagePost.findFirst({
      where: { mediaUrl: url },
      include: { creator: { select: { id: true, userId: true } } },
    });
    if (!post) return false; // orphaned upload: only the owner (handled above)
    if (post.visibility === "PUBLIC_PREVIEW") return true;
    if (!viewerUserId) return false;
    if (post.creator.userId === viewerUserId) return true;
    const membership = await prisma.backstageMembership.findUnique({
      where: { userId_creatorId: { userId: viewerUserId, creatorId: post.creatorId } },
    });
    const isMember =
      membership != null &&
      (membership.status === "ACTIVE" || (membership.status === "CANCELED" && membership.renewsAt > new Date()));
    if (post.visibility === "MEMBERS" && isMember) return true;
    const market = await prisma.creatorMarket.findUnique({ where: { creatorId: post.creatorId } });
    if (!market) return false;
    const holding = await prisma.holding.findUnique({
      where: { userId_creatorMarketId: { userId: viewerUserId, creatorMarketId: market.id } },
    });
    return (holding?.amountUnits ?? 0) > 0;
  }

  if (asset.kind === "DROP") {
    const drop = await prisma.drop.findFirst({
      where: { mediaUrl: url },
      include: { creator: { select: { userId: true } } },
    });
    if (!drop) return false;
    if (drop.creator.userId === viewerUserId) return true;
    if (!viewerUserId) return false;
    const purchase = await prisma.dropPurchase.findUnique({
      where: { dropId_userId: { dropId: drop.id, userId: viewerUserId } },
    });
    return purchase !== null;
  }

  return false;
}

/**
 * Store a content image (backstage post / drop media) and return its URL.
 * Same validation as avatars; ownership stays with the uploading user.
 */
export async function storeMedia(
  userId: string,
  input: { bytes: Uint8Array; declaredMime?: string },
  kind: "POST" | "DROP",
): Promise<{ assetId: string; url: string }> {
  if (input.bytes.length === 0) throw new DomainError("EMPTY_FILE", "That file is empty");
  if (input.bytes.length > MAX_AVATAR_BYTES) {
    throw new DomainError("FILE_TOO_LARGE", "Media must be 4MB or less");
  }
  const mime = sniffImageMime(input.bytes);
  if (!mime) throw new DomainError("BAD_IMAGE", "Media must be a PNG, JPEG or WebP image");
  const asset = await prisma.mediaAsset.create({
    data: { ownerUserId: userId, kind, mime, bytes: Buffer.from(input.bytes) },
    select: { id: true },
  });
  return { assetId: asset.id, url: `/img/${asset.id}` };
}
