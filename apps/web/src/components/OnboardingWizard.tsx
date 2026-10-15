import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { api } from '../api/client.js';
import {
  CandidateProfileDTO,
  CanonicalQuestionDTO,
  CandidateAnswerDTO,
  PreferencesInput,
  AutomationMode,
} from '@careergraph/shared';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Briefcase,
  GraduationCap,
  Wrench,
  FolderGit2,
  DollarSign,
  ShieldCheck,
  Check,
  X,
  Plus,
  Loader2,
  Search,
} from 'lucide-react';

interface OnboardingWizardProps {
  onComplete: () => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete }) => {
  const { accessToken } = useAuth();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Profile and state
  const [profile, setProfile] = useState<CandidateProfileDTO | null>(null);
  const [rawText, setRawText] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [activeFactTab, setActiveFactTab] = useState<'experiences' | 'educations' | 'skills' | 'projects'>('experiences');
  const [searchTerm, setSearchTerm] = useState('');

  // Preferences form
  const [preferences, setPreferences] = useState<PreferencesInput>({
    targetTitles: ['Senior Full-Stack Engineer', 'Backend Architect'],
    seniorityLevels: ['SENIOR', 'LEAD'],
    targetLocations: ['San Francisco, CA', 'Remote'],
    remotePreference: 'REMOTE_FIRST',
    minSalary: 150000,
    expectedSalary: 190000,
    currency: 'USD',
    noticePeriodDays: 30,
    blockedCompanies: [],
    automationMode: 'STRICT_APPROVAL',
    workAuthCountries: ['United States'],
    requiresSponsorship: false,
  });
  const [newTitle, setNewTitle] = useState('');
  const [newLocation, setNewLocation] = useState('');

  // Questions and Answers
  const [questions, setQuestions] = useState<CanonicalQuestionDTO[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Fetch initial profile, onboarding state & questions
  useEffect(() => {
    if (!accessToken) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [profileRes, onboardingRes, questionsRes, answersRes] = await Promise.all([
          api.getProfile(accessToken),
          api.getOnboardingState(accessToken),
          api.getQuestions(true), // core onboarding questions
          api.getAnswers(accessToken),
        ]);

        if (profileRes.profile) {
          setProfile(profileRes.profile);
          if (profileRes.profile.rawResumeText) {
            setRawText(profileRes.profile.rawResumeText);
          }
          if (profileRes.profile.resumeFileName) {
            setFileName(profileRes.profile.resumeFileName);
          }
          if (profileRes.profile.preferences) {
            setPreferences({
              targetTitles: profileRes.profile.preferences.targetTitles || [],
              seniorityLevels: profileRes.profile.preferences.seniorityLevels || ['SENIOR'],
              targetLocations: profileRes.profile.preferences.targetLocations || [],
              remotePreference: profileRes.profile.preferences.remotePreference || 'REMOTE_FIRST',
              minSalary: profileRes.profile.preferences.minSalary,
              expectedSalary: profileRes.profile.preferences.expectedSalary,
              currency: profileRes.profile.preferences.currency || 'USD',
              noticePeriodDays: profileRes.profile.preferences.noticePeriodDays || 30,
              blockedCompanies: profileRes.profile.preferences.blockedCompanies || [],
              automationMode: profileRes.profile.preferences.automationMode || 'STRICT_APPROVAL',
              workAuthCountries: profileRes.profile.preferences.workAuthCountries || ['United States'],
              requiresSponsorship: profileRes.profile.preferences.requiresSponsorship || false,
            });
          }
        }

        if (onboardingRes.state) {
          setStep(onboardingRes.state.currentStep || 1);
        }

        if (questionsRes.questions) {
          setQuestions(questionsRes.questions);
        }

        if (answersRes.answers) {
          const ansMap: Record<string, string> = {};
          answersRes.answers.forEach((a: CandidateAnswerDTO) => {
            ansMap[a.questionKey] = a.value;
          });
          setAnswers(ansMap);
        }
      } catch (err: any) {
        console.error('Failed to load onboarding data:', err);
        setErrorMessage(err.message || 'Failed to initialize onboarding wizard.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [accessToken]);

  const saveStepProgress = async (nextStep: number, isCompleted = false) => {
    if (!accessToken) return;
    try {
      await api.updateOnboardingState({ currentStep: nextStep, isCompleted }, accessToken);
      setStep(nextStep);
    } catch (e) {
      console.error('Failed to save step progress:', e);
      setStep(nextStep);
    }
  };

  // Resume Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !accessToken) return;

    setActionLoading(true);
    setErrorMessage(null);

    try {
      const res = await api.uploadResume(file, accessToken);
      setFileName(res.fileName);
      setRawText(res.rawText);
      setProfile(res.profile);
      await saveStepProgress(2);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to upload and parse resume.');
    } finally {
      setActionLoading(false);
    }
  };

  // Fact Verification Handlers
  const handleToggleVerification = async (
    factType: 'experience' | 'education' | 'skill' | 'project',
    factId: string,
    currentStatus: string
  ) => {
    if (!accessToken) return;
    const newStatus = currentStatus === 'USER_VERIFIED' ? 'UNVERIFIED' : 'USER_VERIFIED';

    try {
      await api.verifyFact(factType, factId, newStatus, accessToken);
      const updated = await api.getProfile(accessToken);
      setProfile(updated.profile);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update verification status.');
    }
  };

  const handleVerifyAll = async () => {
    if (!accessToken) return;
    setActionLoading(true);
    try {
      await api.verifyAllFacts(accessToken);
      const updated = await api.getProfile(accessToken);
      setProfile(updated.profile);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to verify all facts.');
    } finally {
      setActionLoading(false);
    }
  };

  // Step 3 Preferences Save
  const handleSavePreferences = async () => {
    if (!accessToken) return;
    setActionLoading(true);
    try {
      await api.updatePreferences(preferences, accessToken);
      await saveStepProgress(4);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save career preferences.');
    } finally {
      setActionLoading(false);
    }
  };

  // Step 4 Answers Save
  const handleSaveAnswers = async () => {
    if (!accessToken) return;
    setActionLoading(true);
    try {
      const payload = Object.entries(answers).map(([key, val]) => ({
        questionKey: key,
        value: val,
        scope: 'GLOBAL' as const,
        verificationStatus: 'USER_VERIFIED' as const,
      }));
      if (payload.length > 0) {
        await api.saveAnswers(payload, accessToken);
      }
      await saveStepProgress(5);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save canonical answers.');
    } finally {
      setActionLoading(false);
    }
  };

  // Step 5 Finish Onboarding
  const handleFinishOnboarding = async () => {
    if (!accessToken) return;
    setActionLoading(true);
    try {
      await api.updatePreferences(preferences, accessToken);
      await api.updateOnboardingState({ currentStep: 5, isCompleted: true }, accessToken);
      onComplete();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to complete onboarding.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-slate-500 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
        <span className="text-sm font-mono tracking-wider">Loading Onboarding Wizard...</span>
      </div>
    );
  }

  // Count unverified facts
  const experiences = profile?.experiences || [];
  const educations = profile?.educations || [];
  const skills = profile?.skills || [];
  const projects = profile?.projects || [];

  const allFactsCount = experiences.length + educations.length + skills.length + projects.length;
  const verifiedFactsCount = [
    ...experiences,
    ...educations,
    ...skills,
    ...projects,
  ].filter((f: any) => f.verificationStatus === 'USER_VERIFIED').length;

  return (
    <div className="space-y-6">
      {/* Top Wizard Steps Bar */}
      <div className="glass-panel p-4 rounded-2xl">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          {[
            { num: 1, label: 'Resume Upload' },
            { num: 2, label: 'Fact Verification' },
            { num: 3, label: 'Preferences' },
            { num: 4, label: 'Core Questions' },
            { num: 5, label: 'Automation Mode' },
          ].map((s) => (
            <button
              key={s.num}
              onClick={() => s.num < step && setStep(s.num)}
              disabled={s.num > step}
              className={`flex items-center gap-2 text-xs font-semibold transition-all ${
                s.num === step
                  ? 'text-sky-600 scale-105'
                  : s.num < step
                  ? 'text-emerald-600 cursor-pointer hover:underline'
                  : 'text-slate-500 cursor-not-allowed'
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  s.num === step
                    ? 'bg-sky-500 text-white shadow-md shadow-sky-500/30'
                    : s.num < step
                    ? 'bg-emerald-500/20 text-emerald-600 border border-emerald-500/30'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {s.num < step ? <Check className="w-3.5 h-3.5" /> : s.num}
              </div>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* STEP 1: RESUME UPLOAD */}
      {step === 1 && (
        <div className="glass-panel p-8 rounded-2xl max-w-3xl mx-auto text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-600">
            <Upload className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Upload Your Resume</h2>
            <p className="text-sm text-slate-500 max-w-lg mx-auto">
              Drop your PDF, DOCX, or text resume. Our structured extraction engine parses your work
              history, skills, education, and achievements into verifiable facts for your CareerGraph.
            </p>
          </div>

          <label className="border-2 border-dashed border-slate-300 hover:border-sky-500/50 bg-slate-100 hover:bg-white rounded-2xl p-10 block cursor-pointer transition-all">
            <input
              type="file"
              accept=".pdf,.docx,.doc,.txt"
              onChange={handleFileUpload}
              disabled={actionLoading}
              className="hidden"
            />
            {actionLoading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
                <span className="text-sm font-semibold text-slate-700">
                  Extracting facts and structuring entities...
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  Running zero-dependency parser & entity classifier
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <FileText className="w-10 h-10 text-slate-500 mb-1" />
                <span className="text-sm font-semibold text-slate-900">
                  Click to browse or drag & drop resume here
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  Supported formats: PDF, DOCX, TXT (Max 10MB)
                </span>
              </div>
            )}
          </label>

          {profile && (profile.experiences.length > 0 || profile.skills.length > 0) && (
            <div className="p-4 bg-slate-100 rounded-xl border border-slate-300 text-left flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 block font-mono">Existing resume on record:</span>
                <span className="text-sm font-semibold text-slate-900">{profile.resumeFileName || 'resume.pdf'}</span>
                <span className="text-xs text-slate-500 block mt-0.5">
                  ({profile.experiences.length} roles, {profile.skills.length} skills parsed)
                </span>
              </div>
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
              >
                Review Facts <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: SIDE-BY-SIDE VERIFICATION SCREEN */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-4 rounded-2xl">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Side-by-Side Fact Verification</h2>
                <span className="px-2.5 py-0.5 bg-sky-500/10 text-sky-600 border border-sky-500/20 rounded-full text-xs font-semibold">
                  {verifiedFactsCount} / {allFactsCount} Verified
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Compare extracted facts against your raw resume. Facts are UNVERIFIED until confirmed by you.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleVerifyAll}
                disabled={actionLoading}
                className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                1-Click Verify All Facts
              </button>
              <button
                onClick={() => setStep(3)}
                className="px-5 py-2 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-lg shadow-sky-500/20"
              >
                Next: Preferences <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left Column: Raw Resume Text Viewer */}
            <div className="glass-panel p-5 rounded-2xl flex flex-col h-[650px]">
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-300">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-sky-600" />
                  <span className="text-xs font-bold text-slate-800">
                    Source Resume: {fileName || 'Uploaded File'}
                  </span>
                </div>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search in resume..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-slate-100 border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-sky-500 w-44"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono text-xs text-slate-700 whitespace-pre-wrap leading-relaxed select-text">
                {rawText ? (
                  searchTerm ? (
                    rawText.split('\n').map((line, idx) => {
                      const match = line.toLowerCase().includes(searchTerm.toLowerCase());
                      return (
                        <div
                          key={idx}
                          className={match ? 'bg-amber-500/20 text-amber-200 font-semibold px-1 rounded' : ''}
                        >
                          {line}
                        </div>
                      );
                    })
                  ) : (
                    rawText
                  )
                ) : (
                  <div className="text-slate-500 italic p-4 text-center">
                    No raw resume text available. Upload a file on Step 1.
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Structured Fact Cards */}
            <div className="glass-panel p-5 rounded-2xl flex flex-col h-[650px]">
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-300">
                {[
                  { id: 'experiences', label: `Roles (${experiences.length})`, icon: Briefcase },
                  { id: 'educations', label: `Education (${educations.length})`, icon: GraduationCap },
                  { id: 'skills', label: `Skills (${skills.length})`, icon: Wrench },
                  { id: 'projects', label: `Projects (${projects.length})`, icon: FolderGit2 },
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveFactTab(tab.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                        activeFactTab === tab.id
                          ? 'bg-sky-500 text-white'
                          : 'bg-slate-100 text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                {/* Experiences List */}
                {activeFactTab === 'experiences' && (
                  experiences.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-10">No experience facts extracted yet.</p>
                  ) : (
                    experiences.map((exp: any) => {
                      const isVerified = exp.verificationStatus === 'USER_VERIFIED';
                      return (
                        <div
                          key={exp.id}
                          className={`p-4 rounded-xl border transition-all ${
                            isVerified
                              ? 'bg-emerald-950/20 border-emerald-500/30'
                              : 'bg-amber-950/20 border-amber-500/30'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div>
                              <h4 className="text-sm font-bold text-slate-900">{exp.title}</h4>
                              <div className="text-xs text-slate-700 font-medium">{exp.company}</div>
                              <span className="text-[11px] text-slate-500 font-mono">
                                {exp.startDate || 'N/A'} – {exp.isCurrent ? 'Present' : exp.endDate || 'N/A'}
                              </span>
                            </div>
                            <button
                              onClick={() => handleToggleVerification('experience', exp.id, exp.verificationStatus)}
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 transition-colors ${
                                isVerified
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                                  : 'bg-amber-500/20 text-amber-500 border border-amber-500/40 hover:bg-amber-500/30'
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
                          </div>

                          {exp.description && (
                            <p className="text-xs text-slate-700 leading-relaxed mb-2 whitespace-pre-line line-clamp-3">
                              {exp.description}
                            </p>
                          )}

                          {exp.metrics && exp.metrics.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {exp.metrics.map((m: string, i: number) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-500/10 text-sky-600 border border-sky-500/20"
                                >
                                  {m}
                                </span>
                              ))}
                            </div>
                          )}

                          {exp.technologies && exp.technologies.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {exp.technologies.map((t: string, i: number) => (
                                <span
                                  key={i}
                                  className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-500"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )
                )}

                {/* Educations List */}
                {activeFactTab === 'educations' && (
                  educations.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-10">No education facts extracted yet.</p>
                  ) : (
                    educations.map((edu: any) => {
                      const isVerified = edu.verificationStatus === 'USER_VERIFIED';
                      return (
                        <div
                          key={edu.id}
                          className={`p-4 rounded-xl border transition-all ${
                            isVerified
                              ? 'bg-emerald-950/20 border-emerald-500/30'
                              : 'bg-amber-950/20 border-amber-500/30'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="text-sm font-bold text-slate-900">{edu.institution}</h4>
                              <div className="text-xs text-slate-700">
                                {edu.degree} {edu.field && `in ${edu.field}`}
                              </div>
                              <span className="text-[11px] text-slate-500 font-mono">
                                Graduated: {edu.endDate || 'N/A'} {edu.gradeOrCgpa && `• GPA: ${edu.gradeOrCgpa}`}
                              </span>
                            </div>
                            <button
                              onClick={() => handleToggleVerification('education', edu.id, edu.verificationStatus)}
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 transition-colors ${
                                isVerified
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : 'bg-amber-500/20 text-amber-500 border border-amber-500/40'
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
                          </div>
                        </div>
                      );
                    })
                  )
                )}

                {/* Skills List */}
                {activeFactTab === 'skills' && (
                  skills.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-10">No skill facts extracted yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {skills.map((skill: any) => {
                        const isVerified = skill.verificationStatus === 'USER_VERIFIED';
                        return (
                          <button
                            key={skill.id}
                            onClick={() => handleToggleVerification('skill', skill.id, skill.verificationStatus)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all ${
                              isVerified
                                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
                                : 'bg-amber-500/15 border-amber-500/30 text-amber-500 hover:bg-amber-500/25'
                            }`}
                          >
                            <span>{skill.name}</span>
                            {isVerified ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <AlertCircle className="w-3 h-3 text-amber-600" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )
                )}

                {/* Projects List */}
                {activeFactTab === 'projects' && (
                  projects.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-10">No project facts extracted yet.</p>
                  ) : (
                    projects.map((proj: any) => {
                      const isVerified = proj.verificationStatus === 'USER_VERIFIED';
                      return (
                        <div
                          key={proj.id}
                          className={`p-4 rounded-xl border transition-all ${
                            isVerified
                              ? 'bg-emerald-950/20 border-emerald-500/30'
                              : 'bg-amber-950/20 border-amber-500/30'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div>
                              <h4 className="text-sm font-bold text-slate-900">{proj.name}</h4>
                              <div className="text-xs text-slate-700">{proj.role || 'Contributor'}</div>
                            </div>
                            <button
                              onClick={() => handleToggleVerification('project', proj.id, proj.verificationStatus)}
                              className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
                                isVerified
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : 'bg-amber-500/20 text-amber-500 border border-amber-500/40'
                              }`}
                            >
                              {isVerified ? 'Verified' : 'Unverified'}
                            </button>
                          </div>
                          {proj.description && (
                            <p className="text-xs text-slate-700 leading-relaxed mb-2">{proj.description}</p>
                          )}
                          {proj.techStack && (
                            <div className="flex flex-wrap gap-1">
                              {proj.techStack.map((t: string, i: number) => (
                                <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-500">
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: CAREER PREFERENCES */}
      {step === 3 && (
        <div className="glass-panel p-8 rounded-2xl max-w-3xl mx-auto space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-1">Career & Job Targets</h2>
            <p className="text-xs text-slate-500">
              Configure what jobs our agents will discover and tailor applications for.
            </p>
          </div>

          <div className="space-y-4">
            {/* Target Titles */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                Target Job Titles
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {preferences.targetTitles.map((title, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-sky-500/15 border border-sky-500/30 text-sky-500 rounded-lg text-xs font-medium flex items-center gap-1.5"
                  >
                    {title}
                    <button
                      type="button"
                      onClick={() =>
                        setPreferences({
                          ...preferences,
                          targetTitles: preferences.targetTitles.filter((_, idx) => idx !== i),
                        })
                      }
                      className="hover:text-slate-900"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Lead Distributed Systems Engineer"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTitle.trim()) {
                      e.preventDefault();
                      setPreferences({
                        ...preferences,
                        targetTitles: [...preferences.targetTitles, newTitle.trim()],
                      });
                      setNewTitle('');
                    }
                  }}
                  className="flex-1 bg-slate-100 border border-slate-300 rounded-xl px-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-sky-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newTitle.trim()) {
                      setPreferences({
                        ...preferences,
                        targetTitles: [...preferences.targetTitles, newTitle.trim()],
                      });
                      setNewTitle('');
                    }
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-700 text-slate-800 rounded-xl text-xs font-semibold flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
            </div>

            {/* Remote Preference */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                Workplace Flexibility
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'REMOTE_FIRST', label: 'Remote First' },
                  { id: 'HYBRID', label: 'Hybrid' },
                  { id: 'ONSITE', label: 'On-site' },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setPreferences({ ...preferences, remotePreference: mode.id })}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      preferences.remotePreference === mode.id
                        ? 'bg-sky-500 text-white border-sky-400'
                        : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Locations */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                Target Cities / Regions
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {preferences.targetLocations.map((loc, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 rounded-lg text-xs font-medium flex items-center gap-1.5"
                  >
                    {loc}
                    <button
                      type="button"
                      onClick={() =>
                        setPreferences({
                          ...preferences,
                          targetLocations: preferences.targetLocations.filter((_, idx) => idx !== i),
                        })
                      }
                      className="hover:text-slate-900"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. San Francisco, New York, London, Bangalore"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newLocation.trim()) {
                      e.preventDefault();
                      setPreferences({
                        ...preferences,
                        targetLocations: [...preferences.targetLocations, newLocation.trim()],
                      });
                      setNewLocation('');
                    }
                  }}
                  className="flex-1 bg-slate-100 border border-slate-300 rounded-xl px-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-sky-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newLocation.trim()) {
                      setPreferences({
                        ...preferences,
                        targetLocations: [...preferences.targetLocations, newLocation.trim()],
                      });
                      setNewLocation('');
                    }
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-700 text-slate-800 rounded-xl text-xs font-semibold flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
            </div>

            {/* Compensation & Currency */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Min Base Salary
                </label>
                <input
                  type="number"
                  value={preferences.minSalary || ''}
                  onChange={(e) =>
                    setPreferences({ ...preferences, minSalary: parseInt(e.target.value) || null })
                  }
                  className="w-full bg-slate-100 border border-slate-300 rounded-xl px-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-sky-500 font-mono"
                  placeholder="140000"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Expected Salary
                </label>
                <input
                  type="number"
                  value={preferences.expectedSalary || ''}
                  onChange={(e) =>
                    setPreferences({ ...preferences, expectedSalary: parseInt(e.target.value) || null })
                  }
                  className="w-full bg-slate-100 border border-slate-300 rounded-xl px-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-sky-500 font-mono"
                  placeholder="180000"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Currency
                </label>
                <select
                  value={preferences.currency}
                  onChange={(e) => setPreferences({ ...preferences, currency: e.target.value })}
                  className="w-full bg-slate-100 border border-slate-300 rounded-xl px-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-sky-500"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="INR">INR (₹)</option>
                  <option value="CAD">CAD ($)</option>
                  <option value="AUD">AUD ($)</option>
                </select>
              </div>
            </div>

            {/* Sponsorship & Notice Period */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-300">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.requiresSponsorship}
                  onChange={(e) =>
                    setPreferences({ ...preferences, requiresSponsorship: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-sky-500 focus:ring-0 bg-slate-100 border-slate-300"
                />
                <span className="text-xs text-slate-700 font-medium">
                  Requires Visa Sponsorship (H-1B, Skilled Worker, etc.)
                </span>
              </label>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Notice Period:</span>
                <input
                  type="number"
                  value={preferences.noticePeriodDays}
                  onChange={(e) =>
                    setPreferences({ ...preferences, noticePeriodDays: parseInt(e.target.value) || 0 })
                  }
                  className="w-20 bg-slate-100 border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-900 font-mono text-center"
                />
                <span className="text-xs text-slate-500">days</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-300">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-700 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Facts
            </button>
            <button
              onClick={handleSavePreferences}
              disabled={actionLoading}
              className="px-6 py-2.5 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-lg shadow-sky-500/20"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save & Next: Core Questions <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: CORE QUESTION PACK */}
      {step === 4 && (
        <div className="glass-panel p-8 rounded-2xl max-w-3xl mx-auto space-y-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-1">Core Canonical Questions</h2>
            <p className="text-xs text-slate-500">
              Answer canonical universal application questions once. Our auto-apply engine reuses these
              verified answers across job boards, ATS portals, and application forms.
            </p>
          </div>

          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
            {questions.map((q) => (
              <div key={q.key} className="p-4 bg-slate-100 rounded-xl border border-slate-300 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-sky-600">
                      {q.category}
                    </span>
                    <h4 className="text-xs font-semibold text-slate-900 mt-0.5">{q.questionText}</h4>
                  </div>
                </div>

                {q.answerType === 'select' && q.options && Array.isArray(q.options) ? (
                  <select
                    value={answers[q.key] || ''}
                    onChange={(e) => setAnswers({ ...answers, [q.key]: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-sky-500"
                  >
                    <option value="">Select an answer...</option>
                    {q.options.map((opt: string) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : q.answerType === 'boolean' ? (
                  <div className="flex gap-2">
                    {['Yes', 'No'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setAnswers({ ...answers, [q.key]: opt })}
                        className={`px-4 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          answers[q.key] === opt
                            ? 'bg-sky-500 text-white border-sky-400'
                            : 'bg-white text-slate-700 border-slate-300 hover:border-sky-300'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={answers[q.key] || ''}
                    onChange={(e) => setAnswers({ ...answers, [q.key]: e.target.value })}
                    placeholder="Enter answer..."
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-sky-500"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-300">
            <button
              onClick={() => setStep(3)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-700 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Preferences
            </button>
            <button
              onClick={handleSaveAnswers}
              disabled={actionLoading}
              className="px-6 py-2.5 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-lg shadow-sky-500/20"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save & Next: Automation Mode <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: AUTOMATION MODE */}
      {step === 5 && (
        <div className="glass-panel p-8 rounded-2xl max-w-3xl mx-auto space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Select Your Automation Strategy</h2>
            <p className="text-xs text-slate-500 max-w-lg mx-auto">
              You maintain total control. Choose how actively the AI agents draft and dispatch
              applications on your behalf. You can switch this mode anytime.
            </p>
          </div>

          <div className="space-y-3">
            {[
              {
                mode: 'STRICT_APPROVAL' as AutomationMode,
                title: 'Strict Approval Mode',
                badge: 'Maximum Safety',
                badgeColor: 'text-sky-600 bg-sky-500/10 border-sky-500/20',
                desc: 'Agents discover jobs, calculate match scores, and draft tailored answers. NO application is submitted without your explicit 1-click approval in the Approval Center.',
              },
              {
                mode: 'BATCH_REVIEW' as AutomationMode,
                title: 'Batch Review Mode',
                badge: 'Recommended',
                badgeColor: 'text-indigo-600 bg-indigo-500/10 border-indigo-500/20',
                desc: 'Applications are bundled into a daily digest. Review and dispatch 10+ tailored submissions in under 2 minutes.',
              },
              {
                mode: 'FULL_AUTO' as AutomationMode,
                title: 'Full Autonomous Mode',
                badge: 'High Speed',
                badgeColor: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
                desc: 'Agents automatically submit applications for roles matching >= 85% of your requirements, capped at your daily limit (default 20/day).',
              },
            ].map((item) => (
              <label
                key={item.mode}
                onClick={() => setPreferences({ ...preferences, automationMode: item.mode })}
                className={`p-5 rounded-2xl border block cursor-pointer transition-all ${
                  preferences.automationMode === item.mode
                    ? 'bg-sky-950/30 border-sky-500 shadow-lg shadow-sky-500/10 ring-1 ring-sky-500/50'
                    : 'bg-slate-100 border-slate-300 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="automationMode"
                      checked={preferences.automationMode === item.mode}
                      onChange={() => setPreferences({ ...preferences, automationMode: item.mode })}
                      className="w-4 h-4 text-sky-500 bg-slate-100 border-slate-300"
                    />
                    <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed pl-7">{item.desc}</p>
              </label>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-300">
            <button
              onClick={() => setStep(4)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-700 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Questions
            </button>
            <button
              onClick={handleFinishOnboarding}
              disabled={actionLoading}
              className="px-8 py-3 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all shadow-xl shadow-sky-500/25"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Complete Onboarding & Enter Command Center
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
