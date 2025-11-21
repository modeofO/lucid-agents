/**
 * Full Integration Example - A2A Composition (Three Agents)
 *
 * This example demonstrates the core A2A use case: agent composition where an
 * agent acts as both server and client (facilitator/middleware pattern).
 *
 * Architecture:
 * - Agent 1 (Worker): Does the actual work (echo, process, stream)
 * - Agent 2 (Facilitator): Receives calls from Agent 3, calls Agent 1, returns results
 * - Agent 3 (Client): Calls Agent 2
 *
 * Flow: Agent 3 -> Agent 2 -> Agent 1 -> Agent 2 -> Agent 3
 *
 * This demonstrates that agents can act as both clients and servers,
 * enabling complex agent compositions and supply chains.
 *
 * Prerequisites:
 * 1. Install dependencies: bun install
 * 2. Run: bun run examples/full-integration.ts
 */

import { z } from 'zod';
import { createAgentApp } from '@lucid-agents/hono';
import { createAgentRuntime } from '@lucid-agents/core';
import { createA2ARuntime, fetchAndInvoke } from '../src/index';
import type { A2ARuntime } from '@lucid-agents/types/a2a';

// Helper to start a simple HTTP server
async function startServer(
  port: number,
  handler: (req: Request) => Promise<Response> | Response
): Promise<{ url: string; close: () => void }> {
  if (typeof Bun !== 'undefined') {
    const server = Bun.serve({
      port,
      fetch: handler,
    });
    const url = `http://localhost:${port}`;
    return {
      url,
      close: () => {
        server.stop();
      },
    };
  }

  throw new Error('Bun runtime required for this example');
}

