-- AlterTable
ALTER TABLE "lit_type" ADD COLUMN     "cardCompiled" TEXT,
ADD COLUMN     "cardSource" TEXT,
ADD COLUMN     "rendererSvelteVersion" TEXT,
ADD COLUMN     "rowCompiled" TEXT,
ADD COLUMN     "rowSource" TEXT;
