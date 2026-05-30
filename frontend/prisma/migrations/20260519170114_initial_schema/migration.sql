-- CreateEnum
CREATE TYPE "EntityKind" AS ENUM ('jurisdiction', 'domain', 'team', 'product');

-- CreateEnum
CREATE TYPE "TimeBucket" AS ENUM ('NOW', 'NEXT', 'LATER');

-- CreateEnum
CREATE TYPE "ProductStage" AS ENUM ('discovery', 'alpha', 'beta', 'live', 'retiring', 'retired');

-- CreateTable
CREATE TABLE "Jurisdiction" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Jurisdiction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductDomain" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "jurisdictionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Theme" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "domainId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Theme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "contact" TEXT,
    "domainId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "stage" "ProductStage" NOT NULL DEFAULT 'discovery',
    "domainId" TEXT NOT NULL,
    "operatingTeamId" TEXT NOT NULL,
    "lastApprovedAt" TIMESTAMP(3),
    "lastApprovedBy" TEXT,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Initiative" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "bucket" "TimeBucket" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "outboundUrl" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Initiative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundLink" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OutboundLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "entityKind" "EntityKind" NOT NULL,
    "entityId" TEXT,
    "submitter" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceMarkdown" BYTEA NOT NULL,
    "sourceMarkdownSha" TEXT NOT NULL,
    "aiParsedOutput" JSONB,
    "aiConfidenceFlags" JSONB,
    "approver" TEXT,
    "approvedAt" TIMESTAMP(3),
    "versionNumber" INTEGER,
    "notes" TEXT,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ConsumedByJurisdiction" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ConsumedByJurisdiction_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Jurisdiction_slug_key" ON "Jurisdiction"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProductDomain_slug_key" ON "ProductDomain"("slug");

-- CreateIndex
CREATE INDEX "ProductDomain_jurisdictionId_idx" ON "ProductDomain"("jurisdictionId");

-- CreateIndex
CREATE INDEX "Theme_domainId_idx" ON "Theme"("domainId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_slug_key" ON "Team"("slug");

-- CreateIndex
CREATE INDEX "Team_domainId_idx" ON "Team"("domainId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_domainId_idx" ON "Product"("domainId");

-- CreateIndex
CREATE INDEX "Product_operatingTeamId_idx" ON "Product"("operatingTeamId");

-- CreateIndex
CREATE INDEX "Initiative_productId_bucket_idx" ON "Initiative"("productId", "bucket");

-- CreateIndex
CREATE INDEX "OutboundLink_productId_idx" ON "OutboundLink"("productId");

-- CreateIndex
CREATE INDEX "Submission_entityKind_entityId_idx" ON "Submission"("entityKind", "entityId");

-- CreateIndex
CREATE INDEX "Submission_sourceMarkdownSha_idx" ON "Submission"("sourceMarkdownSha");

-- CreateIndex
CREATE INDEX "_ConsumedByJurisdiction_B_index" ON "_ConsumedByJurisdiction"("B");

-- AddForeignKey
ALTER TABLE "ProductDomain" ADD CONSTRAINT "ProductDomain_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "Jurisdiction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Theme" ADD CONSTRAINT "Theme_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "ProductDomain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "ProductDomain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "ProductDomain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_operatingTeamId_fkey" FOREIGN KEY ("operatingTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Initiative" ADD CONSTRAINT "Initiative_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundLink" ADD CONSTRAINT "OutboundLink_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ConsumedByJurisdiction" ADD CONSTRAINT "_ConsumedByJurisdiction_A_fkey" FOREIGN KEY ("A") REFERENCES "Jurisdiction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ConsumedByJurisdiction" ADD CONSTRAINT "_ConsumedByJurisdiction_B_fkey" FOREIGN KEY ("B") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
