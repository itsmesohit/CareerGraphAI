import React, { useState } from 'react';
import { UploadCloud, CheckCircle2, ShieldCheck, Sparkles, FileText, ArrowRight } from 'lucide-react';

interface ResumeManagerViewProps {
  onUploadResume: (text: string) => Promise<{ extractedSkills: string[]; extractedFacts: string[] }>;
}

export const ResumeManagerView: React.FC<ResumeManagerViewProps> = ({ onUploadResume }) => {
  const [text, setText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [result, setResult] = useState<{ extractedSkills: string[]; extractedFacts: string[] } | null>(null);

  const handleUpload = async () => {
    if (!text.trim()) return;
    setIsParsing(true);
    try {
      const res = await onUploadResume(text);
      setResult(res);
    } finally {
      setIsParsing(false);
    }
  };

  const loadSample = () => {
    setText(`Alex Rivera
Senior Full Stack & AI Systems Engineer
San Francisco, CA (Open to Remote) | alex.rivera@example.com

SUMMARY:
Senior engineer with 6+ years of experience building graph-powered AI systems, high performance Node.js distributed backends, and responsive React web applications.

WORK EXPERIENCE:
Nexus Graph Intelligence (2023 - Present) | Lead Systems Engineer
- Architected agentic memory graph pipelines using FalkorDB, improving Cypher traversal query speeds by 45%.
- Implemented background task scheduling using Redis and BullMQ for 10k+ concurrent jobs.
- Deployed Docker containers and CI/CD pipelines across AWS cloud.

CloudMatrix Technologies (2021 - 2022) | Senior Full Stack Developer
- Built high-throughput micro-frontends with React, Vite, TypeScript, and Tailwind CSS.
- Modeled PostgreSQL relational data with Prisma and automated Playwright integration tests.

TECHNICAL SKILLS:
Languages & Frameworks: TypeScript, JavaScript, Python, React, Node.js, Express, Next.js
Databases & Cloud: FalkorDB, Redis, PostgreSQL, Prisma, Docker, AWS, GraphQL, REST
Tools & Testing: Playwright, Vitest, Git, BullMQ, Tailwind CSS, AI Agents`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Resume & Evidence Ingestion Manager
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-brand-500/20 text-brand-300 font-medium">
              FalkorDB Evidence Nodes
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Extracts structured skills, work history, and verifiable facts. Verified entities become traversable nodes in your career graph.
          </p>
        </div>

        <button
          onClick={loadSample}
          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs text-brand-300 border border-brand-500/30 transition-colors self-start sm:self-auto"
        >
          Load Verified Sample Resume
        </button>
      </div>

      {/* Editor & Parser */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <UploadCloud className="w-4 h-4 text-brand-400" />
            Resume Text Content
          </h3>

          <textarea
            rows={12}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Paste raw resume text, markdown, or plain text here..."
            className="w-full bg-slate-950 border border-slate-700/80 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 font-mono leading-relaxed"
          />

          <button
            onClick={handleUpload}
            disabled={isParsing || !text.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-brand-500/25 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isParsing ? 'Extracting & Ingesting to Graph...' : 'Parse & Ingest to FalkorDB'}</span>
          </button>
        </div>

        {/* Results Panel */}
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            Extracted Entities & Verification Status
          </h3>

          {result ? (
            <div className="space-y-4">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Extracted Skills ({result.extractedSkills.length})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {result.extractedSkills.map(s => (
                    <span key={s} className="text-xs px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 font-medium">
                      ✓ {s}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Verified Semantic Facts Ingested to FalkorDB
                </span>
                <div className="space-y-2">
                  {result.extractedFacts.map((f, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-slate-500 text-xs">
              Paste or load resume text on the left and click "Parse & Ingest" to see verified graph entities.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
