import type { TaskCategory, ClassificationResult } from '../types/index.ts';

interface KeywordRule {
  category: TaskCategory;
  patterns: (string | RegExp)[];
  weight: number;
}

const CODING_RULES: KeywordRule = {
  category: 'coding',
  weight: 2,
  patterns: [
    // Languages & frameworks
    /\b(python|javascript|typescript|golang|rust|c\+\+|java|html|css|sql|react|vue|angular|node\.?js|docker|kubernetes|git|bash|shell|linux)\b/i,
    // Syntax markers & keywords
    /```[\w]*\n/i,
    /\b(def|class|function|const|let|var|import|export|return|async|await|try|catch|select|insert|update|delete|from|where)\b/i,
    // Programming terms
    /\b(code|coding|bug|error|exception|debug|stacktrace|syntax|algorithm|api|endpoint|refactor|compile|compiler|runtime|npm|pip|sdk|repo|pull request)\b/i,
    /\b(unit test|regex|regular expression|json|xml|yaml|database schema|orm|rest api|graphql)\b/i,
    /([a-zA-Z0-9_$]+)\s*\([^)]*\)\s*[{;]/, // Function signature detection
    /[{};<>]=|=>|===|!==|&&|\|\|/, // Code operator markers
  ],
};

const FINANCE_RULES: KeywordRule = {
  category: 'finance',
  weight: 2.2,
  patterns: [
    /\b(stock|stocks|share|shares|equity|equities|nasdaq|nyse|s&p\s*500|dow jones|bull market|bear market)\b/i,
    /\b(balance sheet|income statement|cash flow|financial statement|10-k|10-q|annual report|audit)\b/i,
    /\b(revenue|profit|margin|ebitda|operating margin|net income|earnings|eps|quarterly earnings)\b/i,
    /\b(investment|investing|portfolio|dividend|yield|roi|cagr|asset allocation|401k|ira|roth)\b/i,
    /\b(valuation|dcf|discounted cash flow|pe ratio|p\/e|market cap|inflation|interest rate|federal reserve|macroeconomics)\b/i,
    /\b(crypto|bitcoin|ethereum|market liquidity|debt-to-equity|amortization|depreciation)\b/i,
  ],
};

const REASONING_RULES: KeywordRule = {
  category: 'reasoning',
  weight: 1.8,
  patterns: [
    /\b(analyze|analysis|compare|comparison|evaluate|evaluation|assessment)\b/i,
    /\b(architecture|architectural|system design|strategy|strategic|trade-off|tradeoffs)\b/i,
    /\b(step-by-step|think step by step|chain of thought|first principles|pros and cons)\b/i,
    /\b(reason|reasoning|deduce|deduction|hypothesis|hypothesize|logical|fallacy|syllogism)\b/i,
    /\b(solve this puzzle|logic puzzle|riddle|proof|prove that|mathematical proof)\b/i,
    /\b(deep dive|critical thinking|feasibility study|root cause analysis)\b/i,
  ],
};

export function classifyPrompt(prompt: string, overrideMode: 'auto' | TaskCategory = 'auto'): ClassificationResult {
  // If user selected explicit mode (e.g. Coding, Reasoning, Finance, General)
  if (overrideMode !== 'auto') {
    return {
      category: overrideMode,
      confidence: 1.0,
      reason: `Manually set to ${overrideMode.toUpperCase()} mode by user`,
    };
  }

  const cleanText = prompt.trim();
  if (cleanText.length < 5) {
    return {
      category: 'general',
      confidence: 0.5,
      reason: 'Short prompt defaults to General model',
    };
  }

  const scores: Record<TaskCategory, { score: number; matches: string[] }> = {
    coding: { score: 0, matches: [] },
    finance: { score: 0, matches: [] },
    reasoning: { score: 0, matches: [] },
    general: { score: 0.5, matches: [] }, // slight baseline
  };

  const checkCategory = (rule: KeywordRule) => {
    for (const pattern of rule.patterns) {
      if (typeof pattern === 'string') {
        if (cleanText.toLowerCase().includes(pattern.toLowerCase())) {
          scores[rule.category].score += rule.weight;
          scores[rule.category].matches.push(`keyword "${pattern}"`);
        }
      } else {
        const match = cleanText.match(pattern);
        if (match) {
          scores[rule.category].score += rule.weight;
          scores[rule.category].matches.push(`pattern "${match[0].slice(0, 20)}"`);
        }
      }
    }
  };

  checkCategory(CODING_RULES);
  checkCategory(FINANCE_RULES);
  checkCategory(REASONING_RULES);

  // Determine top category
  let topCategory: TaskCategory = 'general';
  let topScore = 0;
  let topMatches: string[] = [];

  for (const [cat, data] of Object.entries(scores) as [TaskCategory, { score: number; matches: string[] }][]) {
    if (data.score > topScore) {
      topScore = data.score;
      topCategory = cat;
      topMatches = data.matches;
    }
  }

  // Threshold check: if score is too low or ambiguous, fallback to general
  if (topScore < 1.8) {
    return {
      category: 'general',
      confidence: 0.6,
      reason: 'General everyday query or broad prompt',
    };
  }

  const confidence = Math.min(0.99, Number((0.6 + Math.min(topScore * 0.1, 0.35)).toFixed(2)));

  return {
    category: topCategory,
    confidence,
    reason: `Detected ${topMatches.slice(0, 3).join(', ')}`,
  };
}