async function main() {
  console.log('='.repeat(80));
  console.log('A2A SDK - Comprehensive Integration Test');
  console.log('='.repeat(80));
  console.log('');

  // ============================================================================
  // STEP 1: Create Agent 1 (Worker Agent)
  // ============================================================================
  console.log('STEP 1: Creating Agent 1 (Worker Agent)');
  console.log('-'.repeat(80));

  const {
    app: app1,
    addEntrypoint: addEntrypoint1,
    runtime: runtime1,
  } = createAgentApp({
    name: 'worker-agent',
    version: '1.0.0',
    description: 'Worker agent that processes tasks',
  });

  // Add echo entrypoint
  addEntrypoint1({
    key: 'echo',
    description: 'Echoes back the input text',
    input: z.object({ text: z.string() }),
    output: z.object({ text: z.string() }),
    handler: async ctx => {
      const text = ctx.input.text || '';
      console.log(`[Agent 1] echo handler called with: "${text}"`);
      return {
        output: { text: `Echo: ${text}` },
        usage: { total_tokens: text.length },
      };
    },
  });

  // Add process entrypoint
  addEntrypoint1({
    key: 'process',
    description: 'Processes data and returns result',
    input: z.object({ data: z.array(z.number()) }),
    output: z.object({ result: z.number() }),
    handler: async ctx => {
      const data = ctx.input.data || [];
      const result = data.reduce((sum, n) => sum + n, 0);
      console.log(
        `[Agent 1] process handler called with data: [${data.join(', ')}]`
      );
      return {
        output: { result },
        usage: { total_tokens: data.length },
      };
    },
  });

  // Add stream entrypoint
  addEntrypoint1({
    key: 'stream',
    description: 'Streams characters back',
    input: z.object({ prompt: z.string() }),
    output: z.object({ done: z.boolean() }),
    streaming: true,
    stream: async (ctx, emit) => {
      const prompt = ctx.input.prompt || '';
      console.log(`[Agent 1] stream handler called with: "${prompt}"`);
      for (const char of prompt) {
        await emit({ kind: 'delta', delta: char, mime: 'text/plain' });
      }
      await emit({
        kind: 'text',
        text: `Streamed: ${prompt}`,
        mime: 'text/plain',
      });
      return {
        output: { done: true },
        usage: { total_tokens: prompt.length },
      };
    },
  });

  const server1 = await startServer(8787, app1.fetch.bind(app1));
  console.log(`Agent 1 running at: ${server1.url}`);
  console.log('');

  // ============================================================================
  // STEP 2: Create Agent 2 (Facilitator Agent - acts as both server and client)
  // ============================================================================
  console.log('STEP 2: Creating Agent 2 (Facilitator Agent)');
  console.log('-'.repeat(80));
  console.log('  Agent 2 acts as BOTH server and client:');
  console.log('    - Server: Receives calls from Agent 3');
  console.log('    - Client: Calls Agent 1 to do the work');
  console.log('-'.repeat(80));

  const {
    app: app2,
    addEntrypoint: addEntrypoint2,
    runtime: runtime2,
  } = createAgentApp({
    name: 'facilitator-agent',
    version: '1.0.0',
    description: 'Facilitator agent that proxies requests to worker agent',
  });

  // Create A2A runtime for Agent 2 to call Agent 1
  const a2a2ForAgent1 = createA2ARuntime(runtime2);

  // Add facilitator entrypoints that call Agent 1
  addEntrypoint2({
    key: 'echo',
    description: 'Proxies echo requests to worker agent',
    input: z.object({ text: z.string() }),
    output: z.object({ text: z.string() }),
    handler: async ctx => {
      console.log(
        `[Agent 2] Facilitator echo handler called with: "${ctx.input.text}"`
      );
      // Agent 2 calls Agent 1 (we'll fetch Agent 1's card first)
      const agent1Url = 'http://localhost:8787';
      const agent1Card = await a2a2ForAgent1.fetchCard(agent1Url);
      const result = await a2a2ForAgent1.client.invoke(agent1Card, 'echo', {
        text: ctx.input.text,
      });
      console.log(
        `[Agent 2] Got result from Agent 1: ${JSON.stringify(result.output)}`
      );
      return {
        output: result.output,
        usage: result.usage,
      };
    },
  });

  addEntrypoint2({
    key: 'process',
    description: 'Proxies process requests to worker agent',
    input: z.object({ data: z.array(z.number()) }),
    output: z.object({ result: z.number() }),
    handler: async ctx => {
      console.log(
        `[Agent 2] Facilitator process handler called with data: [${ctx.input.data.join(', ')}]`
      );
      const agent1Url = 'http://localhost:8787';
      const agent1Card = await a2a2ForAgent1.fetchCard(agent1Url);
      const result = await a2a2ForAgent1.client.invoke(agent1Card, 'process', {
        data: ctx.input.data,
      });
      console.log(
        `[Agent 2] Got result from Agent 1: ${JSON.stringify(result.output)}`
      );
      return {
        output: result.output,
        usage: result.usage,
      };
    },
  });

  const server2 = await startServer(8788, app2.fetch.bind(app2));
  console.log(`Agent 2 running at: ${server2.url}`);
  console.log('');

  // ============================================================================
  // STEP 3: Create Agent 3 (Client Agent)
  // ============================================================================
  console.log('STEP 3: Creating Agent 3 (Client Agent)');
  console.log('-'.repeat(80));

  const { runtime: runtime3 } = createAgentRuntime({
    name: 'client-agent',
    version: '1.0.0',
    description: 'Client agent that calls facilitator agent',
  });

  const a2a3: A2ARuntime = createA2ARuntime(runtime3);
  console.log('Agent 3 ready');
  console.log('');

  try {
    // ============================================================================
    // STEP 4: Build Agent Cards
    // ============================================================================
    console.log('STEP 4: Building Agent Cards');
    console.log('-'.repeat(80));

    const a2a1: A2ARuntime = createA2ARuntime(runtime1);

    const card1 = a2a1.buildCard(server1.url);
    const card2 = a2a2ForAgent1.buildCard(server2.url);

    console.log('Agent 1 (Worker) Card:');
    console.log(`  Name: ${card1.name}`);
    console.log(`  URL: ${card1.url}`);
    console.log(`  Skills: ${card1.skills.map(s => s.id).join(', ')}`);
    console.log('');

    console.log('Agent 2 (Facilitator) Card:');
    console.log(`  Name: ${card2.name}`);
    console.log(`  URL: ${card2.url}`);
    console.log(`  Skills: ${card2.skills.map(s => s.id).join(', ')}`);
    console.log('');

    // ============================================================================
    // STEP 5: Fetch Agent Cards via HTTP
    // ============================================================================
    console.log('STEP 5: Fetching Agent Cards via HTTP');
    console.log('-'.repeat(80));

    // Agent 3 fetches Agent 2's card (the facilitator)
    const fetchedCard2 = await a2a3.fetchCard(server2.url);
    console.log(`Agent 3 fetched Agent 2 Card from ${server2.url}:`);
    console.log(`  Name: ${fetchedCard2.name}`);
    console.log(`  Skills: ${fetchedCard2.skills.map(s => s.id).join(', ')}`);
    console.log('');

    // ============================================================================
    // STEP 6: A2A Composition - Agent 3 -> Agent 2 -> Agent 1
    // ============================================================================
    console.log('STEP 6: A2A Composition (Agent 3 -> Agent 2 -> Agent 1)');
    console.log('-'.repeat(80));
    console.log('This demonstrates the facilitator pattern:');
    console.log('  - Agent 3 calls Agent 2 (facilitator)');
    console.log('  - Agent 2 receives call, then calls Agent 1 (worker)');
    console.log("  - Agent 2 returns Agent 1's result to Agent 3");
    console.log('-'.repeat(80));
    console.log('');

    // Agent 3 calls Agent 2's echo entrypoint
    // Agent 2 receives it and calls Agent 1 internally, then returns result
    console.log('6.1: Agent 3 -> Agent 2 -> Agent 1 (echo)');
    console.log(
      '  Flow: Agent 3 calls Agent 2, Agent 2 calls Agent 1, result flows back'
    );
    const echoResult = await a2a3.client.invoke(fetchedCard2, 'echo', {
      text: 'Hello from Agent 3 through Agent 2!',
    });
    console.log(
      `  Final result at Agent 3: ${JSON.stringify(echoResult.output)}`
    );
    console.log(`  Usage: ${JSON.stringify(echoResult.usage)}`);
    console.log('');

    // Agent 3 calls Agent 2's process entrypoint
    // Agent 2 receives it and calls Agent 1 internally, then returns result
    console.log('6.2: Agent 3 -> Agent 2 -> Agent 1 (process)');
    console.log(
      '  Flow: Agent 3 calls Agent 2, Agent 2 calls Agent 1, result flows back'
    );
    const processResult = await a2a3.client.invoke(fetchedCard2, 'process', {
      data: [10, 20, 30],
    });
    console.log(
      `  Final result at Agent 3: ${JSON.stringify(processResult.output)}`
    );
    console.log(
      `  Sum: ${(processResult.output as { result: number })?.result}`
    );
    console.log('');

    // ============================================================================
    // SUMMARY
    // ============================================================================
    console.log('='.repeat(80));
    console.log('A2A Composition Test Summary');
    console.log('='.repeat(80));
    console.log('');
    console.log('Architecture Demonstrated:');
    console.log('  ✓ Agent 1 (Worker): Does the actual work');
    console.log('  ✓ Agent 2 (Facilitator): Acts as both server AND client');
    console.log('    - Server: Receives calls from Agent 3');
    console.log('    - Client: Calls Agent 1 to perform work');
    console.log('  ✓ Agent 3 (Client): Initiates requests');
    console.log('');
    console.log('A2A Functionality Tested:');
    console.log('  ✓ Build Agent Card');
    console.log('  ✓ Fetch Agent Card');
    console.log('  ✓ Invoke entrypoint through facilitator (synchronous)');
    console.log('  ✓ Agent composition (agent calling agent calling agent)');
    console.log('');
    console.log(
      'This demonstrates that agents can act as both clients and servers,'
    );
    console.log('enabling complex agent compositions and supply chains!');
    console.log('='.repeat(80));
  } finally {
    // Cleanup
    server1.close();
    server2.close();
    console.log('\nServers stopped');
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  if (typeof process !== 'undefined') process.exit(1);
});
