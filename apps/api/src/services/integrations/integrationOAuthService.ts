import crypto from 'crypto';
import { prisma, IntegrationProvider, IntegrationStatus } from '@careergraph/db';
import { TokenEncryptionService } from './tokenEncryptionService.js';
import type {
  IntegrationDTO,
  OAuthAuthorizeUrlDTO,
  ConnectManualIntegrationInput,
} from '@careergraph/shared';

// Minimal scopes explained to the user per Spec §16
export const SCOPE_CATALOG: Record<IntegrationProvider, string[]> = {
  GMAIL: [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
  OUTLOOK: [
    'Mail.Send',
    'Mail.Read',
    'offline_access',
    'User.Read',
  ],
  GOOGLE_CALENDAR: [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
  OUTLOOK_CALENDAR: [
    'Calendars.ReadWrite',
    'offline_access',
    'User.Read',
  ],
};

export class IntegrationOAuthService {
  /**
   * Generates authorization URL for user consent with minimal scopes.
   */
  static getAuthorizeUrl(
    userId: string,
    provider: IntegrationProvider,
    redirectUri?: string
  ): OAuthAuthorizeUrlDTO {
    const stateObj = {
      userId,
      provider,
      nonce: crypto.randomBytes(16).toString('hex'),
      createdAt: Date.now(),
    };
    const state = Buffer.from(JSON.stringify(stateObj)).toString('base64url');

    const scopes = SCOPE_CATALOG[provider].join(' ');
    const baseRedirect = redirectUri || 'https://careergraph.ai/api/v1/integrations/oauth/callback';

    let authorizeUrl = '';
    if (provider === 'GMAIL' || provider === 'GOOGLE_CALENDAR') {
      const clientId = process.env.GOOGLE_CLIENT_ID || 'mock_google_client_id.apps.googleusercontent.com';
      authorizeUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(baseRedirect)}&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent&state=${state}`;
    } else {
      const clientId = process.env.MICROSOFT_CLIENT_ID || 'mock_microsoft_client_id';
      authorizeUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(baseRedirect)}&response_type=code&scope=${encodeURIComponent(scopes)}&state=${state}`;
    }

    return {
      provider,
      authorizeUrl,
      state,
    };
  }

  /**
   * Verifies OAuth state parameter to prevent CSRF attacks.
   */
  static verifyState(state: string, expectedUserId: string): { provider: IntegrationProvider; valid: boolean } {
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'));
      const isUserMatch = decoded.userId === expectedUserId;
      const isFresh = Date.now() - decoded.createdAt < 1000 * 60 * 15; // 15 mins
      return {
        provider: decoded.provider,
        valid: isUserMatch && isFresh,
      };
    } catch {
      return { provider: 'GMAIL', valid: false };
    }
  }

  /**
   * Connects or updates integration with envelope-encrypted tokens.
   */
  static async connectIntegration(
    userId: string,
    data: ConnectManualIntegrationInput
  ): Promise<IntegrationDTO> {
    // Envelope-encrypt access token and refresh token
    const encryptedAccess = TokenEncryptionService.encrypt(data.accessToken);
    let encryptedRefreshData = '';
    if (data.refreshToken) {
      encryptedRefreshData = TokenEncryptionService.encrypt(data.refreshToken).encryptedData;
    }

    const expiresAt = data.expiresInSeconds
      ? new Date(Date.now() + data.expiresInSeconds * 1000)
      : new Date(Date.now() + 3600 * 1000); // Default 1 hour

    const integration = await prisma.userIntegration.upsert({
      where: {
        userId_provider_accountEmail: {
          userId,
          provider: data.provider,
          accountEmail: data.accountEmail,
        },
      },
      update: {
        status: 'CONNECTED',
        scopes: data.scopes && data.scopes.length > 0 ? data.scopes : SCOPE_CATALOG[data.provider],
        encryptedAccessToken: encryptedAccess.encryptedData,
        encryptedRefreshToken: encryptedRefreshData || null,
        tokenExpiresAt: expiresAt,
        encryptedDek: encryptedAccess.encryptedDek,
        iv: encryptedAccess.iv,
        authTag: encryptedAccess.authTag,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      },
      create: {
        userId,
        provider: data.provider,
        accountEmail: data.accountEmail,
        status: 'CONNECTED',
        scopes: data.scopes && data.scopes.length > 0 ? data.scopes : SCOPE_CATALOG[data.provider],
        encryptedAccessToken: encryptedAccess.encryptedData,
        encryptedRefreshToken: encryptedRefreshData || null,
        tokenExpiresAt: expiresAt,
        encryptedDek: encryptedAccess.encryptedDek,
        iv: encryptedAccess.iv,
        authTag: encryptedAccess.authTag,
        lastSyncedAt: new Date(),
      },
    });

    return this.mapToDTO(integration);
  }

  /**
   * Retrieves decrypted OAuth tokens for background email dispatch or calendar sync.
   * Never exposed to frontend responses.
   */
  static async getDecryptedTokens(
    userId: string,
    integrationId: string
  ): Promise<{ accessToken: string; refreshToken?: string; accountEmail: string; provider: IntegrationProvider }> {
    const integration = await prisma.userIntegration.findUnique({
      where: { id: integrationId },
    });

    if (!integration || integration.userId !== userId) {
      throw new Error('Integration not found or unauthorized');
    }

    if (integration.status !== 'CONNECTED') {
      throw new Error(`Integration is ${integration.status}. Reconnect required.`);
    }

    const accessToken = TokenEncryptionService.decrypt({
      encryptedData: integration.encryptedAccessToken,
      encryptedDek: integration.encryptedDek,
      iv: integration.iv,
      authTag: integration.authTag,
    });

    let refreshToken: string | undefined;
    if (integration.encryptedRefreshToken) {
      refreshToken = TokenEncryptionService.decrypt({
        encryptedData: integration.encryptedRefreshToken,
        encryptedDek: integration.encryptedDek,
        iv: integration.iv,
        authTag: integration.authTag,
      });
    }

    return {
      accessToken,
      refreshToken,
      accountEmail: integration.accountEmail,
      provider: integration.provider,
    };
  }

  /**
   * Lists all connected integrations for a user, securely sanitized.
   */
  static async listIntegrations(userId: string): Promise<IntegrationDTO[]> {
    const integrations = await prisma.userIntegration.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return integrations.map((i) => this.mapToDTO(i));
  }

  /**
   * Disconnects and permanently deletes integration tokens per Spec §16.
   */
  static async disconnectIntegration(userId: string, integrationId: string): Promise<void> {
    const integration = await prisma.userIntegration.findUnique({
      where: { id: integrationId },
    });

    if (!integration || integration.userId !== userId) {
      throw new Error('Integration not found');
    }

    await prisma.userIntegration.delete({
      where: { id: integrationId },
    });
  }

  private static mapToDTO(integration: any): IntegrationDTO {
    return {
      id: integration.id,
      provider: integration.provider,
      accountEmail: integration.accountEmail,
      status: integration.status,
      scopes: integration.scopes,
      lastSyncedAt: integration.lastSyncedAt?.toISOString() || null,
      createdAt: integration.createdAt.toISOString(),
      metadata: (integration.metadata as any) || null,
    };
  }
}
