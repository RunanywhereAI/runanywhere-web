/**
 * Prompt templates for Dev Mode + Research Mode.
 */

// ── Dev Mode templates ──

export function explainCode(code: string, language: string): string {
  return `You are a senior ${language} developer. Explain the following code concisely. Focus on what it does, key patterns used, and any notable design decisions. Use markdown formatting.

\`\`\`${language}
${code}
\`\`\`

Explanation:`;
}

export function generateDocstring(code: string, language: string): string {
  const format = getDocstringFormat(language);
  return `You are a senior ${language} developer. Generate a complete ${format} docstring for the following code. Include parameter descriptions, return value, and any exceptions/errors. Output ONLY the docstring, nothing else.

\`\`\`${language}
${code}
\`\`\`

Docstring:`;
}

export function debugCode(code: string, errorMessage: string, language: string): string {
  return `You are a senior ${language} developer and expert debugger. Analyze the following code and error message. Identify the root cause and provide a concrete fix. Use markdown formatting.

**Code:**
\`\`\`${language}
${code}
\`\`\`

**Error:**
\`\`\`
${errorMessage}
\`\`\`

**Root Cause Analysis & Fix:**`;
}

export function suggestRefactor(code: string, language: string): string {
  return `You are a senior ${language} developer. Review the following code and suggest refactoring improvements for readability, performance, and maintainability. Show the improved code with explanations. Use markdown formatting.

\`\`\`${language}
${code}
\`\`\`

**Refactoring Suggestions:**`;
}

// ── Research Mode templates ──

export function answerQuestion(question: string, contextChunks: string): string {
  return `You are a research assistant. Answer the following question using ONLY the provided document context. If the answer is not in the context, say so. Cite the source document names and page numbers when referencing information. Use markdown formatting.

**Context Documents:**
${contextChunks}

**Question:** ${question}

**Answer:**`;
}

export function generateOutlinePrompt(topic: string, contextChunks: string): string {
  return `You are an academic writing assistant. Based on the provided research documents, generate a structured thesis chapter outline for the given topic. Return your response as a JSON object with this exact structure:
{"title": "Suggested thesis title", "chapters": [{"number": 1, "title": "Chapter title", "summary": "Brief summary of chapter content", "sources": ["source1.pdf"]}]}

**Research Context:**
${contextChunks}

**Thesis Topic:** ${topic}

**JSON Output:**`;
}

export function formatCitationsPrompt(contextChunks: string): string {
  return `You are a citation extraction assistant. Extract paper metadata from the following document text. Return a JSON object with this exact structure:
{"citations": [{"title": "Paper title", "authors": ["Author Name"], "year": 2024, "venue": "Journal or Conference name", "pages": "page range"}]}

Extract as many distinct papers/sources as you can identify.

**Document Text:**
${contextChunks}

**JSON Output:**`;
}

// ── Helpers ──

function getDocstringFormat(language: string): string {
  const lower = language.toLowerCase();
  if (lower === 'python') return 'Google-style Python';
  if (lower === 'javascript' || lower === 'typescript' || lower === 'jsx' || lower === 'tsx')
    return 'JSDoc';
  if (lower === 'java' || lower === 'kotlin') return 'Javadoc';
  if (lower === 'csharp' || lower === 'c#') return 'XML documentation';
  if (lower === 'rust') return 'Rustdoc (///)';
  if (lower === 'go') return 'Go documentation comment';
  return 'standard documentation comment';
}

export function detectLanguage(code: string): string {
  // Heuristic-based language detection
  if (/^\s*#\s*(include|ifndef|define|pragma)/m.test(code)) return 'cpp';
  if (/^\s*(import|from)\s+\w+/m.test(code) && /def\s+\w+\s*\(/m.test(code)) return 'python';
  if (/^\s*def\s+\w+/m.test(code) || /^\s*class\s+\w+.*:/m.test(code)) return 'python';
  if (/^\s*package\s+\w+/m.test(code) && /func\s+/m.test(code)) return 'go';
  if (/^\s*func\s+\w+/m.test(code)) return 'go';
  if (/^\s*(import|export)\s+/m.test(code) && /(interface|type)\s+\w+/m.test(code)) return 'typescript';
  if (/^\s*const\s+\w+\s*:\s*\w+/m.test(code)) return 'typescript';
  if (/^\s*(use\s+|fn\s+|let\s+mut|impl\s+|pub\s+(fn|struct|enum))/m.test(code)) return 'rust';
  if (/^\s*package\s+\w+;/m.test(code) || /public\s+class\s+/m.test(code)) return 'java';
  if (/^\s*(const|let|var|function|async\s+function|=>\s*{)/m.test(code)) return 'javascript';
  if (/<\w+[\s>]/m.test(code) && /className|onClick|useState/m.test(code)) return 'tsx';
  if (/<\w+[\s>]/m.test(code)) return 'html';
  if (/^\s*\.\w+\s*{/m.test(code) || /^\s*@media/m.test(code)) return 'css';
  if (/^\s*SELECT|INSERT|UPDATE|DELETE|CREATE/mi.test(code)) return 'sql';
  return 'plaintext';
}
