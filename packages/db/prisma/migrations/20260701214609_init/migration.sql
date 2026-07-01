-- CreateEnum
CREATE TYPE "Role" AS ENUM ('BACKER', 'SCOUT', 'CREATOR', 'ADMIN', 'MODERATOR');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED');

-- CreateEnum
CREATE TYPE "CreatorCategory" AS ENUM ('MUSICIAN', 'INTERNET_CREATOR', 'BUILDER_FOUNDER', 'ARTIST_DESIGNER');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PayoutConfigStatus" AS ENUM ('NOT_CONFIGURED', 'PENDING', 'ACTIVE', 'HELD');

-- CreateEnum
CREATE TYPE "CreatorStatus" AS ENUM ('DRAFT', 'CLAIM_STARTED', 'VERIFICATION_PENDING', 'APPROVED', 'LAUNCHING_SOON', 'LIVE', 'PAUSED', 'SUSPENDED', 'REMOVED');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('UNCLAIMED', 'CLAIM_STARTED', 'CLAIMED');

-- CreateEnum
CREATE TYPE "TakedownStatus" AS ENUM ('NONE', 'REQUESTED', 'UNDER_REVIEW', 'REMOVED');

-- CreateEnum
CREATE TYPE "TakedownRequestStatus" AS ENUM ('RECEIVED', 'UNDER_REVIEW', 'ACTIONED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ModerationDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "NominationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "BountyStatus" AS ENUM ('OPEN', 'LOCKED', 'PAID', 'EXPIRED');

-- CreateEnum
CREATE TYPE "IntentType" AS ENUM ('GENESIS_PASS', 'MISSION_PLEDGE', 'MARKET_BUY', 'BACKSTAGE');

-- CreateEnum
CREATE TYPE "BindingStatus" AS ENUM ('SOFT_INTENT', 'REFUNDABLE_PLEDGE', 'PRE_AUTHORIZED');

-- CreateEnum
CREATE TYPE "PaymentAuthStatus" AS ENUM ('NONE', 'AUTHORIZED', 'CAPTURED', 'RELEASED', 'FAILED');

-- CreateEnum
CREATE TYPE "ConfirmationStatus" AS ENUM ('UNCONFIRMED', 'CONFIRMATION_WINDOW', 'CONFIRMED', 'DECLINED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('NONE', 'PENDING', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ThresholdStatus" AS ENUM ('NOT_READY', 'ALMOST_READY', 'THRESHOLD_MET', 'LAUNCHING_SOON', 'LIVE');

-- CreateEnum
CREATE TYPE "AuctionStatus" AS ENUM ('SCHEDULED', 'COLLECTING', 'CLEARING', 'SETTLED', 'FAILED');

-- CreateEnum
CREATE TYPE "AuctionOrderStatus" AS ENUM ('CONFIRMED', 'FILLED', 'PARTIAL', 'REFUNDED', 'FAILED');

-- CreateEnum
CREATE TYPE "MarketStatus" AS ENUM ('PRE_LAUNCH_DEMAND', 'OPENING_AUCTION', 'GENESIS_CURVE', 'GRADUATION', 'MATURE', 'PAUSED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TxSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "LedgerTxType" AS ENUM ('DEPOSIT', 'PLEDGE_AUTH', 'AUCTION_FILL', 'CURVE_TRADE', 'MISSION_CONTRIBUTION', 'MISSION_ESCROW_RELEASE', 'SUBSCRIPTION', 'DROP_SALE', 'TIP', 'MESSAGE_FEE', 'PAYOUT', 'REFUND', 'MATCH_FUND', 'FEE');

-- CreateEnum
CREATE TYPE "LedgerAccount" AS ENUM ('EXTERNAL', 'USER_CASH', 'CREATOR_EARNED', 'CREATOR_PENDING', 'MISSION_ESCROW', 'PLATFORM_FEES', 'SCOUT_REWARDS', 'MATCH_FUND');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BackstageAccessType" AS ENUM ('PAID', 'HOLDER_GATED', 'FREE');

-- CreateEnum
CREATE TYPE "PostVisibility" AS ENUM ('PUBLIC_PREVIEW', 'MEMBERS', 'HOLDERS');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'REMOVED');

-- CreateEnum
CREATE TYPE "DropStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'LIVE', 'SOLD_OUT', 'REMOVED');

-- CreateEnum
CREATE TYPE "PaidMessageStatus" AS ENUM ('SENT', 'ACCEPTED', 'RESPONDED', 'REJECTED', 'REFUNDED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('REQUESTED', 'COMPLIANCE_REVIEW', 'APPROVED', 'SENT', 'FAILED', 'HELD');

-- CreateEnum
CREATE TYPE "MissionStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'LIVE', 'FUNDED', 'PARTIALLY_FUNDED', 'EXPIRED', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "RefundRule" AS ENUM ('ALL_OR_NOTHING', 'KEEP_WHAT_RAISED');

-- CreateEnum
CREATE TYPE "QuestType" AS ENUM ('SHARE', 'INVITE', 'CONTENT', 'PLAYLIST', 'ENGAGEMENT', 'MEME', 'TRANSLATION', 'FEEDBACK', 'LAUNCH_SUPPORT', 'BRAND_INTRO', 'EVENT');

-- CreateEnum
CREATE TYPE "ProofType" AS ENUM ('LINK', 'SCREENSHOT', 'AUTO');

-- CreateEnum
CREATE TYPE "RewardType" AS ENUM ('XP', 'BADGE', 'POINTS', 'ACCESS', 'DROP', 'SHOUTOUT', 'FEE_REBATE', 'CREW_POINTS');

-- CreateEnum
CREATE TYPE "QuestStatus" AS ENUM ('DRAFT', 'LIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "CompletionStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RosterSource" AS ENUM ('BACKED', 'WATCHING', 'NOMINATED');

-- CreateEnum
CREATE TYPE "CrewRole" AS ENUM ('FOUNDER', 'MEMBER');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('NOMINATION_CREATED', 'CREATOR_CLAIMED', 'THRESHOLD_MET', 'LAUNCH_SCHEDULED', 'AUCTION_SETTLED', 'MARKET_LAUNCHED', 'USER_BACKED', 'MISSION_LAUNCHED', 'MISSION_CONTRIBUTION', 'MISSION_FUNDED', 'MISSION_COMPLETED', 'DROP_RELEASED', 'QUEST_COMPLETED', 'CREW_RANKED_UP', 'CREATOR_MILESTONE', 'DRAFT_RANK_CHANGED');

-- CreateEnum
CREATE TYPE "EventVisibility" AS ENUM ('PUBLIC', 'HOLDERS', 'PRIVATE');

-- CreateEnum
CREATE TYPE "CardTemplate" AS ENUM ('BACKER', 'ROSTER', 'SCOUT', 'CLAIM', 'MISSION', 'BREAKOUT', 'BATTLE', 'BACKER_WALL', 'DRAFT_RANK', 'CREATOR_REVENUE', 'TASTE_SCORE', 'CREW');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('CREATOR_CLAIMED', 'LAUNCH_STARTING', 'AUCTION_CONFIRMATION', 'MISSION_NEAR_FUNDING', 'MISSION_FUNDED', 'BACKSTAGE_POST', 'DROP_RELEASED', 'QUEST_AVAILABLE', 'QUEST_APPROVED', 'CREATOR_MILESTONE', 'ROSTER_UPDATE', 'TASTE_SCORE_UPDATE', 'PAYOUT_UPDATE', 'TRUST_SAFETY_ALERT');

-- CreateEnum
CREATE TYPE "ModerationQueue" AS ENUM ('VERIFICATION', 'DRAFT_MOD', 'CONTENT', 'MISSION_REVIEW', 'PAYOUT_REVIEW');

-- CreateEnum
CREATE TYPE "ModerationItemStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('IMPERSONATION', 'HARASSMENT', 'PROHIBITED_CATEGORY', 'FRAUD', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "FraudSignalType" AS ENUM ('WASH_TRADING', 'BOT_ACTIVITY', 'DUPLICATE_PROFILE', 'PAYMENT_ABUSE');

-- CreateEnum
CREATE TYPE "FraudSignalStatus" AS ENUM ('OPEN', 'CONFIRMED', 'DISMISSED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "email" TEXT,
    "passwordHash" TEXT,
    "walletAddress" TEXT,
    "country" TEXT,
    "roles" "Role"[] DEFAULT ARRAY['BACKER']::"Role"[],
    "referralCode" TEXT NOT NULL,
    "referredByUserId" TEXT,
    "dobAttested18" BOOLEAN NOT NULL DEFAULT false,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "xp" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeType" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sourceRef" TEXT,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBlock" (
    "id" TEXT NOT NULL,
    "blockerUserId" TEXT NOT NULL,
    "blockedUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Creator" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "draftProfileId" TEXT,
    "displayName" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "category" "CreatorCategory" NOT NULL,
    "bio" TEXT,
    "story" TEXT,
    "socialLinks" JSONB,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "payoutStatus" "PayoutConfigStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "fameScore" INTEGER NOT NULL DEFAULT 0,
    "status" "CreatorStatus" NOT NULL DEFAULT 'DRAFT',
    "followerCount" INTEGER NOT NULL DEFAULT 0,
    "followerGrowth7d" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "perks" JSONB,
    "launchKitApproved" BOOLEAN NOT NULL DEFAULT false,
    "safetyApproved" BOOLEAN NOT NULL DEFAULT false,
    "termsAcceptedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "launchAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Creator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftProfile" (
    "id" TEXT NOT NULL,
    "nameOrHandle" TEXT NOT NULL,
    "normalizedHandle" TEXT NOT NULL,
    "externalLink" TEXT,
    "category" "CreatorCategory" NOT NULL,
    "reasonNominated" TEXT,
    "nominatedByUserId" TEXT,
    "fanCount" INTEGER NOT NULL DEFAULT 0,
    "pledgedDemandTotal" INTEGER NOT NULL DEFAULT 0,
    "requestedMission" TEXT,
    "inviteCount" INTEGER NOT NULL DEFAULT 0,
    "claimStatus" "ClaimStatus" NOT NULL DEFAULT 'UNCLAIMED',
    "takedownStatus" "TakedownStatus" NOT NULL DEFAULT 'NONE',
    "moderationStatus" "ModerationDecision" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DraftProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoutNomination" (
    "id" TEXT NOT NULL,
    "scoutUserId" TEXT NOT NULL,
    "draftProfileId" TEXT NOT NULL,
    "creatorHandle" TEXT NOT NULL,
    "category" "CreatorCategory" NOT NULL,
    "thesis" TEXT NOT NULL,
    "requestedMission" TEXT,
    "status" "NominationStatus" NOT NULL DEFAULT 'PENDING',
    "claimResult" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoutNomination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimBounty" (
    "id" TEXT NOT NULL,
    "draftProfileId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "status" "BountyStatus" NOT NULL DEFAULT 'OPEN',
    "paidToUserId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimBounty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TakedownRequest" (
    "id" TEXT NOT NULL,
    "draftProfileId" TEXT,
    "creatorId" TEXT,
    "requesterContact" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "TakedownRequestStatus" NOT NULL DEFAULT 'RECEIVED',
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TakedownRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FanDemandOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "draftProfileId" TEXT,
    "creatorId" TEXT,
    "intentType" "IntentType" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "bindingStatus" "BindingStatus" NOT NULL DEFAULT 'SOFT_INTENT',
    "paymentAuthStatus" "PaymentAuthStatus" NOT NULL DEFAULT 'NONE',
    "confirmationStatus" "ConfirmationStatus" NOT NULL DEFAULT 'UNCONFIRMED',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "refundStatus" "RefundStatus" NOT NULL DEFAULT 'NONE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FanDemandOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaunchThreshold" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "requiredBackers" INTEGER NOT NULL,
    "requiredDemandCents" INTEGER NOT NULL,
    "requiredPerksCount" INTEGER NOT NULL DEFAULT 3,
    "missionConfigured" BOOLEAN NOT NULL DEFAULT false,
    "perksConfigured" BOOLEAN NOT NULL DEFAULT false,
    "creatorVerified" BOOLEAN NOT NULL DEFAULT false,
    "launchKitApproved" BOOLEAN NOT NULL DEFAULT false,
    "safetyApproved" BOOLEAN NOT NULL DEFAULT false,
    "confirmedBackers" INTEGER NOT NULL DEFAULT 0,
    "confirmedDemandCents" INTEGER NOT NULL DEFAULT 0,
    "status" "ThresholdStatus" NOT NULL DEFAULT 'NOT_READY',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LaunchThreshold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpeningAuction" (
    "id" TEXT NOT NULL,
    "creatorMarketId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" "AuctionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "clearingPriceCents" INTEGER,
    "clearingResult" JSONB,
    "failedPaymentCount" INTEGER NOT NULL DEFAULT 0,
    "refundStatus" "RefundStatus" NOT NULL DEFAULT 'NONE',
    "launchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpeningAuction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionOrder" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "demandOrderId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "fillUnits" INTEGER NOT NULL DEFAULT 0,
    "fillAmountCents" INTEGER NOT NULL DEFAULT 0,
    "status" "AuctionOrderStatus" NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuctionOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorMarket" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "status" "MarketStatus" NOT NULL DEFAULT 'PRE_LAUNCH_DEMAND',
    "basePriceCents" INTEGER NOT NULL DEFAULT 100,
    "slopeMilliCents" INTEGER NOT NULL DEFAULT 50,
    "priceCents" INTEGER NOT NULL DEFAULT 100,
    "supplyUnits" INTEGER NOT NULL DEFAULT 0,
    "holderCount" INTEGER NOT NULL DEFAULT 0,
    "volumeTotalCents" INTEGER NOT NULL DEFAULT 0,
    "creatorFeeBps" INTEGER NOT NULL DEFAULT 35,
    "protocolFeeBps" INTEGER NOT NULL DEFAULT 65,
    "scoutFeeBps" INTEGER NOT NULL DEFAULT 10,
    "launchTime" TIMESTAMP(3),
    "pausedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorMarket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "creatorMarketId" TEXT NOT NULL,
    "amountUnits" INTEGER NOT NULL DEFAULT 0,
    "avgEntryCents" INTEGER NOT NULL DEFAULT 0,
    "firstBackedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "backerRank" INTEGER,
    "isGenesis" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketTransaction" (
    "id" TEXT NOT NULL,
    "creatorMarketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "side" "TxSide" NOT NULL,
    "units" INTEGER NOT NULL,
    "grossCents" INTEGER NOT NULL,
    "feeBreakdown" JSONB NOT NULL,
    "priceAfterCents" INTEGER NOT NULL,
    "ledgerTxId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerTx" (
    "id" TEXT NOT NULL,
    "type" "LedgerTxType" NOT NULL,
    "reference" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerTx_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "txId" TEXT NOT NULL,
    "account" "LedgerAccount" NOT NULL,
    "userId" TEXT,
    "creatorId" TEXT,
    "missionId" TEXT,
    "deltaCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackstageTier" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "accessType" "BackstageAccessType" NOT NULL DEFAULT 'PAID',
    "minHoldingUnits" INTEGER NOT NULL DEFAULT 0,
    "benefits" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackstageTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackstageMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "renewsAt" TIMESTAMP(3) NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "canceledAt" TIMESTAMP(3),

    CONSTRAINT "BackstageMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackstagePost" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "preview" TEXT,
    "mediaUrl" TEXT,
    "visibility" "PostVisibility" NOT NULL DEFAULT 'MEMBERS',
    "status" "PostStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackstagePost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Drop" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "previewText" TEXT,
    "priceCents" INTEGER NOT NULL,
    "quantityLimit" INTEGER,
    "soldCount" INTEGER NOT NULL DEFAULT 0,
    "status" "DropStatus" NOT NULL DEFAULT 'DRAFT',
    "revenueCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Drop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DropPurchase" (
    "id" TEXT NOT NULL,
    "dropId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "ledgerTxId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DropPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tip" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "message" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "ledgerTxId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaidMessage" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "response" TEXT,
    "status" "PaidMessageStatus" NOT NULL DEFAULT 'SENT',
    "ledgerTxId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaidMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorRequestItem" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "deliveryDays" INTEGER NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorRequestItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestOrder" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "ledgerTxId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequestOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "rail" TEXT NOT NULL DEFAULT 'DEV',
    "status" "PayoutStatus" NOT NULL DEFAULT 'REQUESTED',
    "reviewedByUserId" TEXT,
    "ledgerTxId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "goalCents" INTEGER NOT NULL,
    "fundedCents" INTEGER NOT NULL DEFAULT 0,
    "matchCents" INTEGER NOT NULL DEFAULT 0,
    "deadline" TIMESTAMP(3) NOT NULL,
    "useOfFunds" TEXT NOT NULL,
    "rewardTiers" JSONB NOT NULL,
    "proofRequirements" TEXT,
    "refundRule" "RefundRule" NOT NULL DEFAULT 'ALL_OR_NOTHING',
    "matchEligible" BOOLEAN NOT NULL DEFAULT false,
    "matchCapCents" INTEGER NOT NULL DEFAULT 0,
    "status" "MissionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionContribution" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "matchCents" INTEGER NOT NULL DEFAULT 0,
    "tierLabel" TEXT,
    "ledgerTxId" TEXT,
    "refunded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionUpdate" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "proofUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchFund" (
    "id" TEXT NOT NULL,
    "seasonName" TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "spentCents" INTEGER NOT NULL DEFAULT 0,
    "matchRatio" DOUBLE PRECISION NOT NULL DEFAULT 0.25,
    "creatorCap" INTEGER NOT NULL DEFAULT 500000,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatchFund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quest" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "QuestType" NOT NULL,
    "proofType" "ProofType" NOT NULL DEFAULT 'LINK',
    "rewardType" "RewardType" NOT NULL DEFAULT 'XP',
    "rewardAmount" INTEGER NOT NULL DEFAULT 10,
    "deadline" TIMESTAMP(3),
    "maxCompletions" INTEGER,
    "completionCount" INTEGER NOT NULL DEFAULT 0,
    "verificationMethod" TEXT NOT NULL DEFAULT 'CREATOR',
    "status" "QuestStatus" NOT NULL DEFAULT 'LIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestCompletion" (
    "id" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "proofRef" TEXT,
    "status" "CompletionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "draftProfileId" TEXT,
    "creatorId" TEXT,
    "source" "RosterSource" NOT NULL DEFAULT 'WATCHING',
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RosterEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Crew" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "CreatorCategory",
    "score" INTEGER NOT NULL DEFAULT 0,
    "missionsFunded" INTEGER NOT NULL DEFAULT 0,
    "questsCompleted" INTEGER NOT NULL DEFAULT 0,
    "creatorsClaimed" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Crew_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrewMember" (
    "id" TEXT NOT NULL,
    "crewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "CrewRole" NOT NULL DEFAULT 'MEMBER',
    "points" INTEGER NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrewMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TasteScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "percentile" DOUBLE PRECISION NOT NULL,
    "rank" INTEGER NOT NULL,
    "drivers" JSONB NOT NULL,
    "weeklyChange" INTEGER NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TasteScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FameScore" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "previousScore" INTEGER NOT NULL DEFAULT 0,
    "drivers" JSONB NOT NULL,
    "categoryPercentile" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FameScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "actorId" TEXT,
    "creatorId" TEXT,
    "draftProfileId" TEXT,
    "relatedObjectId" TEXT,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "visibility" "EventVisibility" NOT NULL DEFAULT 'PUBLIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareCard" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "template" "CardTemplate" NOT NULL,
    "subjectRef" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "stats" JSONB,
    "deepLink" TEXT NOT NULL,
    "moderationStatus" "ModerationDecision" NOT NULL DEFAULT 'APPROVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationItem" (
    "id" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "queue" "ModerationQueue" NOT NULL,
    "status" "ModerationItemStatus" NOT NULL DEFAULT 'PENDING',
    "assigneeUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModerationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterUserId" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "detail" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FraudSignal" (
    "id" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "signal" "FraudSignalType" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "status" "FraudSignalStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FraudSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorType" TEXT NOT NULL DEFAULT 'USER',
    "action" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "requiredBackers" INTEGER NOT NULL DEFAULT 250,
    "requiredDemandCents" INTEGER NOT NULL DEFAULT 1000000,
    "requiredPerksCount" INTEGER NOT NULL DEFAULT 3,
    "genesisPassTiersCents" JSONB NOT NULL DEFAULT '[2500, 10000, 50000]',
    "maxLaunchesPerDay" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeasonConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "UserBadge_userId_idx" ON "UserBadge"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBlock_blockerUserId_blockedUserId_key" ON "UserBlock"("blockerUserId", "blockedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Creator_userId_key" ON "Creator"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Creator_draftProfileId_key" ON "Creator"("draftProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "Creator_handle_key" ON "Creator"("handle");

-- CreateIndex
CREATE INDEX "Creator_status_category_idx" ON "Creator"("status", "category");

-- CreateIndex
CREATE INDEX "DraftProfile_moderationStatus_claimStatus_idx" ON "DraftProfile"("moderationStatus", "claimStatus");

-- CreateIndex
CREATE UNIQUE INDEX "DraftProfile_normalizedHandle_category_key" ON "DraftProfile"("normalizedHandle", "category");

-- CreateIndex
CREATE INDEX "ScoutNomination_scoutUserId_idx" ON "ScoutNomination"("scoutUserId");

-- CreateIndex
CREATE INDEX "ScoutNomination_draftProfileId_idx" ON "ScoutNomination"("draftProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "ClaimBounty_draftProfileId_key" ON "ClaimBounty"("draftProfileId");

-- CreateIndex
CREATE INDEX "TakedownRequest_status_idx" ON "TakedownRequest"("status");

-- CreateIndex
CREATE INDEX "FanDemandOrder_draftProfileId_bindingStatus_idx" ON "FanDemandOrder"("draftProfileId", "bindingStatus");

-- CreateIndex
CREATE INDEX "FanDemandOrder_creatorId_confirmationStatus_idx" ON "FanDemandOrder"("creatorId", "confirmationStatus");

-- CreateIndex
CREATE INDEX "FanDemandOrder_userId_idx" ON "FanDemandOrder"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LaunchThreshold_creatorId_key" ON "LaunchThreshold"("creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "OpeningAuction_creatorMarketId_key" ON "OpeningAuction"("creatorMarketId");

-- CreateIndex
CREATE INDEX "AuctionOrder_auctionId_idx" ON "AuctionOrder"("auctionId");

-- CreateIndex
CREATE INDEX "AuctionOrder_userId_idx" ON "AuctionOrder"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorMarket_creatorId_key" ON "CreatorMarket"("creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorMarket_ticker_key" ON "CreatorMarket"("ticker");

-- CreateIndex
CREATE INDEX "Holding_creatorMarketId_backerRank_idx" ON "Holding"("creatorMarketId", "backerRank");

-- CreateIndex
CREATE UNIQUE INDEX "Holding_userId_creatorMarketId_key" ON "Holding"("userId", "creatorMarketId");

-- CreateIndex
CREATE INDEX "MarketTransaction_creatorMarketId_createdAt_idx" ON "MarketTransaction"("creatorMarketId", "createdAt");

-- CreateIndex
CREATE INDEX "MarketTransaction_userId_idx" ON "MarketTransaction"("userId");

-- CreateIndex
CREATE INDEX "LedgerTx_type_createdAt_idx" ON "LedgerTx"("type", "createdAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_account_userId_idx" ON "LedgerEntry"("account", "userId");

-- CreateIndex
CREATE INDEX "LedgerEntry_account_creatorId_idx" ON "LedgerEntry"("account", "creatorId");

-- CreateIndex
CREATE INDEX "LedgerEntry_account_missionId_idx" ON "LedgerEntry"("account", "missionId");

-- CreateIndex
CREATE INDEX "BackstageTier_creatorId_idx" ON "BackstageTier"("creatorId");

-- CreateIndex
CREATE INDEX "BackstageMembership_creatorId_status_idx" ON "BackstageMembership"("creatorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BackstageMembership_userId_creatorId_key" ON "BackstageMembership"("userId", "creatorId");

-- CreateIndex
CREATE INDEX "BackstagePost_creatorId_status_createdAt_idx" ON "BackstagePost"("creatorId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Drop_creatorId_status_idx" ON "Drop"("creatorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DropPurchase_dropId_userId_key" ON "DropPurchase"("dropId", "userId");

-- CreateIndex
CREATE INDEX "Tip_creatorId_createdAt_idx" ON "Tip"("creatorId", "createdAt");

-- CreateIndex
CREATE INDEX "PaidMessage_creatorId_status_idx" ON "PaidMessage"("creatorId", "status");

-- CreateIndex
CREATE INDEX "CreatorRequestItem_creatorId_idx" ON "CreatorRequestItem"("creatorId");

-- CreateIndex
CREATE INDEX "Payout_creatorId_status_idx" ON "Payout"("creatorId", "status");

-- CreateIndex
CREATE INDEX "Payout_status_idx" ON "Payout"("status");

-- CreateIndex
CREATE INDEX "Mission_creatorId_status_idx" ON "Mission"("creatorId", "status");

-- CreateIndex
CREATE INDEX "Mission_status_deadline_idx" ON "Mission"("status", "deadline");

-- CreateIndex
CREATE INDEX "MissionContribution_missionId_idx" ON "MissionContribution"("missionId");

-- CreateIndex
CREATE INDEX "MissionContribution_userId_idx" ON "MissionContribution"("userId");

-- CreateIndex
CREATE INDEX "MissionUpdate_missionId_createdAt_idx" ON "MissionUpdate"("missionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MatchFund_seasonName_key" ON "MatchFund"("seasonName");

-- CreateIndex
CREATE INDEX "Quest_creatorId_status_idx" ON "Quest"("creatorId", "status");

-- CreateIndex
CREATE INDEX "QuestCompletion_status_idx" ON "QuestCompletion"("status");

-- CreateIndex
CREATE UNIQUE INDEX "QuestCompletion_questId_userId_key" ON "QuestCompletion"("questId", "userId");

-- CreateIndex
CREATE INDEX "RosterEntry_userId_idx" ON "RosterEntry"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterEntry_userId_draftProfileId_key" ON "RosterEntry"("userId", "draftProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterEntry_userId_creatorId_key" ON "RosterEntry"("userId", "creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "Crew_name_key" ON "Crew"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CrewMember_crewId_userId_key" ON "CrewMember"("crewId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CrewMember_userId_key" ON "CrewMember"("userId");

-- CreateIndex
CREATE INDEX "TasteScore_userId_computedAt_idx" ON "TasteScore"("userId", "computedAt");

-- CreateIndex
CREATE INDEX "FameScore_creatorId_computedAt_idx" ON "FameScore"("creatorId", "computedAt");

-- CreateIndex
CREATE INDEX "Event_visibility_createdAt_idx" ON "Event"("visibility", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ShareCard_template_createdAt_idx" ON "ShareCard"("template", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ModerationItem_queue_status_idx" ON "ModerationItem"("queue", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ModerationItem_objectType_objectId_queue_key" ON "ModerationItem"("objectType", "objectId", "queue");

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");

-- CreateIndex
CREATE INDEX "FraudSignal_status_signal_idx" ON "FraudSignal"("status", "signal");

-- CreateIndex
CREATE INDEX "AuditLog_objectType_objectId_createdAt_idx" ON "AuditLog"("objectType", "objectId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonConfig_name_key" ON "SeasonConfig"("name");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_referredByUserId_fkey" FOREIGN KEY ("referredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockerUserId_fkey" FOREIGN KEY ("blockerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockedUserId_fkey" FOREIGN KEY ("blockedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creator" ADD CONSTRAINT "Creator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creator" ADD CONSTRAINT "Creator_draftProfileId_fkey" FOREIGN KEY ("draftProfileId") REFERENCES "DraftProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoutNomination" ADD CONSTRAINT "ScoutNomination_scoutUserId_fkey" FOREIGN KEY ("scoutUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoutNomination" ADD CONSTRAINT "ScoutNomination_draftProfileId_fkey" FOREIGN KEY ("draftProfileId") REFERENCES "DraftProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimBounty" ADD CONSTRAINT "ClaimBounty_draftProfileId_fkey" FOREIGN KEY ("draftProfileId") REFERENCES "DraftProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimBounty" ADD CONSTRAINT "ClaimBounty_paidToUserId_fkey" FOREIGN KEY ("paidToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TakedownRequest" ADD CONSTRAINT "TakedownRequest_draftProfileId_fkey" FOREIGN KEY ("draftProfileId") REFERENCES "DraftProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FanDemandOrder" ADD CONSTRAINT "FanDemandOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FanDemandOrder" ADD CONSTRAINT "FanDemandOrder_draftProfileId_fkey" FOREIGN KEY ("draftProfileId") REFERENCES "DraftProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FanDemandOrder" ADD CONSTRAINT "FanDemandOrder_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaunchThreshold" ADD CONSTRAINT "LaunchThreshold_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningAuction" ADD CONSTRAINT "OpeningAuction_creatorMarketId_fkey" FOREIGN KEY ("creatorMarketId") REFERENCES "CreatorMarket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionOrder" ADD CONSTRAINT "AuctionOrder_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "OpeningAuction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionOrder" ADD CONSTRAINT "AuctionOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionOrder" ADD CONSTRAINT "AuctionOrder_demandOrderId_fkey" FOREIGN KEY ("demandOrderId") REFERENCES "FanDemandOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorMarket" ADD CONSTRAINT "CreatorMarket_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_creatorMarketId_fkey" FOREIGN KEY ("creatorMarketId") REFERENCES "CreatorMarket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketTransaction" ADD CONSTRAINT "MarketTransaction_creatorMarketId_fkey" FOREIGN KEY ("creatorMarketId") REFERENCES "CreatorMarket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketTransaction" ADD CONSTRAINT "MarketTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_txId_fkey" FOREIGN KEY ("txId") REFERENCES "LedgerTx"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackstageTier" ADD CONSTRAINT "BackstageTier_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackstageMembership" ADD CONSTRAINT "BackstageMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackstageMembership" ADD CONSTRAINT "BackstageMembership_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackstageMembership" ADD CONSTRAINT "BackstageMembership_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "BackstageTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackstagePost" ADD CONSTRAINT "BackstagePost_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Drop" ADD CONSTRAINT "Drop_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DropPurchase" ADD CONSTRAINT "DropPurchase_dropId_fkey" FOREIGN KEY ("dropId") REFERENCES "Drop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DropPurchase" ADD CONSTRAINT "DropPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tip" ADD CONSTRAINT "Tip_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tip" ADD CONSTRAINT "Tip_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaidMessage" ADD CONSTRAINT "PaidMessage_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaidMessage" ADD CONSTRAINT "PaidMessage_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorRequestItem" ADD CONSTRAINT "CreatorRequestItem_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestOrder" ADD CONSTRAINT "RequestOrder_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "CreatorRequestItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestOrder" ADD CONSTRAINT "RequestOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionContribution" ADD CONSTRAINT "MissionContribution_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionContribution" ADD CONSTRAINT "MissionContribution_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionUpdate" ADD CONSTRAINT "MissionUpdate_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestCompletion" ADD CONSTRAINT "QuestCompletion_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestCompletion" ADD CONSTRAINT "QuestCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterEntry" ADD CONSTRAINT "RosterEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewMember" ADD CONSTRAINT "CrewMember_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "Crew"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrewMember" ADD CONSTRAINT "CrewMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TasteScore" ADD CONSTRAINT "TasteScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FameScore" ADD CONSTRAINT "FameScore_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareCard" ADD CONSTRAINT "ShareCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
