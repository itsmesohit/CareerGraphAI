export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'CareerGraph AI API',
    version: '1.0.0',
    description:
      'Autonomous Graph-Powered AI Job Search & Auto-Application SaaS Engine. All endpoints adhere to Spec Section 5 authentication with single-use OTP hashes, Argon2id passwords, and rotating refresh tokens.',
  },
  servers: [
    {
      url: 'http://localhost:3001/api/v1',
      description: 'Local Development Server',
    },
  ],
  paths: {
    '/health': {
      get: {
        summary: 'Liveness probe',
        responses: {
          200: { description: 'API is running' },
        },
      },
    },
    '/health/ready': {
      get: {
        summary: 'Readiness probe',
        description: 'Checks PostgreSQL and Redis connectivity',
        responses: {
          200: { description: 'All critical dependencies are healthy' },
          503: { description: 'One or more dependencies are degraded' },
        },
      },
    },
    '/marketing/stats': {
      get: {
        summary: 'Public aggregate platform statistics',
        responses: {
          200: { description: 'Platform counters and metrics' },
        },
      },
    },
    '/marketing/activity': {
      get: {
        summary: 'Live platform activity ticker',
        responses: {
          200: { description: 'Recent anonymized application/match events' },
        },
      },
    },
    '/auth/register': {
      post: {
        summary: 'Register candidate account',
        description:
          'Validates password with Argon2id and triggers email verification OTP (10m expiry, 6-digit numeric).',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'email', 'password'],
                properties: {
                  name: { type: 'string', example: 'Alex Morgan' },
                  email: { type: 'string', format: 'email', example: 'alex@example.com' },
                  password: { type: 'string', minLength: 8, example: 'StrongP@ssw0rd' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Account created, OTP sent to email' },
          400: { description: 'Validation failed or account exists' },
        },
      },
    },
    '/auth/verify-otp': {
      post: {
        summary: 'Verify email OTP and establish session',
        description:
          'Verifies 6-digit code against SHA-256 hash. Enforces 5-attempt limit and 10m expiry. Returns access token and sets httpOnly refresh token cookie.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'code'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  code: { type: 'string', example: '492816' },
                  purpose: { type: 'string', default: 'VERIFY_EMAIL' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Email verified and session established' },
          400: { description: 'Invalid or expired OTP' },
        },
      },
    },
    '/auth/resend-otp': {
      post: {
        summary: 'Resend OTP code',
        description: 'Subject to 60s cooldown and max 3 sends per 15 minutes.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  purpose: { type: 'string', default: 'VERIFY_EMAIL' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'New code sent' },
          429: { description: 'Cooldown or rate limit exceeded' },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Sign in with password',
        description:
          'Verifies password with Argon2id. If unverified, prompts for OTP.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Login successful' },
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/auth/login/otp-request': {
      post: {
        summary: 'Request passwordless login code',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: { email: { type: 'string', format: 'email' } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Login code dispatched' },
        },
      },
    },
    '/auth/login/otp-verify': {
      post: {
        summary: 'Verify passwordless login code',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'code'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  code: { type: 'string', example: '123456' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Session established' },
          400: { description: 'Invalid code' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        summary: 'Rotate refresh token',
        description:
          'Exchanges current refresh token for a new access/refresh pair. If a revoked token is reused, all sessions in that family are terminated immediately.',
        responses: {
          200: { description: 'Tokens rotated' },
          401: { description: 'Token invalid or reuse detected' },
        },
      },
    },
    '/auth/logout': {
      post: {
        summary: 'Log out current session',
        responses: {
          200: { description: 'Session terminated' },
        },
      },
    },
    '/auth/me': {
      get: {
        summary: 'Get current user profile',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Current profile details' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/auth/sessions': {
      get: {
        summary: 'List user active sessions and devices',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Active session list' },
        },
      },
    },
    '/auth/sessions/{id}': {
      delete: {
        summary: 'Revoke specific session',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: { description: 'Session revoked' },
        },
      },
    },
    '/auth/sessions/revoke-others': {
      post: {
        summary: 'Log out all other sessions and devices',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'All other sessions terminated' },
        },
      },
    },
    '/profile': {
      get: {
        summary: 'Get candidate profile and relations',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Candidate profile with experiences, educations, skills, and score' } },
      },
      put: {
        summary: 'Update candidate profile basic information',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Updated profile' } },
      },
    },
    '/profile/completeness': {
      get: {
        summary: 'Calculate completeness score and suggestions',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Score breakdown and suggestions' } },
      },
    },
    '/profile/facts/{factType}/{factId}/verify': {
      patch: {
        summary: 'Verify or unverify candidate profile fact',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Updated fact item' } },
      },
    },
    '/profile/facts/verify-all': {
      post: {
        summary: 'Verify all unverified facts in one click',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'All facts marked verified' } },
      },
    },
    '/resumes/upload': {
      post: {
        summary: 'Upload PDF/DOCX resume for structured parsing and UNVERIFIED fact generation',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Extracted structured facts and updated profile' } },
      },
    },
    '/questions': {
      get: {
        summary: 'Retrieve canonical universal questions',
        responses: { 200: { description: 'Canonical questions list' } },
      },
    },
    '/questions/answers': {
      get: {
        summary: 'Get candidate answers',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Saved candidate answers' } },
      },
      post: {
        summary: 'Save answers to canonical questions',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Updated candidate answers' } },
      },
    },
    '/onboarding/state': {
      get: {
        summary: 'Get resumable onboarding state',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Current onboarding progress' } },
      },
      put: {
        summary: 'Save onboarding step and completion status',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Updated onboarding progress' } },
      },
    },
    '/graph/nodes': {
      get: {
        summary: "Retrieve candidate's knowledge graph (nodes & edges)",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Career knowledge graph nodes and relationships' } },
      },
    },
    '/graph/stats': {
      get: {
        summary: 'Retrieve graph engine runtime statistics',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Node counts, edge counts, and engine mode' } },
      },
    },
    '/graph/memories': {
      get: {
        summary: 'Retrieve candidate triple-tier memories (Episodic, Semantic, Procedural)',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'List of graph memory nodes' } },
      },
      post: {
        summary: 'Record new memory node',
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Created memory node' } },
      },
    },
    '/graph/evidence-paths': {
      get: {
        summary: 'Traverse multi-hop match evidence paths for a job',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Evidence paths connecting candidate facts to requirements' } },
      },
    },
    '/graph/rebuild': {
      post: {
        summary: 'Rebuild candidate graph from PostgreSQL entities',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Rebuilt graph projection summary' } },
      },
    },
    '/graph/sync': {
      post: {
        summary: 'Sweep pending outbox events into graph',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Number of outbox events processed' } },
      },
    },
    '/jobs': {
      get: {
        summary: 'Search and filter active job opportunities with faceted search',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Paginated job listings with requirements' } },
      },
    },
    '/jobs/sources': {
      get: {
        summary: 'List job discovery adapters, capabilities, rate limits, and health status',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Registered job sources metadata' } },
      },
    },
    '/jobs/discover': {
      post: {
        summary: 'Trigger on-demand discovery across active adapters',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Discovery cycle results' } },
      },
    },
    '/jobs/import-url': {
      post: {
        summary: 'Import job posting from direct URL or pasted description',
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Imported and normalized job card' } },
      },
    },
    '/jobs/saved-searches': {
      get: {
        summary: 'List candidate saved job searches',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'List of saved searches' } },
      },
      post: {
        summary: 'Create a saved job search',
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Created saved search' } },
      },
    },
    '/jobs/saved-searches/auto-generate': {
      post: {
        summary: 'Auto-generate saved searches from profile preferences',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Auto-generated saved searches' } },
      },
    },
    '/jobs/{id}': {
      get: {
        summary: 'Get job details by ID with full requirements breakdown',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Job details' }, 404: { description: 'Job not found' } },
      },
    },
    '/jobs/{id}/verify-freshness': {
      post: {
        summary: 'Re-verify if job listing is still live',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Freshness verification result' } },
      },
    },
    '/matches/jobs/{jobId}': {
      get: {
        summary: 'Compute explainable deterministic match breakdown for a job',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'jobId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Match score, factor breakdown, and evidence paths' } },
      },
    },
    '/matches/top': {
      get: {
        summary: 'Get top ranked matching jobs for authenticated candidate',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 12 } },
          { name: 'excludeEliminated', in: 'query', schema: { type: 'boolean', default: false } },
          { name: 'minScore', in: 'query', schema: { type: 'integer' } },
        ],
        responses: { 200: { description: 'Ranked list of job matches' } },
      },
    },
    '/matches/recalculate': {
      post: {
        summary: 'Recalculate match evaluation with custom weights',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Updated match score result' } },
      },
    },
    '/applications': {
      get: {
        summary: 'List candidate applications for Kanban, Table, and Calendar',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'stage', in: 'query', schema: { type: 'string' } },
          { name: 'q', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'List of applications' } },
      },
      post: {
        summary: 'Initialize application workflow for a job',
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Application initialized and evaluated' } },
      },
    },
    '/applications/{id}': {
      get: {
        summary: 'Get full application details with timeline and packet',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Application details' } },
      },
    },
    '/applications/{id}/stage': {
      patch: {
        summary: 'Update application tracking stage',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Updated application stage' } },
      },
    },
    '/applications/{id}/packet': {
      get: {
        summary: 'Generate manual copyable application packet',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Manual application packet with tailored bullets' } },
      },
    },
    '/missing-info': {
      get: {
        summary: 'List pending missing questions across applications',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Pending missing information items' } },
      },
    },
    '/missing-info/{id}/resolve': {
      post: {
        summary: 'Resolve missing question with candidate answer and scope',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Answer saved and application workflow resumed' } },
      },
    },
    '/approvals': {
      get: {
        summary: 'List applications awaiting candidate approval',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Applications awaiting approval' } },
      },
    },
    '/approvals/{id}/approve': {
      post: {
        summary: 'Approve application with cryptographic content-hash check',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Application approved and submitted' } },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
};
