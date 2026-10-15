import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../api/client.js';
import {
  CandidateProfileDTO,
  ProfileCompletenessDTO,
  CanonicalQuestionDTO,
  CandidateAnswerDTO,
  ExperienceInput,
  EducationInput,
  SkillInput,
  ResumeAtsReportDto,
} from '@careergraph/shared';
import {
  User,
  Briefcase,
  GraduationCap,
  Wrench,
  Sliders,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Sparkles,
  ExternalLink,
  Save,
  Loader2,
  Search,
  Filter,
  ShieldCheck,
  Check,
  Gauge,
  FileText,
  Video,
  Image as ImageIcon,
  RefreshCw,
  Upload,
  Lightbulb,
  Mail,
} from 'lucide-react';

/** ATS score → ring & grade colors (light theme) */
function atsScoreColor(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#0ea5e9';
  if (score >= 40) return '#f59e0b';
  return '#f43f5e';
}

export const ProfileManager: React.FC = () => {
  const { accessToken } = useAuth();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<CandidateProfileDTO | null>(null);
  const [completeness, setCompleteness] = useState<ProfileCompletenessDTO | null>(null);
  const [activeTab, setActiveTab] = useState<'basics' | 'experience' | 'education' | 'skills' | 'resume' | 'assets' | 'preferences' | 'questions'>('basics');

  // Resume ATS state (Phase 16)
  const [atsReport, setAtsReport] = useState<ResumeAtsReportDto | null>(null);
  const [atsCheckedAt, setAtsCheckedAt] = useState<string | null>(null);
  const [atsChecking, setAtsChecking] = useState(false);
  const [resumeUploading, setResumeUploading] = useState(false);

  // Profile assets state (Phase 16)
  const [coverLetterText, setCoverLetterText] = useState('');
  const [videoIntroUrl, setVideoIntroUrl] = useState('');
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [assetsSaving, setAssetsSaving] = useState(false);
  const [assetsSaved, setAssetsSaved] = useState(false);

  // Question bank state
  const [questions, setQuestions] = useState<CanonicalQuestionDTO[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [questionSearch, setQuestionSearch] = useState('');

  // Editing state
  const [editingBasics, setEditingBasics] = useState(false);
  const [basicsForm, setBasicsForm] = useState({
    fullName: '',
    headline: '',
    phone: '',
    locationCity: '',
    locationState: '',
    locationCountry: '',
    linkedinUrl: '',
    githubUrl: '',
    portfolioUrl: '',
  });

  // New experience form modal
  const [showAddExp, setShowAddExp] = useState(false);
  const [newExp, setNewExp] = useState<ExperienceInput>({
    company: '',
    title: '',
    location: '',
    employmentType: 'Full-time',
    startDate: '',
    endDate: '',
    isCurrent: false,
    description: '',
    metrics: [],
    technologies: [],
    source: 'USER_INPUT',
    verificationStatus: 'USER_VERIFIED',
  });
  const [metricsText, setMetricsText] = useState('');
  const [techText, setTechText] = useState('');

  // New education form modal
  const [showAddEdu, setShowAddEdu] = useState(false);
  const [newEdu, setNewEdu] = useState<EducationInput>({
    institution: '',
    degree: '',
    field: '',
    startDate: '',
    endDate: '',
    gradeOrCgpa: '',
    source: 'USER_INPUT',
    verificationStatus: 'USER_VERIFIED',
  });

  // New skill input
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillCategory, setNewSkillCategory] = useState('Languages');

  const loadData = async () => {
    if (!accessToken) return;
    try {
      const [profRes, compRes, qRes, aRes] = await Promise.all([
        api.getProfile(accessToken),
        api.getCompleteness(accessToken),
        api.getQuestions(), // all 150 questions
        api.getAnswers(accessToken),
      ]);

      setProfile(profRes.profile);
      setCompleteness(compRes.completeness);
      setQuestions(qRes.questions);

      if (profRes.profile) {
        setBasicsForm({
          fullName: profRes.profile.fullName || '',
          headline: profRes.profile.headline || '',
          phone: profRes.profile.phone || '',
          locationCity: profRes.profile.locationCity || '',
          locationState: profRes.profile.locationState || '',
          locationCountry: profRes.profile.locationCountry || '',
          linkedinUrl: profRes.profile.linkedinUrl || '',
          githubUrl: profRes.profile.githubUrl || '',
          portfolioUrl: profRes.profile.portfolioUrl || '',
        });
        // Assets form state (Phase 16)
        setCoverLetterText(profRes.profile.coverLetterText || '');
        setVideoIntroUrl(profRes.profile.videoIntroUrl || '');
        setProfilePictureUrl(profRes.profile.profilePictureUrl || '');
      }

      // Latest stored ATS report (best-effort; silently empty when none yet)
      try {
        const atsRes = await api.getLatestResumeAts(accessToken);
        setAtsReport(atsRes.latest?.report ?? null);
        setAtsCheckedAt(atsRes.latest?.checkedAt ?? null);
      } catch {
        setAtsReport(null);
        setAtsCheckedAt(null);
      }

      if (aRes.answers) {
        const map: Record<string, string> = {};
        aRes.answers.forEach((a: CandidateAnswerDTO) => {
          map[a.questionKey] = a.value;
        });
        setAnswers(map);
      }
    } catch (e) {
      console.error('Failed to load profile data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [accessToken]);

  // ---- Resume ATS handlers (Phase 16) ----
  const handleResumeUpload = async (file: File) => {
    if (!accessToken || !file) return;
    setResumeUploading(true);
    try {
      await api.uploadResume(file, accessToken);
      // Immediately run the ATS checker so the score shows right away
      const atsRes = await api.checkResumeAts(accessToken);
      setAtsReport(atsRes.report);
      setAtsCheckedAt(atsRes.report.checkedAt);
      await loadData();
    } catch (e: any) {
      console.error('Resume upload failed:', e);
      alert(e?.message || 'Failed to upload resume.');
    } finally {
      setResumeUploading(false);
    }
  };

  const handleRunAtsCheck = async () => {
    if (!accessToken) return;
    setAtsChecking(true);
    try {
      const atsRes = await api.checkResumeAts(accessToken);
      setAtsReport(atsRes.report);
      setAtsCheckedAt(atsRes.report.checkedAt);
      await loadData();
    } catch (e: any) {
      console.error('ATS check failed:', e);
      alert(e?.message || 'No resume on record. Please upload one first.');
    } finally {
      setAtsChecking(false);
    }
  };

  // ---- Profile assets handlers (Phase 16) ----
  const handlePictureSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Profile picture must be under 2MB.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setProfilePictureUrl(String(reader.result));
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveAssets = async () => {
    if (!accessToken) return;
    setAssetsSaving(true);
    setAssetsSaved(false);
    try {
      await api.updateProfileAssets(
        {
          coverLetterText,
          videoIntroUrl,
          profilePictureUrl,
        },
        accessToken
      );
      await loadData();
      setAssetsSaved(true);
      setTimeout(() => setAssetsSaved(false), 2500);
    } catch (e: any) {
      console.error('Assets save failed:', e);
      alert(e?.message || 'Failed to save assets.');
    } finally {
      setAssetsSaving(false);
    }
  };

  const handleSaveBasics = async () => {
    if (!accessToken) return;
    try {
      await api.updateProfileBasics(basicsForm, accessToken);
      setEditingBasics(false);
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleFactVerification = async (
    factType: string,
    factId: string,
    currentStatus: string
  ) => {
    if (!accessToken) return;
    const nextStatus = currentStatus === 'USER_VERIFIED' ? 'UNVERIFIED' : 'USER_VERIFIED';
    try {
      await api.verifyFact(factType, factId, nextStatus, accessToken);
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddExperience = async () => {
    if (!accessToken || !newExp.company || !newExp.title) return;
    try {
      const payload: ExperienceInput = {
        ...newExp,
        metrics: metricsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        technologies: techText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      };
      await api.addExperience(payload, accessToken);
      setShowAddExp(false);
      setNewExp({
        company: '',
        title: '',
        location: '',
        employmentType: 'Full-time',
        startDate: '',
        endDate: '',
        isCurrent: false,
        description: '',
        metrics: [],
        technologies: [],
        source: 'USER_INPUT',
        verificationStatus: 'USER_VERIFIED',
      });
      setMetricsText('');
      setTechText('');
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteExperience = async (id: string) => {
    if (!accessToken) return;
    try {
      await api.deleteExperience(id, accessToken);
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddEducation = async () => {
    if (!accessToken || !newEdu.institution || !newEdu.degree) return;
    try {
      await api.addEducation(newEdu, accessToken);
      setShowAddEdu(false);
      setNewEdu({
        institution: '',
        degree: '',
        field: '',
        startDate: '',
        endDate: '',
        gradeOrCgpa: '',
        source: 'USER_INPUT',
        verificationStatus: 'USER_VERIFIED',
      });
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteEducation = async (id: string) => {
    if (!accessToken) return;
    try {
      await api.deleteEducation(id, accessToken);
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddSkill = async () => {
    if (!accessToken || !newSkillName.trim()) return;
    try {
      await api.addSkill(
        {
          name: newSkillName.trim(),
          category: newSkillCategory,
          proficiency: 'Proficient',
          yearsExperience: 2,
          source: 'USER_INPUT',
          verificationStatus: 'USER_VERIFIED',
        },
        accessToken
      );
      setNewSkillName('');
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteSkill = async (id: string) => {
    if (!accessToken) return;
    try {
      await api.deleteSkill(id, accessToken);
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveSingleAnswer = async (key: string, value: string) => {
    if (!accessToken) return;
    try {
      await api.saveAnswers(
        [{ questionKey: key, value, scope: 'GLOBAL', verificationStatus: 'USER_VERIFIED' }],
        accessToken
      );
      setAnswers((prev) => ({ ...prev, [key]: value }));
      const compRes = await api.getCompleteness(accessToken);
      setCompleteness(compRes.completeness);
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
        <span className="text-sm font-mono">Loading Candidate Career Profile...</span>
      </div>
    );
  }

  const score = completeness?.score || 0;
  const filteredQuestions = questions.filter((q) => {
    const matchesCategory = selectedCategory === 'ALL' || q.category === selectedCategory;
    const matchesSearch =
      !questionSearch ||
      q.questionText.toLowerCase().includes(questionSearch.toLowerCase()) ||
      q.key.toLowerCase().includes(questionSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Completeness Meter Card */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-5 w-full md:w-auto">
          {/* Circular Score Badge */}
          <div className="relative w-20 h-20 flex-shrink-0 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-slate-800"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className={`${
                  score >= 80 ? 'text-emerald-500' : score >= 50 ? 'text-sky-500' : 'text-amber-500'
                }`}
                strokeDasharray={`${score}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-black text-slate-900">{score}%</span>
              <span className="text-[9px] uppercase font-bold text-slate-500">Profile</span>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">CareerGraph Completeness</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-600 border border-sky-500/20">
                {score >= 80 ? 'Auto-Apply Ready' : 'Optimization Recommended'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-md">
              Higher completeness and verified facts directly boost ATS match scores and accuracy of agent applications.
            </p>
          </div>
        </div>

        {/* Suggestions Panel */}
        {completeness && completeness.suggestions.length > 0 && (
          <div className="w-full md:w-1/2 p-3 bg-slate-100 rounded-xl border border-slate-300/80">
            <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <Sparkles className="w-3.5 h-3.5" /> High-Impact Action Items:
            </span>
            <ul className="space-y-1">
              {completeness.suggestions.slice(0, 3).map((sugg, i) => (
                <li key={i} className="text-xs text-slate-700 flex items-start gap-1.5">
                  <span className="text-amber-600">•</span>
                  <span>{sugg}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-300 pb-3 overflow-x-auto">
        {[
          { id: 'basics', label: 'Basics & Links', icon: User },
          { id: 'experience', label: `Experience (${profile?.experiences.length || 0})`, icon: Briefcase },
          { id: 'education', label: `Education (${profile?.educations.length || 0})`, icon: GraduationCap },
          { id: 'skills', label: `Skills (${profile?.skills.length || 0})`, icon: Wrench },
          { id: 'resume', label: profile?.resumeAtsScore != null ? `Resume & ATS (${profile.resumeAtsScore})` : 'Resume & ATS', icon: Gauge },
          { id: 'assets', label: 'Assets & Intro', icon: Video },
          { id: 'preferences', label: 'Preferences', icon: Sliders },
          { id: 'questions', label: `Question Bank (${questions.length})`, icon: HelpCircle },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20'
                  : 'bg-slate-100 text-slate-500 hover:text-slate-900 border border-slate-300'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: BASICS */}
      {activeTab === 'basics' && (
        <div className="glass-panel p-6 rounded-2xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Candidate Identity & Contact</h3>
              <p className="text-xs text-slate-500">Used for resume contact headers and application forms.</p>
            </div>
            {editingBasics ? (
              <button
                onClick={handleSaveBasics}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Save className="w-4 h-4" /> Save Changes
              </button>
            ) : (
              <button
                onClick={() => setEditingBasics(true)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-700 text-slate-800 rounded-xl text-xs font-semibold transition-colors"
              >
                Edit Info
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Full Legal Name</label>
              <input
                type="text"
                disabled={!editingBasics}
                value={basicsForm.fullName}
                onChange={(e) => setBasicsForm({ ...basicsForm, fullName: e.target.value })}
                className="w-full bg-slate-100 border border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-900 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Professional Headline</label>
              <input
                type="text"
                disabled={!editingBasics}
                value={basicsForm.headline}
                onChange={(e) => setBasicsForm({ ...basicsForm, headline: e.target.value })}
                placeholder="e.g. Senior Distributed Systems Engineer"
                className="w-full bg-slate-100 border border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-900 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Phone Number</label>
              <input
                type="text"
                disabled={!editingBasics}
                value={basicsForm.phone}
                onChange={(e) => setBasicsForm({ ...basicsForm, phone: e.target.value })}
                placeholder="+1 (555) 000-0000"
                className="w-full bg-slate-100 border border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-900 disabled:opacity-60 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">City</label>
                <input
                  type="text"
                  disabled={!editingBasics}
                  value={basicsForm.locationCity}
                  onChange={(e) => setBasicsForm({ ...basicsForm, locationCity: e.target.value })}
                  placeholder="San Francisco"
                  className="w-full bg-slate-100 border border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-900 disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Country</label>
                <input
                  type="text"
                  disabled={!editingBasics}
                  value={basicsForm.locationCountry}
                  onChange={(e) => setBasicsForm({ ...basicsForm, locationCountry: e.target.value })}
                  placeholder="United States"
                  className="w-full bg-slate-100 border border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-900 disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">LinkedIn Profile</label>
              <input
                type="text"
                disabled={!editingBasics}
                value={basicsForm.linkedinUrl}
                onChange={(e) => setBasicsForm({ ...basicsForm, linkedinUrl: e.target.value })}
                placeholder="https://linkedin.com/in/username"
                className="w-full bg-slate-100 border border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-900 disabled:opacity-60 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">GitHub Profile</label>
              <input
                type="text"
                disabled={!editingBasics}
                value={basicsForm.githubUrl}
                onChange={(e) => setBasicsForm({ ...basicsForm, githubUrl: e.target.value })}
                placeholder="https://github.com/username"
                className="w-full bg-slate-100 border border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-900 disabled:opacity-60 font-mono"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EXPERIENCE */}
      {activeTab === 'experience' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">Work History & Roles</h3>
            <button
              onClick={() => setShowAddExp(true)}
              className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Experience
            </button>
          </div>

          {showAddExp && (
            <div className="glass-panel p-6 rounded-2xl border border-sky-500/40 space-y-4">
              <h4 className="text-sm font-bold text-sky-600">Add Work Experience</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Company (e.g. Stripe)"
                  value={newExp.company}
                  onChange={(e) => setNewExp({ ...newExp, company: e.target.value })}
                  className="bg-slate-100 border border-slate-300 rounded-xl px-4 py-2 text-xs text-slate-900"
                />
                <input
                  type="text"
                  placeholder="Title (e.g. Senior Software Engineer)"
                  value={newExp.title}
                  onChange={(e) => setNewExp({ ...newExp, title: e.target.value })}
                  className="bg-slate-100 border border-slate-300 rounded-xl px-4 py-2 text-xs text-slate-900"
                />
                <input
                  type="text"
                  placeholder="Start Date (e.g. 2021-03)"
                  value={newExp.startDate || ''}
                  onChange={(e) => setNewExp({ ...newExp, startDate: e.target.value })}
                  className="bg-slate-100 border border-slate-300 rounded-xl px-4 py-2 text-xs text-slate-900 font-mono"
                />
                <input
                  type="text"
                  placeholder="End Date (e.g. Present)"
                  value={newExp.endDate || ''}
                  onChange={(e) => setNewExp({ ...newExp, endDate: e.target.value })}
                  className="bg-slate-100 border border-slate-300 rounded-xl px-4 py-2 text-xs text-slate-900 font-mono"
                />
              </div>

              <textarea
                placeholder="Description & Responsibilities"
                rows={3}
                value={newExp.description || ''}
                onChange={(e) => setNewExp({ ...newExp, description: e.target.value })}
                className="w-full bg-slate-100 border border-slate-300 rounded-xl p-3 text-xs text-slate-900"
              />

              <input
                type="text"
                placeholder="Key Metrics (comma separated: e.g. Reduced latency 30%, Scaled to 10M users)"
                value={metricsText}
                onChange={(e) => setMetricsText(e.target.value)}
                className="w-full bg-slate-100 border border-slate-300 rounded-xl px-4 py-2 text-xs text-slate-900"
              />

              <input
                type="text"
                placeholder="Technologies (comma separated: e.g. Go, TypeScript, PostgreSQL)"
                value={techText}
                onChange={(e) => setTechText(e.target.value)}
                className="w-full bg-slate-100 border border-slate-300 rounded-xl px-4 py-2 text-xs text-slate-900"
              />

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowAddExp(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-700 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddExperience}
                  className="px-5 py-2 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-bold"
                >
                  Save Experience
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {profile?.experiences.map((exp: any) => {
              const isVerified = exp.verificationStatus === 'USER_VERIFIED';
              return (
                <div key={exp.id} className="glass-panel p-5 rounded-2xl space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{exp.title}</h4>
                      <div className="text-xs text-slate-700 font-medium">{exp.company}</div>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {exp.startDate || 'N/A'} – {exp.isCurrent ? 'Present' : exp.endDate || 'N/A'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleFactVerification('experience', exp.id, exp.verificationStatus)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                          isVerified
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25'
                            : 'bg-amber-500/15 text-amber-500 border border-amber-500/30 hover:bg-amber-500/25'
                        }`}
                      >
                        {isVerified ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3.5 h-3.5" /> Unverified
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleDeleteExperience(exp.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {exp.description && (
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">{exp.description}</p>
                  )}

                  {exp.metrics && exp.metrics.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {exp.metrics.map((m: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-500/10 text-sky-600 border border-sky-500/20">
                          {m}
                        </span>
                      ))}
                    </div>
                  )}

                  {exp.technologies && exp.technologies.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {exp.technologies.map((t: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-500">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: EDUCATION */}
      {activeTab === 'education' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">Education & Degrees</h3>
            <button
              onClick={() => setShowAddEdu(true)}
              className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4" /> Add Education
            </button>
          </div>

          {showAddEdu && (
            <div className="glass-panel p-6 rounded-2xl border border-sky-500/40 space-y-4">
              <h4 className="text-sm font-bold text-sky-600">Add Academic Credential</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Institution (e.g. Stanford University)"
                  value={newEdu.institution}
                  onChange={(e) => setNewEdu({ ...newEdu, institution: e.target.value })}
                  className="bg-slate-100 border border-slate-300 rounded-xl px-4 py-2 text-xs text-slate-900"
                />
                <input
                  type="text"
                  placeholder="Degree (e.g. Bachelor of Science)"
                  value={newEdu.degree}
                  onChange={(e) => setNewEdu({ ...newEdu, degree: e.target.value })}
                  className="bg-slate-100 border border-slate-300 rounded-xl px-4 py-2 text-xs text-slate-900"
                />
                <input
                  type="text"
                  placeholder="Field of Study (e.g. Computer Science)"
                  value={newEdu.field || ''}
                  onChange={(e) => setNewEdu({ ...newEdu, field: e.target.value })}
                  className="bg-slate-100 border border-slate-300 rounded-xl px-4 py-2 text-xs text-slate-900"
                />
                <input
                  type="text"
                  placeholder="Graduation Year (e.g. 2022)"
                  value={newEdu.endDate || ''}
                  onChange={(e) => setNewEdu({ ...newEdu, endDate: e.target.value })}
                  className="bg-slate-100 border border-slate-300 rounded-xl px-4 py-2 text-xs text-slate-900 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowAddEdu(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-700 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddEducation}
                  className="px-5 py-2 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-bold"
                >
                  Save Education
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {profile?.educations.map((edu: any) => {
              const isVerified = edu.verificationStatus === 'USER_VERIFIED';
              return (
                <div key={edu.id} className="glass-panel p-5 rounded-2xl flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{edu.institution}</h4>
                    <div className="text-xs text-slate-700">
                      {edu.degree} {edu.field && `in ${edu.field}`}
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Graduated: {edu.endDate || 'N/A'} {edu.gradeOrCgpa && `• GPA: ${edu.gradeOrCgpa}`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleFactVerification('education', edu.id, edu.verificationStatus)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                        isVerified
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                      }`}
                    >
                      {isVerified ? 'Verified' : 'Unverified'}
                    </button>
                    <button
                      onClick={() => handleDeleteEducation(edu.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: SKILLS */}
      {activeTab === 'skills' && (
        <div className="glass-panel p-6 rounded-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">Technical & Domain Skills</h3>
              <p className="text-xs text-slate-500">
                Skills power job suitability scoring and automated gap detection against JD requirements.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="New skill (e.g. Rust)"
                value={newSkillName}
                onChange={(e) => setNewSkillName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSkill()}
                className="bg-slate-100 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900"
              />
              <select
                value={newSkillCategory}
                onChange={(e) => setNewSkillCategory(e.target.value)}
                className="bg-slate-100 border border-slate-300 rounded-xl px-2 py-1.5 text-xs text-slate-900"
              >
                <option value="Languages">Languages</option>
                <option value="Frontend">Frontend</option>
                <option value="Backend">Backend</option>
                <option value="Databases">Databases</option>
                <option value="DevOps & Cloud">DevOps & Cloud</option>
              </select>
              <button
                onClick={handleAddSkill}
                className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-bold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {profile?.skills.map((skill: any) => {
              const isVerified = skill.verificationStatus === 'USER_VERIFIED';
              return (
                <div
                  key={skill.id}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-medium border flex items-center gap-2 transition-all ${
                    isVerified
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                  }`}
                >
                  <span>{skill.name}</span>
                  {skill.category && (
                    <span className="text-[10px] text-slate-500 font-mono">({skill.category})</span>
                  )}
                  <button
                    onClick={() => handleToggleFactVerification('skill', skill.id, skill.verificationStatus)}
                    title={isVerified ? 'Verified' : 'Click to verify'}
                  >
                    {isVerified ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDeleteSkill(skill.id)}
                    className="text-slate-500 hover:text-rose-600 ml-0.5"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: RESUME & ATS SCORE */}
      {activeTab === 'resume' && (
        <div className="glass-panel p-6 rounded-2xl space-y-6">
          {/* Header + Upload Actions */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Resume & ATS Score</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xl">
                Upload your resume — we parse it into your career graph and instantly score it the way Applicant Tracking Systems do.
                {profile?.resumeFileName ? (
                  <span className="text-slate-600 font-medium"> Current file: {profile.resumeFileName}.</span>
                ) : null}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white text-xs font-semibold cursor-pointer hover:opacity-90 transition-opacity">
                {resumeUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {resumeUploading ? 'Uploading & Scoring…' : profile?.resumeFileName ? 'Re-upload Resume' : 'Upload Resume'}
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.txt,.md,.doc,.docx"
                  disabled={resumeUploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleResumeUpload(f);
                    e.target.value = '';
                  }}
                />
              </label>
              <button
                onClick={handleRunAtsCheck}
                disabled={atsChecking || !profile?.resumeFileName}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <RefreshCw className={`w-4 h-4 ${atsChecking ? 'animate-spin' : ''}`} />
                Re-run ATS Check
              </button>
            </div>
          </div>

          {atsReport ? (
            <div className="space-y-6">
              {/* Score Ring */}
              <div className="flex flex-col sm:flex-row items-center gap-6 p-5 rounded-2xl bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200">
                <div className="relative w-28 h-28 shrink-0">
                  <svg viewBox="0 0 36 36" className="w-28 h-28 -rotate-90">
                    <path d="M18 2.6 a15.4 15.4 0 0 1 0 30.8 a15.4 15.4 0 0 1 0 -30.8" fill="none" stroke="#e2e8f0" strokeWidth="3.2" />
                    <path
                      d="M18 2.6 a15.4 15.4 0 0 1 0 30.8 a15.4 15.4 0 0 1 0 -30.8"
                      fill="none"
                      stroke={atsScoreColor(atsReport.score)}
                      strokeWidth="3.2"
                      strokeLinecap="round"
                      strokeDasharray={`${(atsReport.score / 100) * 96.4} 96.4`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-extrabold text-slate-900">{atsReport.score}</span>
                    <span className="text-[10px] text-slate-500 font-semibold">/ 100</span>
                  </div>
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <div className="flex items-center gap-2 justify-center sm:justify-start">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold text-white" style={{ backgroundColor: atsScoreColor(atsReport.score) }}>
                      Grade {atsReport.grade}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-semibold bg-slate-100 border border-slate-300 text-slate-600">
                      {atsReport.mode === 'LLM' ? 'AI-ENHANCED' : 'DETERMINISTIC'}
                    </span>
                  </div>
                  {atsReport.targetJobTitle && (
                    <p className="text-xs text-slate-600 mt-2">
                      Scored against target role: <span className="font-semibold">{atsReport.targetJobTitle}</span>
                    </p>
                  )}
                  <p className="text-[11px] text-slate-500 mt-2">Last checked {new Date(atsReport.checkedAt).toLocaleString()}</p>
                </div>
              </div>

              {/* Score Breakdown by Category */}
              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-sky-600" /> Score Breakdown
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {atsReport.breakdown.map((item) => {
                    const pct = Math.round((item.score / item.maxScore) * 100);
                    return (
                      <div key={item.key} className="p-4 rounded-xl bg-white border border-slate-200">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-[10px] font-mono font-semibold text-slate-500 uppercase tracking-wide">
                            {item.label}
                          </span>
                          <span className="text-xs font-bold" style={{ color: atsScoreColor(pct) }}>
                            {item.score}/{item.maxScore}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: atsScoreColor(pct) }}
                          />
                        </div>
                        <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">{item.detail}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Keyword Match vs Target Role */}
              {(atsReport.keywordMatches.matched.length > 0 || atsReport.keywordMatches.missing.length > 0) && (
                <div>
                  <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-indigo-600" /> Keyword Match vs Target Role
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-white border border-slate-200">
                      <span className="text-[10px] font-mono font-semibold text-emerald-600 uppercase">
                        Matched ({atsReport.keywordMatches.matched.length})
                      </span>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {atsReport.keywordMatches.matched.length > 0 ? (
                          atsReport.keywordMatches.matched.map((k) => (
                            <span
                              key={k}
                              className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-medium"
                            >
                              {k}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-slate-400">No keyword overlap detected yet.</span>
                        )}
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-white border border-slate-200">
                      <span className="text-[10px] font-mono font-semibold text-amber-600 uppercase">
                        Missing ({atsReport.keywordMatches.missing.length})
                      </span>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {atsReport.keywordMatches.missing.length > 0 ? (
                          atsReport.keywordMatches.missing.map((k) => (
                            <span
                              key={k}
                              className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-medium"
                            >
                              {k}
                            </span>
                          ))
                        ) : (
                          <span className="text-[11px] text-slate-400">Full keyword coverage — nothing missing.</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* AI-Powered Improvement Suggestions */}
              {atsReport.suggestions.length > 0 && (
                <div>
                  <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-amber-500" /> Improvement Suggestions
                  </h4>
                  <div className="space-y-2.5">
                    {atsReport.suggestions.map((s, idx) => (
                      <div
                        key={idx}
                        className={`flex items-start gap-3 p-3.5 rounded-xl border ${
                          s.severity === 'HIGH'
                            ? 'bg-rose-50 border-rose-200'
                            : s.severity === 'MEDIUM'
                              ? 'bg-amber-50 border-amber-200'
                              : 'bg-sky-50 border-sky-200'
                        }`}
                      >
                        {s.severity === 'HIGH' ? (
                          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        ) : s.severity === 'MEDIUM' ? (
                          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        ) : (
                          <Lightbulb className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900">{s.title}</div>
                          <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{s.detail}</p>
                        </div>
                        <span className="ml-auto shrink-0 text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-500">
                          {s.severity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-10 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 text-center">
              <Gauge className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-700">No ATS score yet</p>
              <p className="text-xs text-slate-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
                Upload your resume to get an instant ATS score with a full category breakdown and AI-powered improvement
                suggestions tailored to your target role.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: ASSETS — COVER LETTER, VIDEO INTRO & PROFILE PICTURE (Phase 16) */}
      {activeTab === 'assets' && (
        <div className="glass-panel p-6 rounded-2xl space-y-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">Application Assets</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                Attach a default cover letter, a short video introduction, and a profile picture. These are stored on your
                candidate profile and shared with recruiters alongside your tailored applications.
              </p>
            </div>
            {assetsSaved && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-[11px] font-bold shrink-0">
                <Check className="w-3.5 h-3.5" /> Saved
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Profile Picture */}
            <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
              <span className="text-[10px] font-mono font-semibold text-sky-600 uppercase flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" /> Profile Picture
              </span>
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                  {profilePictureUrl ? (
                    <img src={profilePictureUrl} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <div className="space-y-1.5 min-w-0">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-300 text-[11px] font-semibold text-slate-700 cursor-pointer hover:bg-slate-200 transition-colors">
                    <Upload className="w-3.5 h-3.5" /> Upload Image
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={handlePictureSelected}
                    />
                  </label>
                  <p className="text-[10px] text-slate-500">PNG, JPG or WebP · max 2MB</p>
                  {profilePictureUrl && (
                    <button
                      onClick={() => setProfilePictureUrl('')}
                      className="text-[10px] text-rose-500 hover:text-rose-600 font-bold"
                    >
                      Remove picture
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Video Introduction */}
            <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
              <span className="text-[10px] font-mono font-semibold text-indigo-600 uppercase flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5" /> Video Introduction
              </span>
              <input
                type="url"
                placeholder="https://www.loom.com/share/…"
                value={videoIntroUrl}
                onChange={(e) => setVideoIntroUrl(e.target.value)}
                className="w-full bg-slate-100 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-500"
              />
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Record a 60–90 second introduction. Host it on Loom, YouTube (unlisted) or Drive, then paste the link here.
              </p>
              {videoIntroUrl && (
                <a
                  href={videoIntroUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-600 hover:text-sky-700"
                >
                  Open video <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>

            {/* Default Cover Letter */}
            <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
              <span className="text-[10px] font-mono font-semibold text-sky-600 uppercase flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Default Cover Letter
              </span>
              <textarea
                rows={7}
                value={coverLetterText}
                onChange={(e) => setCoverLetterText(e.target.value)}
                placeholder={
                  'Dear Hiring Team,\n\nI am applying for the [Target Role] position...\n\n(Keep it factual — the AI tailors this per job from your verified graph facts.)'
                }
                className="w-full bg-slate-100 border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 leading-relaxed focus:outline-none focus:border-sky-500 resize-y"
              />
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Used as the baseline when a job-specific cover letter is generated. Keep it grounded in your real experience —
                the AI will adapt it per role, never invent facts.
              </p>
            </div>

            {/* Save Assets */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-end gap-3 pt-1 border-t border-slate-300">
              <span className="text-[10px] text-slate-500 sm:mr-auto">
                Picture stored as a secure data URL · video is a hosted link · letter saved to your profile.
              </span>
              <button
                onClick={handleSaveAssets}
                disabled={assetsSaving}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white text-xs font-bold shadow-lg shadow-sky-500/25 hover:from-sky-400 hover:to-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {assetsSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" /> Save Assets
                  </>
                )}
              </button>
            </div>
          </div>
      )}

      {/* TAB 7: CAREER PREFERENCES & AUTOMATION SUMMARY */}
      {activeTab === 'preferences' && profile?.preferences && (
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <h3 className="text-base font-bold text-slate-900">Active Career Preferences & Automation</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-slate-100 rounded-xl border border-slate-300 space-y-2">
              <span className="text-[10px] font-mono text-sky-600 uppercase">Automation Strategy</span>
              <div className="text-sm font-bold text-slate-900">{profile.preferences.automationMode}</div>
              <p className="text-slate-500 leading-relaxed">
                Mode controls whether applications are dispatched automatically or staged in the Approval Center.
              </p>
            </div>

            <div className="p-4 bg-slate-100 rounded-xl border border-slate-300 space-y-2">
              <span className="text-[10px] font-mono text-indigo-600 uppercase">Compensation Targets</span>
              <div className="text-sm font-bold text-slate-900">
                Min: {profile.preferences.currency} {profile.preferences.minSalary?.toLocaleString() || 'N/A'} • Expected:{' '}
                {profile.preferences.currency} {profile.preferences.expectedSalary?.toLocaleString() || 'N/A'}
              </div>
              <p className="text-slate-500 leading-relaxed">
                Notice Period: {profile.preferences.noticePeriodDays} days • Sponsorship:{' '}
                {profile.preferences.requiresSponsorship ? 'Required' : 'Not Required'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: CANONICAL QUESTION BANK (150 QUESTIONS) */}
      {activeTab === 'questions' && (
        <div className="glass-panel p-6 rounded-2xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-300">
            <div>
              <h3 className="text-base font-bold text-slate-900">Universal Question Bank</h3>
              <p className="text-xs text-slate-500">
                150+ canonical questions across 10 categories. Answered questions are automatically injected into ATS applications.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search questions..."
                  value={questionSearch}
                  onChange={(e) => setQuestionSearch(e.target.value)}
                  className="bg-slate-100 border border-slate-300 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-sky-500 w-48"
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-slate-100 border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none"
              >
                <option value="ALL">All Categories</option>
                <option value="IDENTITY">Identity</option>
                <option value="WORK_AUTH">Work Auth</option>
                <option value="LOCATION">Location</option>
                <option value="COMPENSATION">Compensation</option>
                <option value="AVAILABILITY">Availability</option>
                <option value="EXPERIENCE">Experience</option>
                <option value="EDUCATION">Education</option>
                <option value="MOTIVATION">Motivation</option>
                <option value="LEGAL">Legal</option>
                <option value="EEO">EEO</option>
              </select>
            </div>
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {filteredQuestions.map((q) => {
              const currentVal = answers[q.key] || '';
              return (
                <div key={q.key} className="p-4 bg-slate-100 rounded-xl border border-slate-300 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-sky-600 uppercase tracking-wider">
                          {q.category}
                        </span>
                        {q.isCoreOnboarding && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
                            CORE
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-semibold text-slate-900 mt-0.5">{q.questionText}</h4>
                    </div>

                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        currentVal
                          ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/20'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {currentVal ? 'Answered' : 'Pending'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {q.answerType === 'select' && q.options && Array.isArray(q.options) ? (
                      <select
                        value={currentVal}
                        onChange={(e) => handleSaveSingleAnswer(q.key, e.target.value)}
                        className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900"
                      >
                        <option value="">Select option...</option>
                        {q.options.map((opt: string) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        defaultValue={currentVal}
                        onBlur={(e) => {
                          if (e.target.value !== currentVal) {
                            handleSaveSingleAnswer(q.key, e.target.value);
                          }
                        }}
                        placeholder="Type answer and click away to save..."
                        className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-mono"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
