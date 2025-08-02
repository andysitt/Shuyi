import { v4 as uuidv4 } from "uuid";
import {
  LLMTool,
  ToolCall,
  ToolResult,
  SessionContext,
  ToolDefinition,
} from "@/app/types";

// 会话状态
export interface SessionState {
  sessionId: string;
  repositoryPath: string;
  analysisGoal: string;
  createdAt: Date;
  updatedAt: Date;
  toolResults: ToolResult[];
  conversationHistory: ConversationMessage[];
  currentContext: Record<string, any>;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// 工具执行结果
export interface ToolExecutionResult {
  toolCall: ToolCall;
  result: ToolResult;
  executionTime: number;
  timestamp: Date;
}

// 会话管理器
export class SessionManager {
  private sessions: Map<string, SessionState> = new Map();
  private tools: Map<string, LLMTool> = new Map();
  private maxSessions: number = 50;
  private sessionTimeout: number = 24 * 60 * 60 * 1000; // 24小时

  constructor(repositoryPath: string) {
    this.startCleanupInterval();
  }

  // 创建新会话
  async createSession(
    analysisGoal: string,
    repositoryPath: string
  ): Promise<SessionState> {
    const sessionId = uuidv4();
    const session: SessionState = {
      sessionId,
      repositoryPath,
      analysisGoal,
      createdAt: new Date(),
      updatedAt: new Date(),
      toolResults: [],
      conversationHistory: [],
      currentContext: {},
    };

    this.sessions.set(sessionId, session);

    // 限制会话数量
    if (this.sessions.size > this.maxSessions) {
      this.removeOldestSession();
    }

    return session;
  }

  // 获取会话
  getSession(sessionId: string): SessionState | null {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.updatedAt = new Date();
      return session;
    }
    return null;
  }

  // 更新会话上下文
  updateSessionContext(sessionId: string, context: Record<string, any>): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.currentContext = { ...session.currentContext, ...context };
      session.updatedAt = new Date();
    }
  }

  // 添加对话消息
  addConversationMessage(
    sessionId: string,
    message: Omit<ConversationMessage, "id" | "timestamp">
  ): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      const fullMessage: ConversationMessage = {
        ...message,
        id: uuidv4(),
        timestamp: new Date(),
      };
      session.conversationHistory.push(fullMessage);
      session.updatedAt = new Date();
    }
  }

  // 获取会话摘要
  getSessionSummary(sessionId: string): {
    sessionId: string;
    analysisGoal: string;
    totalMessages: number;
    totalToolCalls: number;
    successRate: number;
    createdAt: Date;
    lastActivity: Date;
  } | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const totalToolCalls = session.toolResults.length;
    const successfulCalls = session.toolResults.filter((r) => r.success).length;
    const successRate =
      totalToolCalls > 0 ? successfulCalls / totalToolCalls : 1;

    return {
      sessionId: session.sessionId,
      analysisGoal: session.analysisGoal,
      totalMessages: session.conversationHistory.length,
      totalToolCalls,
      successRate,
      createdAt: session.createdAt,
      lastActivity: session.updatedAt,
    };
  }

  // 获取可用工具列表
  getAvailableTools(): ToolDefinition[] {
    return Array.from(this.tools.entries()).map(([name, tool]) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  // 获取会话历史
  getSessionHistory(sessionId: string): {
    conversation: ConversationMessage[];
    tools: ToolExecutionResult[];
    context: Record<string, any>;
  } | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    return {
      conversation: session.conversationHistory,
      tools: this.getToolExecutionHistory(sessionId),
      context: session.currentContext,
    };
  }

  // 获取工具执行历史
  private getToolExecutionHistory(sessionId: string): ToolExecutionResult[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];

    // 这里我们模拟工具执行历史，实际应用中应该单独存储
    return session.toolResults.map((result, index) => ({
      toolCall: {
        id: `call_${index}`,
        name: "unknown",
        parameters: {},
      },
      result,
      executionTime: 0,
      timestamp: session.updatedAt,
    }));
  }

  // 结束会话
  endSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  // 清理过期会话
  private startCleanupInterval() {
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60 * 60 * 1000); // 每小时清理一次
  }

  private cleanupExpiredSessions() {
    const now = new Date();
    const expiredSessions: string[] = [];

    this.sessions.forEach((session, sessionId) => {
      if (now.getTime() - session.updatedAt.getTime() > this.sessionTimeout) {
        expiredSessions.push(sessionId);
      }
    });

    for (const sessionId of expiredSessions) {
      this.sessions.delete(sessionId);
    }

    if (expiredSessions.length > 0) {
      console.log(`清理了 ${expiredSessions.length} 个过期会话`);
    }
  }

  private removeOldestSession() {
    let oldestSessionId: string | null = null;
    let oldestDate = new Date();

    this.sessions.forEach((session, sessionId) => {
      if (session.createdAt < oldestDate) {
        oldestDate = session.createdAt;
        oldestSessionId = sessionId;
      }
    });

    if (oldestSessionId) {
      this.sessions.delete(oldestSessionId);
    }
  }

  // 获取所有会话
  getAllSessions(): SessionState[] {
    return Array.from(this.sessions.values());
  }

  // 获取活跃会话数量
  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  // 获取会话统计
  getSessionStats(): {
    totalSessions: number;
    activeSessions: number;
    averageSessionDuration: number;
    successRate: number;
  } {
    const sessions = Array.from(this.sessions.values());
    const now = new Date();

    const totalSessions = sessions.length;
    const activeSessions = sessions.filter(
      (s) => now.getTime() - s.updatedAt.getTime() < 30 * 60 * 1000 // 30分钟内活跃
    ).length;

    const averageSessionDuration =
      sessions.reduce((sum, session) => {
        return sum + (now.getTime() - session.createdAt.getTime());
      }, 0) / totalSessions;

    const allResults = sessions.flatMap((s) => s.toolResults);
    const successfulResults = allResults.filter((r) => r.success).length;
    const successRate =
      allResults.length > 0 ? successfulResults / allResults.length : 1;

    return {
      totalSessions,
      activeSessions,
      averageSessionDuration,
      successRate,
    };
  }
}

// 会话管理器工厂
export class SessionManagerFactory {
  private static instances: Map<string, SessionManager> = new Map();

  static getInstance(repositoryPath: string): SessionManager {
    if (!this.instances.has(repositoryPath)) {
      this.instances.set(repositoryPath, new SessionManager(repositoryPath));
    }
    return this.instances.get(repositoryPath)!;
  }

  static cleanupInstance(repositoryPath: string): boolean {
    return this.instances.delete(repositoryPath);
  }

  static getAllInstances(): string[] {
    return Array.from(this.instances.keys());
  }
}

// 全局会话管理器
export const sessionManager = new SessionManager(process.cwd());
