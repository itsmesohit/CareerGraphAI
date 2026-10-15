import { prisma } from '../index.js';
import { graphOps } from './queries.js';

async function main() {
  const args = process.argv.slice(2);
  const candidateIdArgIndex = args.indexOf('--candidateId');
  const candidateId = candidateIdArgIndex !== -1 ? args[candidateIdArgIndex + 1] : null;

  console.log('🔄 Starting CareerGraph graph rebuild...');

  if (candidateId) {
    console.log(`👤 Rebuilding graph for candidate ${candidateId}...`);
    const res = await graphOps.rebuildCandidateGraph(candidateId, prisma);
    console.log(`✅ Completed rebuild for candidate ${candidateId}: ${res.nodesProjected} nodes projected.`);
  } else {
    console.log('👥 Scanning all candidate profiles in PostgreSQL...');
    const profiles = await prisma.candidateProfile.findMany({
      select: { userId: true },
    });

    console.log(`Found ${profiles.length} candidate profile(s) to rebuild.`);
    let totalNodes = 0;

    for (const p of profiles) {
      console.log(`- Projecting candidate: ${p.userId}`);
      const res = await graphOps.rebuildCandidateGraph(p.userId, prisma);
      totalNodes += res.nodesProjected;
    }

    const stats = await graphOps.getStats();
    console.log(`🎉 Graph rebuild finished! Total nodes projected: ${totalNodes}. Graph stats:`, stats);
  }

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('❌ Error during graph rebuild:', err);
  await prisma.$disconnect();
  process.exit(1);
});
