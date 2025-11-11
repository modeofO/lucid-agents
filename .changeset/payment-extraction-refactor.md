---
"@lucid-agents/agent-kit": minor
"@lucid-agents/agent-kit-payments": minor
"@lucid-agents/agent-kit-hono": minor
"@lucid-agents/agent-kit-tanstack": minor
---

# Payment Logic Extraction and Type Reorganization

This release completes the extraction of all payment-related logic from `agent-kit` into `agent-kit-payments`, establishes correct package boundaries, and reorganizes types to be co-located with their features.

## Breaking Changes

### Dependency Direction Reversed

- `agent-kit` now depends on `agent-kit-payments` (previously the opposite)
- Build order updated: `agent-kit-payments` must build before `agent-kit`

### Type Locations Changed

- `EntrypointDef` moved from `agent-kit/src/core/types` to `agent-kit-payments/src/types`
  - Rationale: EntrypointDef is an x402/payment concept, not a core HTTP type
- `AgentMeta`, `AgentContext`, `Usage`, `StreamResult` moved to `agent-kit-payments`
- Deleted `agent-kit/src/types.ts` - types now co-located with features

### Import Path Changes

**Before:**
```typescript
import type { EntrypointDef, PaymentsConfig } from '@lucid-agents/agent-kit';
```

**After:**
```typescript
import type { EntrypointDef, PaymentsConfig } from '@lucid-agents/agent-kit-payments';
// Or via re-export from agent-kit
import type { EntrypointDef, PaymentsConfig } from '@lucid-agents/agent-kit';
```

## Architectural Changes

### Files Deleted from agent-kit

- `src/types.ts` - Central types file deleted; types now co-located with features
- `src/http/payments.ts` - Payment requirement logic moved to agent-kit-payments
- `src/runtime.ts` - Runtime payment context moved to agent-kit-payments
- `src/utils/axllm.ts` - Moved to `src/axllm/index.ts`

### Package Boundaries Clarified

**agent-kit-payments** now contains ALL x402 protocol code:
- EntrypointDef (the x402 abstraction for priced capabilities)
- Payment requirement resolution
- 402 response generation
- x402 client utilities (making payments)
- Runtime payment context (wallet integration)
- AxLLM integration with x402

**agent-kit** contains:
- Core runtime (AgentCore, handlers)
- HTTP runtime and SSE streaming
- Manifest generation
- Config management
- UI landing page

### AxLLM Reorganization

- Moved from `src/utils/axllm.ts` to `src/axllm/index.ts`
- Rationale: Isolated for future extraction into separate package
- Updated package.json exports: `./axllm` instead of `./utils/axllm`

## Migration Guide

### For Package Consumers

If you import from `agent-kit`, most imports still work due to re-exports. However, for clarity, consider importing payment types directly:

```typescript
// Recommended
import type { PaymentsConfig, EntrypointDef } from '@lucid-agents/agent-kit-payments';

// Still works (re-exported)
import type { PaymentsConfig, EntrypointDef } from '@lucid-agents/agent-kit';
```

### For Package Contributors

- Types are now co-located with features (no central types file)
- Payment logic belongs in `agent-kit-payments`
- agent-kit-payments must build before agent-kit

## Testing

- All 42 existing tests pass
- Build succeeds for all packages
- TypeScript type checking passes

## Dependency Structure

```
agent-kit-identity (ERC-8004)
    ↓
agent-kit-payments (x402 + EntrypointDef)
    ↓
agent-kit (core runtime)
    ↓
agent-kit-hono / agent-kit-tanstack (adapters)
```

