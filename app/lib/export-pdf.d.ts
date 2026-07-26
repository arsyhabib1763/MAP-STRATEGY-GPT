import type {
  AuditResult,
  StrategyDocument,
} from "./strategy";

type DisplayAudit = AuditResult & {
  headline: string;
  insights: string[];
};

export function createStrategyPdf(
  strategy: StrategyDocument,
  audit: DisplayAudit,
): {
  output(type: "arraybuffer"): ArrayBuffer;
  save(filename: string): void;
  getNumberOfPages(): number;
};

export function downloadStrategyPdf(
  strategy: StrategyDocument,
  audit: DisplayAudit,
): Promise<void>;
