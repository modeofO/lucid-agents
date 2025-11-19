import type {
  AgentCardWithEntrypoints,
  FetchFunction,
} from '@lucid-agents/types/core';
import type { InvokeAgentResult, StreamEmit } from '@lucid-agents/types/a2a';

import { fetchAgentCard, findSkill } from './card';

/**
 * Invokes an agent's entrypoint using the Agent Card.
 */
export async function invokeAgent(
  card: AgentCardWithEntrypoints,
  skillId: string,
  input: unknown,
  fetchImpl?: FetchFunction
): Promise<InvokeAgentResult> {
  const skill = findSkill(card, skillId);
  if (!skill) {
    throw new Error(`Skill "${skillId}" not found in Agent Card`);
  }

  const baseUrl = card.url;
  if (!baseUrl) {
    throw new Error('Agent Card missing url field');
  }

  const fetchFn = fetchImpl ?? globalThis.fetch;
  if (!fetchFn) {
    throw new Error('fetch is not available');
  }

  const url = new URL(`/entrypoints/${skillId}/invoke`, baseUrl);
  const response = await fetchFn(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input }),
  });

  if (!response.ok) {
    throw new Error(
      `Agent invocation failed: ${response.status} ${response.statusText}`
    );
  }

  return (await response.json()) as InvokeAgentResult;
}

/**
 * Streams from an agent's entrypoint using the Agent Card.
 */
export async function streamAgent(
  card: AgentCardWithEntrypoints,
  skillId: string,
  input: unknown,
  emit: StreamEmit,
  fetchImpl?: FetchFunction
): Promise<void> {
  const skill = findSkill(card, skillId);
  if (!skill) {
    throw new Error(`Skill "${skillId}" not found in Agent Card`);
  }

  const baseUrl = card.url;
  if (!baseUrl) {
    throw new Error('Agent Card missing url field');
  }

  const fetchFn = fetchImpl ?? globalThis.fetch;
  if (!fetchFn) {
    throw new Error('fetch is not available');
  }

  const url = new URL(`/entrypoints/${skillId}/stream`, baseUrl);
  const response = await fetchFn(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input }),
  });

  if (!response.ok) {
    throw new Error(
      `Agent stream failed: ${response.status} ${response.statusText}`
    );
  }

  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent: { type: string; data: string } | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = {
            type: line.slice(7).trim(),
            data: '',
          };
        } else if (line.startsWith('data: ')) {
          if (currentEvent) {
            currentEvent.data += line.slice(6);
          }
        } else if (line === '' && currentEvent) {
          try {
            const data = currentEvent.data ? JSON.parse(currentEvent.data) : {};
            await emit({ type: currentEvent.type, data });
          } catch (error) {
            // Ignore JSON parse errors for non-JSON data
            await emit({ type: currentEvent.type, data: currentEvent.data });
          }
          currentEvent = null;
        }
      }
    }

    // Handle remaining buffer
    if (buffer.trim() && currentEvent) {
      try {
        const data = currentEvent.data ? JSON.parse(currentEvent.data) : {};
        await emit({ type: currentEvent.type, data });
      } catch {
        await emit({ type: currentEvent.type, data: currentEvent.data });
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Convenience function that fetches an Agent Card and invokes an entrypoint.
 */
export async function fetchAndInvoke(
  baseUrl: string,
  skillId: string,
  input: unknown,
  fetchImpl?: FetchFunction
): Promise<InvokeAgentResult> {
  const card = await fetchAgentCard(baseUrl, fetchImpl);
  return invokeAgent(card, skillId, input, fetchImpl);
}
