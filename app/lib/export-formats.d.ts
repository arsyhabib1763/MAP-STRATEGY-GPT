import type { AuditResult, StrategyDocument } from "./strategy";

type DisplayAudit = AuditResult & {
  headline: string;
  insights: string[];
};

export function createStrategySvg(
  strategy: StrategyDocument,
  audit: DisplayAudit,
): string;

export function downloadStrategySvg(
  strategy: StrategyDocument,
  audit: DisplayAudit,
): void;

export function downloadStrategyJson(
  strategy: StrategyDocument,
  audit: DisplayAudit,
): void;

export function createStrategyDocxBlob(
  strategy: StrategyDocument,
  audit: DisplayAudit,
): Promise<Blob>;

export function downloadStrategyDocx(
  strategy: StrategyDocument,
  audit: DisplayAudit,
): Promise<void>;
