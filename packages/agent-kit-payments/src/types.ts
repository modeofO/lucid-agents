import type { z } from 'zod';
import type { Network, Resource } from 'x402/types';

export type SolanaAddress = string;

/**
 * Agent metadata that describes the agent's identity
 */
export type AgentMeta = {
  name: string;
  version: string;
  description?: string;
  icon?: string;
};

/**
 * Context passed to entrypoint handlers during execution
 */
export type AgentContext = {
  key: string;
  input: unknown;
  signal: AbortSignal;
  headers: Headers;
  runId?: string;
};

/**
 * Usage statistics for an entrypoint invocation
 */
export type Usage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

/**
 * Result of a streaming entrypoint execution
 */
export type StreamResult = {
  output?: unknown;
  usage?: Usage;
  model?: string;
  status?: "succeeded" | "failed" | "cancelled";
  error?: { code: string; message?: string };
  metadata?: Record<string, unknown>;
};

/**
 * Handler function for non-streaming entrypoints
 */
export type EntrypointHandler<
  TInput extends z.ZodTypeAny | undefined = z.ZodTypeAny | undefined,
  TOutput extends z.ZodTypeAny | undefined = z.ZodTypeAny | undefined
> = (ctx: AgentContext & {
  input: TInput extends z.ZodTypeAny ? z.infer<TInput> : unknown;
}) => Promise<{
  output: TOutput extends z.ZodTypeAny ? z.infer<TOutput> : unknown;
  usage?: Usage;
  model?: string;
}>;

/**
 * Handler function for streaming entrypoints
 */
export type EntrypointStreamHandler<
  TInput extends z.ZodTypeAny | undefined = z.ZodTypeAny | undefined
> = (
  ctx: AgentContext & {
    input: TInput extends z.ZodTypeAny ? z.infer<TInput> : unknown;
  },
  emit: (chunk: any) => Promise<void> | void
) => Promise<StreamResult>;

/**
 * Entrypoint definition - the x402 abstraction for priced agent capabilities.
 * Entrypoints wrap HTTP routes and add payment metadata.
 */
export type EntrypointDef<
  TInput extends z.ZodTypeAny | undefined = z.ZodTypeAny | undefined,
  TOutput extends z.ZodTypeAny | undefined = z.ZodTypeAny | undefined
> = {
  key: string;
  description?: string;
  input?: TInput;
  output?: TOutput;
  streaming?: boolean;
  price?: string | { invoke?: string; stream?: string };
  network?: Network;
  handler?: EntrypointHandler<TInput, TOutput>;
  stream?: EntrypointStreamHandler<TInput>;
  metadata?: Record<string, unknown>;
};

/**
 * Payment configuration for x402 protocol.
 * Supports both EVM (0x...) and Solana (base58) addresses.
 */
export type PaymentsConfig = {
  payTo: `0x${string}` | SolanaAddress;
  facilitatorUrl: Resource;
  network: Network;
  defaultPrice?: string;
};

export type EntrypointPrice = string | { invoke?: string; stream?: string };

