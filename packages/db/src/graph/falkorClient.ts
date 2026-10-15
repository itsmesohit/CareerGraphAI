import { FalkorDB } from 'falkordb';
import { FalkorGraphSession, QueryResult, GraphStats } from './types.js';
import { InMemFalkorGraphEngine } from './inMemEngine.js';

export class FalkorClientManager implements FalkorGraphSession {
  private client: any = null;
  private graph: any = null;
  private inMemEngine: InMemFalkorGraphEngine = new InMemFalkorGraphEngine();
  private mode: 'LIVE' | 'IN_MEMORY' = 'IN_MEMORY';
  private initialized = false;

  private host: string;
  private port: number;
  private graphId: string;

  constructor() {
    this.host = process.env.FALKORDB_HOST || 'localhost';
    this.port = parseInt(process.env.FALKORDB_PORT || '6379', 10);
    this.graphId = process.env.FALKORDB_GRAPH_ID || 'careergraph_main';
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.client = await FalkorDB.connect({
        socket: {
          host: this.host,
          port: this.port,
          connectTimeout: 1500,
        },
      });

      this.graph = this.client.selectGraph(this.graphId);
      await this.graph.query('RETURN 1');
      this.mode = 'LIVE';
      console.log(`[FalkorDB] Connected to LIVE FalkorDB instance on graph "${this.graphId}"`);
    } catch (err: any) {
      console.log(
        `[FalkorDB] Live connection probe to ${this.host}:${this.port} unavailable (${err.message || 'not reachable'}). Running in InMemFalkorGraphEngine with full Cypher multi-hop evaluation.`
      );
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

  public async query<T = any>(
    cypher: string,
    params: Record<string, any> = {}
  ): Promise<QueryResult<T>> {
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
        console.warn('[FalkorDB] Live query error, falling back to in-memory engine:', error);
        return this.inMemEngine.query<T>(cypher, params);
      }
    }

    return this.inMemEngine.query<T>(cypher, params);
  }

  public async getStats(): Promise<GraphStats> {
    if (!this.initialized) {
      await this.initialize();
    }

    const allNodes = this.inMemEngine.getAllNodes();
    const allEdges = this.inMemEngine.getAllEdges();

    const nodeCountsByLabel: Record<string, number> = {};
    allNodes.forEach((n) => {
      n.labels.forEach((l) => {
        nodeCountsByLabel[l] = (nodeCountsByLabel[l] || 0) + 1;
      });
    });

    const edgeCountsByType: Record<string, number> = {};
    allEdges.forEach((e) => {
      edgeCountsByType[e.type] = (edgeCountsByType[e.type] || 0) + 1;
    });

    return {
      mode: this.mode,
      totalNodes: allNodes.length,
      totalEdges: allEdges.length,
      nodeCountsByLabel,
      edgeCountsByType,
    };
  }
}

export const falkor = new FalkorClientManager();
