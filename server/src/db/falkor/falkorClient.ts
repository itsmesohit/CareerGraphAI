import { FalkorDB } from 'falkordb';
import { env } from '../../config/env.js';
import { FalkorGraphSession, QueryResult } from './types.js';
import { InMemFalkorGraphEngine } from './inMemEngine.js';

class FalkorClientManager implements FalkorGraphSession {
  private client: any = null;
  private graph: any = null;
  private inMemEngine: InMemFalkorGraphEngine = new InMemFalkorGraphEngine();
  private mode: 'LIVE' | 'IN_MEMORY' = 'IN_MEMORY';
  private initialized = false;

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log(`[FalkorDB] Probing connection to ${env.FALKORDB_HOST}:${env.FALKORDB_PORT}...`);
      this.client = await FalkorDB.connect({
        socket: {
          host: env.FALKORDB_HOST,
          port: env.FALKORDB_PORT,
          connectTimeout: 2000,
        },
        password: env.FALKORDB_PASSWORD,
        username: env.FALKORDB_USERNAME,
      });

      this.graph = this.client.selectGraph(env.FALKORDB_GRAPH_ID);
      // Run quick ping query to verify FalkorDB Graph module
      await this.graph.query('RETURN 1');
      this.mode = 'LIVE';
      console.log(`[FalkorDB] Connected to LIVE FalkorDB instance on graph "${env.FALKORDB_GRAPH_ID}"!`);
    } catch (err: any) {
      console.warn(`[FalkorDB] Live connection unavailable (${err.message || 'connection failed'}).`);
      console.log(`[FalkorDB] Running in dual-mode: Switched to InMemFalkorGraphEngine with full Cypher multi-hop evaluation.`);
      this.mode = 'IN_MEMORY';
    } finally {
      this.initialized = true;
    }
  }

  public getMode(): 'LIVE' | 'IN_MEMORY' {
    return this.mode;
  }

  public getInMemEngine(): InMemFalkorGraphEngine {
    return this.inMemEngine;
  }

  public async query<T = any>(cypher: string, params: Record<string, any> = {}): Promise<QueryResult<T>> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (this.mode === 'LIVE' && this.graph) {
      try {
        const res = await this.graph.query(cypher, { params });
        return {
          data: res.data || [],
          metadata: res.metadata,
        };
      } catch (error) {
        console.error('[FalkorDB] Error executing live Cypher query:', error);
        // Fallback to in-mem engine if live query encounters transient issue
        return this.inMemEngine.query<T>(cypher, params);
      }
    }

    return this.inMemEngine.query<T>(cypher, params);
  }
}

export const falkor = new FalkorClientManager();
