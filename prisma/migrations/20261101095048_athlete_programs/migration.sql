-- AlterTable
ALTER TABLE "AthleteProfile" ADD COLUMN     "programs" "DanceSportProgram"[] DEFAULT ARRAY[]::"DanceSportProgram"[];
